import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { LocksService } from '../locks/locks.service';
import {
  buildRfidAddCommand,
  buildRfidClearCommand,
  buildRfidDeleteCommand,
  buildRfidQueryCommand,
} from '../protocol/jt701d-commands';
import { TcpGatewayService } from '../tcp/tcp-gateway.service';
import { RfidCardsDto } from './dto/rfid-cards.dto';
import { RfidCard, RfidCardRole, RfidCardSyncStatus } from './rfid-card.entity';

type RfidCommandResponse = {
  success: true;
  terminalId: string;
  command: string;
  opType: number;
  count: number;
  cards: string[];
  syncStatus?: RfidCardSyncStatus;
};

@Injectable()
export class RfidService {
  constructor(
    @InjectRepository(RfidCard)
    private readonly rfidCardsRepository: Repository<RfidCard>,
    private readonly locksService: LocksService,
    private readonly tcpGatewayService: TcpGatewayService,
  ) {}

  async findForLock(terminalId: string): Promise<RfidCard[]> {
    const lockDevice =
      await this.locksService.findByTerminalIdOrFail(terminalId);

    return this.rfidCardsRepository.find({
      where: { lockDeviceId: lockDevice.id, active: true },
      order: { createdAt: 'DESC' },
    });
  }

  async addCards(
    terminalId: string,
    dto: RfidCardsDto,
  ): Promise<RfidCommandResponse> {
    const lockDevice =
      await this.locksService.findByTerminalIdOrFail(terminalId);
    const cards = uniqueCards(dto.cards);
    await this.assertCardLimits(lockDevice.id, cards, dto.role);
    const existingCards = await this.rfidCardsRepository.find({
      where: { lockDeviceId: lockDevice.id, cardNumber: In(cards) },
    });
    const existingByNumber = new Map(
      existingCards.map((card) => [card.cardNumber, card]),
    );

    const records = cards.map((cardNumber) => {
      const existing = existingByNumber.get(cardNumber);

      if (existing) {
        existing.active = true;
        existing.label = dto.label ?? existing.label;
        existing.role = dto.role ?? existing.role;
        existing.lastSyncStatus = RfidCardSyncStatus.PendingAdd;
        existing.lastSyncError = null;
        return existing;
      }

      return this.rfidCardsRepository.create({
        lockDeviceId: lockDevice.id,
        cardNumber,
        label: dto.label ?? null,
        role: dto.role ?? RfidCardRole.Limited,
        active: true,
        installedOnLock: false,
        lastSyncStatus: RfidCardSyncStatus.PendingAdd,
        lastSyncError: null,
        lastSyncedAt: null,
      });
    });

    const command = buildRfidAddCommand(cards);
    await this.rfidCardsRepository.save(records);

    try {
      const response = await this.tcpGatewayService.sendRfidCommand(
        lockDevice.terminalId,
        command,
      );
      await this.markCardsSynced(lockDevice.id, cards, true);

      return commandResponse(lockDevice.terminalId, command, response);
    } catch (error) {
      await this.markCardsPendingOrFailed(lockDevice.id, cards, true, error);

      return pendingCommandResponse(lockDevice.terminalId, command, cards);
    }
  }

  async deleteCards(
    terminalId: string,
    dto: RfidCardsDto,
  ): Promise<RfidCommandResponse> {
    const lockDevice =
      await this.locksService.findByTerminalIdOrFail(terminalId);
    const cards = uniqueCards(dto.cards);
    await this.rfidCardsRepository.update(
      { lockDeviceId: lockDevice.id, cardNumber: In(cards) },
      {
        lastSyncStatus: RfidCardSyncStatus.PendingDelete,
        lastSyncError: null,
      },
    );

    const command = buildRfidDeleteCommand(cards);

    try {
      const response = await this.tcpGatewayService.sendRfidCommand(
        lockDevice.terminalId,
        command,
      );
      await this.markCardsRemovedByApi(lockDevice.id, cards);

      return commandResponse(lockDevice.terminalId, command, response);
    } catch (error) {
      await this.markCardsPendingOrFailed(lockDevice.id, cards, false, error);

      return pendingCommandResponse(
        lockDevice.terminalId,
        command,
        cards,
        RfidCardSyncStatus.PendingDelete,
      );
    }
  }

