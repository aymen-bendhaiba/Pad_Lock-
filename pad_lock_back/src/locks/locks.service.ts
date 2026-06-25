import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateLockDeviceDto } from './dto/create-lock-device.dto';
import { FindLocksQueryDto } from './dto/find-locks-query.dto';
import { UpdateLockDeviceDto } from './dto/update-lock-device.dto';
import { LockDevice, LockDeviceStatus } from './lock-device.entity';

@Injectable()
export class LocksService {
  constructor(
    @InjectRepository(LockDevice)
    private readonly lockDevicesRepository: Repository<LockDevice>,
  ) {}

  findAll(query: FindLocksQueryDto = {}): Promise<LockDevice[]> {
    const builder = this.lockDevicesRepository
      .createQueryBuilder('lock')
      .select([
        'lock.id',
        'lock.terminalId',
        'lock.name',
        'lock.imei',
        'lock.status',
        'lock.lastSeenAt',
        'lock.createdAt',
        'lock.updatedAt',
      ])
      .orderBy('lock.createdAt', 'DESC')
      .skip(((query.page ?? 1) - 1) * (query.limit ?? 100))
      .take(query.limit ?? 100);

    if (query.status) {
      builder.andWhere('lock.status = :status', { status: query.status });
    }

    if (query.search?.trim()) {
      builder.andWhere(
        `(COALESCE(lock."terminalId", '') || ' ' || COALESCE(lock.name, '') ||
          ' ' || COALESCE(lock.imei, '')) ILIKE :search`,
        { search: `%${query.search.trim()}%` },
      );
    }

    return builder.getMany();
  }

  async create(dto: CreateLockDeviceDto): Promise<LockDevice> {
    const terminalId = dto.terminalId.toUpperCase();
    const exists = await this.lockDevicesRepository.existsBy({ terminalId });

    if (exists) {
      throw new ConflictException('Lock terminal ID already exists');
    }

    return this.lockDevicesRepository.save(
      this.lockDevicesRepository.create({
        ...dto,
        terminalId,
        imei: dto.imei ?? null,
      }),
    );
  }

  async update(
    terminalId: string,
    dto: UpdateLockDeviceDto,
  ): Promise<LockDevice> {
    const lockDevice = await this.findByTerminalIdOrFail(terminalId);
    Object.assign(lockDevice, dto);
    return this.lockDevicesRepository.save(lockDevice);
  }

  async findByTerminalIdOrFail(terminalId: string): Promise<LockDevice> {
    const lockDevice = await this.lockDevicesRepository.findOneBy({
      terminalId: terminalId.toUpperCase(),
    });

    if (!lockDevice) {
      throw new NotFoundException('Lock device not found');
    }

    return lockDevice;
  }

  async findOrCreateFromTcp(
    terminalId: string,
    input?: { imei?: string | null },
  ): Promise<LockDevice> {
    const normalizedTerminalId = terminalId.toUpperCase();
    const existing = await this.lockDevicesRepository.findOneBy({
      terminalId: normalizedTerminalId,
    });

    if (existing) {
      existing.status = LockDeviceStatus.Online;
      existing.lastSeenAt = new Date();

      if (input?.imei && !existing.imei) {
        existing.imei = input.imei;
      }

      return this.lockDevicesRepository.save(existing);
    }

    return this.lockDevicesRepository.save(
      this.lockDevicesRepository.create({
        terminalId: normalizedTerminalId,
        name: `Lock ${normalizedTerminalId}`,
        imei: input?.imei ?? null,
        status: LockDeviceStatus.Online,
        lastSeenAt: new Date(),
      }),
    );
  }
}
