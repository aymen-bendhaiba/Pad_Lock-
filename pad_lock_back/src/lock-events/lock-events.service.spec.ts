import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { firstValueFrom, filter, take } from 'rxjs';
import { LocksService } from '../locks/locks.service';
import { PositionsService } from '../positions/positions.service';
import { LockEventsService } from './lock-events.service';
import {
  LockEvent,
  LockEventSeverity,
  LockEventStatus,
  LockEventType,
} from './lock-event.entity';

describe('LockEventsService', () => {
  let service: LockEventsService;
  const lockDevice = {
    id: 'lock-1',
    terminalId: '8034400004',
  };
  const queryBuilder = {
    select: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    orderBy: jest.fn(),
    skip: jest.fn(),
    take: jest.fn(),
    getMany: jest.fn().mockResolvedValue([]),
  };
  Object.values(queryBuilder).forEach((mock) => {
    if (mock !== queryBuilder.getMany) {
      mock.mockReturnValue(queryBuilder);
    }
  });
  const repository = {
    create: jest.fn((input: Partial<LockEvent>) => input),
    save: jest.fn((input: Partial<LockEvent>) =>
      Promise.resolve({
        id: 'event-1',
        receivedAt: new Date('2026-06-23T10:00:00.000Z'),
        deletedAt: null,
        ...input,
      }),
    ),
    findOneBy: jest.fn((where: { id: string }) =>
      Promise.resolve(
        where.id === 'event-1'
          ? ({
              id: 'event-1',
              terminalId: '8034400004',
              type: LockEventType.IllegalRfid,
              severity: LockEventSeverity.Critical,
              status: LockEventStatus.Unread,
            } as LockEvent)
          : null,
      ),
    ),
    createQueryBuilder: jest.fn(() => queryBuilder),
  };
  const locksService = {
    findOrCreateFromTcp: jest.fn((terminalId: string) =>
      Promise.resolve({
        ...lockDevice,
        terminalId: terminalId.toUpperCase(),
      }),
    ),
    findByTerminalIdOrFail: jest.fn((terminalId: string) =>
      Promise.resolve({
        ...lockDevice,
        terminalId: terminalId.toUpperCase(),
      }),
    ),
  };
  const positionsService = {
    findLatestForLock: jest.fn(() =>
      Promise.resolve({
        terminalId: '8034400004',
        latitude: 33.959875,
        longitude: -6.863942,
        isPositioned: true,
      }),
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        LockEventsService,
        {
          provide: getRepositoryToken(LockEvent),
          useValue: repository,
        },
        {
          provide: LocksService,
          useValue: locksService,
        },
        {
          provide: PositionsService,
          useValue: positionsService,
        },
      ],
    }).compile();

    service = module.get(LockEventsService);
  });

  it('emits manually created alerts after saving them', async () => {
    const streamedAlert = firstValueFrom(
      service.streamAlerts().pipe(
        filter((message) => message.type === 'alert'),
        take(1),
      ),
    );

    const saved = await service.create('8034400004', {
      type: LockEventType.IllegalRfid,
      occurredAt: '2026-06-23T10:00:00.000Z',
    });

    await expect(streamedAlert).resolves.toMatchObject({
      type: 'alert',
      data: saved,
    });
    expect(saved.severity).toBe(LockEventSeverity.Critical);
    expect(saved.status).toBe(LockEventStatus.Unread);
    expect(saved.latitude).toBe(33.959875);
    expect(saved.longitude).toBe(-6.863942);
  });

  it('emits TCP alerts after saving them', async () => {
    const streamedAlert = firstValueFrom(
      service.streamAlerts('8034400004').pipe(
        filter((message) => message.type === 'alert'),
        take(1),
      ),
    );

    const saved = await service.recordFromTcp('8034400004', {
      type: LockEventType.LowBattery,
      source: 'JT701D binary alarm',
      occurredAt: new Date('2026-06-23T10:00:00.000Z'),
    });

    await expect(streamedAlert).resolves.toMatchObject({
      type: 'alert',
      data: saved,
    });
    expect(saved.severity).toBe(LockEventSeverity.Warning);
    expect(saved.status).toBe(LockEventStatus.Unread);
    expect(saved.latitude).toBe(33.959875);
    expect(saved.longitude).toBe(-6.863942);
  });

  it('keeps explicit TCP alert coordinates instead of replacing them', async () => {
    const saved = await service.recordFromTcp('8034400004', {
      type: LockEventType.Vibration,
      latitude: 34.1,
      longitude: -7.2,
      occurredAt: new Date('2026-06-23T10:00:00.000Z'),
    });

    expect(saved.latitude).toBe(34.1);
    expect(saved.longitude).toBe(-7.2);
  });

  it('filters streamed alerts by terminal id', async () => {
    const received: LockEvent[] = [];
    const subscription = service
      .streamAlerts('8034400004')
      .pipe(filter((message) => message.type === 'alert'))
      .subscribe((message) => received.push(message.data as LockEvent));

    await service.recordFromTcp('OTHER', {
      type: LockEventType.LowBattery,
      occurredAt: new Date('2026-06-23T10:00:00.000Z'),
    });
    await service.recordFromTcp('8034400004', {
      type: LockEventType.Vibration,
      occurredAt: new Date('2026-06-23T10:01:00.000Z'),
    });

    subscription.unsubscribe();

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      terminalId: '8034400004',
      type: LockEventType.Vibration,
    });
  });

  it('updates alert status', async () => {
    const updated = await service.updateStatus('event-1', {
      status: LockEventStatus.Investigating,
    });

    expect(repository.findOneBy).toHaveBeenCalledWith({ id: 'event-1' });
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'event-1',
        status: LockEventStatus.Investigating,
      }),
    );
    expect(updated.status).toBe(LockEventStatus.Investigating);
  });

  it('filters latest alerts by terminal, status, and date range', async () => {
    await service.findLatest({
      terminalId: '8034400004',
      status: LockEventStatus.Unread,
      type: LockEventType.LowBattery,
      severity: LockEventSeverity.Warning,
      from: '2026-06-01T00:00:00.000Z',
      to: '2026-06-23T23:59:59.999Z',
      page: 2,
      limit: 25,
    });

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'event."terminalId" = :terminalId',
      { terminalId: '8034400004' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'event.status = :status',
      { status: LockEventStatus.Unread },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('event.type = :type', {
      type: LockEventType.LowBattery,
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'event.severity = :severity',
      { severity: LockEventSeverity.Warning },
    );
    expect(queryBuilder.skip).toHaveBeenCalledWith(25);
    expect(queryBuilder.take).toHaveBeenCalledWith(25);
  });

  it('rejects invalid alert date ranges', async () => {
    await expect(
      service.findLatest({
        from: '2026-06-24T00:00:00.000Z',
        to: '2026-06-23T00:00:00.000Z',
      }),
    ).rejects.toThrow('Alert from date must be before to date');
  });
});
