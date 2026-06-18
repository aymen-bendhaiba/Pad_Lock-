import { Injectable } from '@nestjs/common';
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
import { RfidCard } from './rfid-card.entity';

type RfidCommandResponse = {
  success: true;
  terminalId: string;
  command: string;
  opType: number;
  count: number;
  cards: string[];
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
        return existing;
      }

      return this.rfidCardsRepository.create({
        lockDeviceId: lockDevice.id,
        cardNumber,
        label: dto.label ?? null,
        active: true,
      });
    });

    const command = buildRfidAddCommand(cards);
    const response = await this.tcpGatewayService.sendRfidCommand(
      lockDevice.terminalId,
      command,
    );

    await this.rfidCardsRepository.save(records);

    return commandResponse(lockDevice.terminalId, command, response);
  }

  async deleteCards(
    terminalId: string,
    dto: RfidCardsDto,
  ): Promise<RfidCommandResponse> {
    const lockDevice =
      await this.locksService.findByTerminalIdOrFail(terminalId);
    const cards = uniqueCards(dto.cards);
    const command = buildRfidDeleteCommand(cards);
    const response = await this.tcpGatewayService.sendRfidCommand(
      lockDevice.terminalId,
      command,
    );

    await this.rfidCardsRepository.delete({
      lockDeviceId: lockDevice.id,
      cardNumber: In(cards),
    });

    return commandResponse(lockDevice.terminalId, command, response);
  }

  async clearCards(terminalId: string): Promise<RfidCommandResponse> {
    const lockDevice =
      await this.locksService.findByTerminalIdOrFail(terminalId);
    const command = buildRfidClearCommand();
    const response = await this.tcpGatewayService.sendRfidCommand(
      lockDevice.terminalId,
      command,
    );

    await this.rfidCardsRepository.delete({ lockDeviceId: lockDevice.id });

    return commandResponse(lockDevice.terminalId, command, response);
  }

  async queryGroupCommand(
    terminalId: string,
    group: number,
  ): Promise<RfidCommandResponse> {
    const lockDevice =
      await this.locksService.findByTerminalIdOrFail(terminalId);
    const command = buildRfidQueryCommand(group);
    const response = await this.tcpGatewayService.sendRfidCommand(
      lockDevice.terminalId,
      command,
    );
    return commandResponse(lockDevice.terminalId, command, response);
  }
}

function uniqueCards(cards: string[]): string[] {
  return [...new Set(cards)];
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