  async clearCards(terminalId: string): Promise<RfidCommandResponse> {
    const lockDevice =
      await this.locksService.findByTerminalIdOrFail(terminalId);
    await this.rfidCardsRepository.update(
      { lockDeviceId: lockDevice.id },
      {
        lastSyncStatus: RfidCardSyncStatus.PendingDelete,
        lastSyncError: null,
      },
    );

    const command = buildRfidClearCommand();

    try {
      const response = await this.tcpGatewayService.sendRfidCommand(
        lockDevice.terminalId,
        command,
      );
      await this.rfidCardsRepository.update(
        { lockDeviceId: lockDevice.id },
        {
          active: false,
          installedOnLock: false,
          lastSyncStatus: RfidCardSyncStatus.Synced,
          lastSyncError: null,
          lastSyncedAt: new Date(),
        },
      );

      return commandResponse(lockDevice.terminalId, command, response);
    } catch (error) {
      await this.markLockCardsFailed(lockDevice.id, error);

      return pendingCommandResponse(
        lockDevice.terminalId,
        command,
        [],
        RfidCardSyncStatus.PendingDelete,
      );
    }
  }

  async updateCardRole(
    terminalId: string,
    cardNumber: string,
    role: RfidCardRole,
  ): Promise<RfidCard> {
    if (!/^\d{10}$/.test(cardNumber)) {
      throw new BadRequestException(
        'RFID card number must be exactly 10 digits',
      );
    }

    const lockDevice =
      await this.locksService.findByTerminalIdOrFail(terminalId);
    const card = await this.rfidCardsRepository.findOneBy({
      lockDeviceId: lockDevice.id,
      cardNumber,
      active: true,
    });

    if (!card) {
      throw new NotFoundException('RFID card not found for this lock');
    }

    if (card.role === role) {
      return card;
    }

    await this.assertRoleChangeAllowed(lockDevice.id, card.id, role);
    card.role = role;
    return this.rfidCardsRepository.save(card);
  }

  async queryGroupCommand(
    terminalId: string,
    group: number,
  ): Promise<RfidCommandResponse & { syncedCards: RfidCard[] }> {
    const lockDevice =
      await this.locksService.findByTerminalIdOrFail(terminalId);
    const command = buildRfidQueryCommand(group);
    const response = await this.tcpGatewayService.sendRfidCommand(
      lockDevice.terminalId,
      command,
    );
    const syncedCards = await this.syncCardsFromDevice(
      lockDevice.id,
      response.cards,
    );

    return {
      ...commandResponse(lockDevice.terminalId, command, response),
      syncedCards,
    };
  }

  private async syncCardsFromDevice(
    lockDeviceId: string,
    cards: string[],
  ): Promise<RfidCard[]> {
    const uniqueDeviceCards = uniqueCards(cards).filter((card) =>
      /^\d{10}$/.test(card),
    );

    if (uniqueDeviceCards.length === 0) {
      return [];
    }

    const existingCards = await this.rfidCardsRepository.find({
      where: { lockDeviceId, cardNumber: In(uniqueDeviceCards) },
    });
    const existingByNumber = new Map(
      existingCards.map((card) => [card.cardNumber, card]),
    );
    const records = uniqueDeviceCards.map((cardNumber) => {
      const existing = existingByNumber.get(cardNumber);

      if (existing) {
        existing.active = true;
        existing.installedOnLock = true;
        existing.lastSyncStatus = RfidCardSyncStatus.Synced;
        existing.lastSyncError = null;
        existing.lastSyncedAt = new Date();
        return existing;
      }

      return this.rfidCardsRepository.create({
        lockDeviceId,
        cardNumber,
        label: 'Synced from lock',
        role: RfidCardRole.Limited,
        active: true,
        installedOnLock: true,
        lastSyncStatus: RfidCardSyncStatus.Synced,
        lastSyncError: null,
        lastSyncedAt: new Date(),
      });
    });

    return this.rfidCardsRepository.save(records);
  }

