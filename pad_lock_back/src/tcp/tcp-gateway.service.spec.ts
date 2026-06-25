import { BadRequestException } from '@nestjs/common';
import {
  Geofence,
  GeofenceAccessMode,
  GeofenceShapeType,
} from '../geofences/geofence.entity';
import { RfidCardRole, RfidCardSyncStatus } from '../rfid/rfid-card.entity';
import { TcpGatewayService } from './tcp-gateway.service';

function geofence(accessMode: GeofenceAccessMode): Geofence {
  return {
    id: 'geofence-1',
    name: 'Test geofence',
    terminalIds: ['8034400004'],
    geoBoundaryId: null,
    shapeType: GeofenceShapeType.Circle,
    coordinates: [{ lat: 33, lng: -7 }],
    radiusMeters: 100,
    applyInside: accessMode === GeofenceAccessMode.AllowInside,
    accessMode,
    rules: {
      smsAllowed: true,
      gprsAllowed: true,
      rfidAllowed: true,
      serialAllowed: true,
      bluetoothAllowed: true,
      lockAccessAllowed: true,
    },
    createdAt: new Date(),
  };
}

function serviceFixture(input: {
  geofences?: Geofence[];
  cards?: Array<{
    cardNumber: string;
    installedOnLock: boolean;
  }>;
}) {
  const rfidCardsRepository = {
    find: jest.fn().mockResolvedValue(
      (input.cards ?? []).map((card) => ({
        id: `card-${card.cardNumber}`,
        lockDeviceId: 'lock-1',
        cardNumber: card.cardNumber,
        role: RfidCardRole.Limited,
        active: true,
        installedOnLock: card.installedOnLock,
        lastSyncStatus: RfidCardSyncStatus.Synced,
      })),
    ),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const geofencesRepository = {
    find: jest.fn().mockResolvedValue(input.geofences ?? []),
  };
  const service = new TcpGatewayService(
    { getOrThrow: jest.fn() },
    {} as never,
    {} as never,
    {
      findByTerminalIdOrFail: jest
        .fn()
        .mockResolvedValue({ id: 'lock-1', terminalId: '8034400004' }),
    } as never,
    { retryPendingForLock: jest.fn() } as never,
    {} as never,
    geofencesRepository as never,
    {
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((value: unknown): unknown => value),
      save: jest.fn((value: unknown) => Promise.resolve<unknown>(value)),
    } as never,
    {
      create: jest.fn((value: unknown): unknown => value),
      save: jest.fn((value: unknown) => Promise.resolve<unknown>(value)),
    } as never,
    rfidCardsRepository as never,
  );

  const sendRfidCommandMock = jest
    .spyOn(service, 'sendRfidCommand')
    .mockResolvedValue({
      success: true,
      opType: 1,
      count: 1,
      cards: ['1234567890'],
    });

  return { service, rfidCardsRepository, sendRfidCommandMock };
}

describe('TcpGatewayService RFID geofence enforcement', () => {
  it('removes installed limited cards when access is blocked inside allow_outside geofence', async () => {
    const { service, rfidCardsRepository, sendRfidCommandMock } =
      serviceFixture({
        geofences: [geofence(GeofenceAccessMode.AllowOutside)],
        cards: [{ cardNumber: '1234567890', installedOnLock: true }],
      });

    await service['applyRfidGeofenceEnforcement']('8034400004', 33, -7);

    expect(sendRfidCommandMock).toHaveBeenCalledWith(
      '8034400004',
      '(P41,1,2,1,1234567890)',
    );
    expect(rfidCardsRepository.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ lockDeviceId: 'lock-1' }),
      expect.objectContaining({
        installedOnLock: false,
        lastSyncStatus: RfidCardSyncStatus.Synced,
      }),
    );
  });

  it('restores limited cards when access becomes allowed again', async () => {
    const { service, sendRfidCommandMock } = serviceFixture({
      geofences: [geofence(GeofenceAccessMode.AllowInside)],
      cards: [{ cardNumber: '1234567890', installedOnLock: false }],
    });

    await service['applyRfidGeofenceEnforcement']('8034400004', 33, -7);

    expect(sendRfidCommandMock).toHaveBeenCalledWith(
      '8034400004',
      '(P41,1,1,1,1234567890)',
    );
  });

  it('does not remove admin cards because only limited cards are selected', async () => {
    const { service, sendRfidCommandMock } = serviceFixture({
      geofences: [geofence(GeofenceAccessMode.AllowOutside)],
      cards: [],
    });

    await service['applyRfidGeofenceEnforcement']('8034400004', 33, -7);

    expect(sendRfidCommandMock).not.toHaveBeenCalled();
  });

  it('marks offline delete sync as pending instead of failed', async () => {
    const { service, rfidCardsRepository, sendRfidCommandMock } =
      serviceFixture({
        geofences: [geofence(GeofenceAccessMode.AllowOutside)],
        cards: [{ cardNumber: '1234567890', installedOnLock: true }],
      });
    sendRfidCommandMock.mockRejectedValue(
      new BadRequestException('Lock is not connected'),
    );

    await service['applyRfidGeofenceEnforcement']('8034400004', 33, -7);

    expect(rfidCardsRepository.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ lockDeviceId: 'lock-1' }),
      expect.objectContaining({
        lastSyncStatus: RfidCardSyncStatus.PendingDelete,
      }),
    );
  });

  it('does not send duplicate delete commands when a blocked card is already removed', async () => {
    const { service, sendRfidCommandMock } = serviceFixture({
      geofences: [geofence(GeofenceAccessMode.AllowOutside)],
      cards: [{ cardNumber: '1234567890', installedOnLock: false }],
    });

    await service['applyRfidGeofenceEnforcement']('8034400004', 33, -7);

    expect(sendRfidCommandMock).not.toHaveBeenCalled();
  });
});
