import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { firstValueFrom, filter, take } from 'rxjs';
import { FindManyOptions, FindOperator } from 'typeorm';
import { LocksService } from '../locks/locks.service';
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
    find: jest.fn<Promise<LockEvent[]>, [FindManyOptions<LockEvent>]>(() =>
      Promise.resolve([]),
    ),
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
      from: '2026-06-01T00:00:00.000Z',
      to: '2026-06-23T23:59:59.999Z',
    });

    const findOptions = repository.find.mock.calls[0][0];
    const where = findOptions.where as {
      terminalId: string;
      status: LockEventStatus;
      occurredAt: FindOperator<Date>;
    };

    expect(where.terminalId).toBe('8034400004');
    expect(where.status).toBe(LockEventStatus.Unread);
    expect(where.occurredAt.type).toBe('between');
    expect(findOptions.order).toEqual({ occurredAt: 'DESC' });
    expect(findOptions.take).toBe(100);
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