  private async assertCardLimits(
    lockDeviceId: string,
    cards: string[],
    role = RfidCardRole.Limited,
  ): Promise<void> {
    if (role === RfidCardRole.Admin && cards.length > 1) {
      throw new BadRequestException(
        'Only one admin card can be assigned per request',
      );
    }

    if (role === RfidCardRole.Admin) {
      const existingAdmin = await this.rfidCardsRepository.existsBy({
        lockDeviceId,
        role: RfidCardRole.Admin,
        active: true,
      });

      if (existingAdmin) {
        throw new BadRequestException('This lock already has an admin card');
      }

      return;
    }

    const limitedCount = await this.rfidCardsRepository.countBy({
      lockDeviceId,
      role: RfidCardRole.Limited,
      active: true,
    });

    if (limitedCount + cards.length > 19) {
      throw new BadRequestException(
        'A lock can have at most 19 limited cards because the admin card is reserved by default',
      );
    }
  }

  private async assertRoleChangeAllowed(
    lockDeviceId: string,
    cardId: string,
    role: RfidCardRole,
  ): Promise<void> {
    if (role === RfidCardRole.Admin) {
      const existingAdmin = await this.rfidCardsRepository.findOneBy({
        lockDeviceId,
        role: RfidCardRole.Admin,
        active: true,
      });

      if (existingAdmin && existingAdmin.id !== cardId) {
        throw new BadRequestException('This lock already has an admin card');
      }

      return;
    }

    const limitedCount = await this.rfidCardsRepository.countBy({
      lockDeviceId,
      role: RfidCardRole.Limited,
      active: true,
    });

    if (limitedCount >= 19) {
      throw new BadRequestException(
        'A lock can have at most 19 limited cards because the admin card is reserved by default',
      );
    }
  }

  private async markCardsSynced(
    lockDeviceId: string,
    cards: string[],
    installedOnLock: boolean,
  ): Promise<void> {
    await this.rfidCardsRepository.update(
      { lockDeviceId, cardNumber: In(cards) },
      {
        installedOnLock,
        lastSyncStatus: RfidCardSyncStatus.Synced,
        lastSyncError: null,
        lastSyncedAt: new Date(),
      },
    );
  }

  private async markCardsRemovedByApi(
    lockDeviceId: string,
    cards: string[],
  ): Promise<void> {
    await this.rfidCardsRepository.update(
      { lockDeviceId, cardNumber: In(cards) },
      {
        active: false,
        installedOnLock: false,
        lastSyncStatus: RfidCardSyncStatus.Synced,
        lastSyncError: null,
        lastSyncedAt: new Date(),
      },
    );
  }

  private async markCardsPendingOrFailed(
    lockDeviceId: string,
    cards: string[],
    targetInstalledOnLock: boolean,
    error: unknown,
  ): Promise<void> {
    const offline =
      error instanceof BadRequestException ||
      (error instanceof Error && error.message.includes('not connected'));

    await this.rfidCardsRepository.update(
      { lockDeviceId, cardNumber: In(cards) },
      {
        lastSyncStatus: offline
          ? targetInstalledOnLock
            ? RfidCardSyncStatus.PendingAdd
            : RfidCardSyncStatus.PendingDelete
          : RfidCardSyncStatus.Failed,
        lastSyncError: error instanceof Error ? error.message : String(error),
      },
    );
  }

  private async markLockCardsFailed(
    lockDeviceId: string,
    error: unknown,
  ): Promise<void> {
    await this.rfidCardsRepository.update(
      { lockDeviceId },
      {
        lastSyncStatus: RfidCardSyncStatus.Failed,
        lastSyncError: error instanceof Error ? error.message : String(error),
      },
    );
  }
}

function uniqueCards(cards: string[]): string[] {
  return [...new Set(cards)];
}

function pendingCommandResponse(
  terminalId: string,
  command: string,
  cards: string[],
  syncStatus = RfidCardSyncStatus.PendingAdd,
): RfidCommandResponse {
  return {
    success: true,
    terminalId,
    command,
    opType: 0,
    count: cards.length,
    cards,
    syncStatus,
  };
}

function commandResponse(
  terminalId: string,
  command: string,
  response: { opType: number; count: number; cards: string[] },
): RfidCommandResponse {
  return {
    success: true,
    terminalId,
    command,
    opType: response.opType,
    count: response.count,
    cards: response.cards,
  };
}
