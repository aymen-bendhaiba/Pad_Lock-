import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  Geofence,
  GeofenceAccessMode,
  GeofenceShapeType,
} from './geofence.entity';
import { GeofencesService } from './geofences.service';

function geofence(): Geofence {
  return {
    id: 'geofence-1',
    name: 'Warehouse',
    terminalIds: ['8034400004'],
    geoBoundaryId: null,
    shapeType: GeofenceShapeType.Circle,
    coordinates: [{ lat: 33.594, lng: -7.62 }],
    radiusMeters: 250,
    applyInside: true,
    accessMode: GeofenceAccessMode.AllowInside,
    rules: {
      smsAllowed: true,
      gprsAllowed: true,
      rfidAllowed: true,
      serialAllowed: true,
      bluetoothAllowed: true,
      lockAccessAllowed: true,
    },
    createdAt: new Date('2026-06-25T00:00:00.000Z'),
  };
}

function fixture(existing: Geofence | null = geofence()) {
  const repository = {
    find: jest.fn().mockResolvedValue(existing ? [existing] : []),
    findOneBy: jest.fn().mockResolvedValue(existing),
    create: jest.fn((value: Geofence) => value),
    save: jest.fn((value: Geofence) => Promise.resolve(value)),
  };
  const locksRepository = {
    find: jest.fn().mockResolvedValue([{ terminalId: '8034400004' }]),
  };
  const service = new GeofencesService(
    repository as never,
    {} as never,
    locksRepository as never,
    {} as never,
    {} as never,
    {} as never,
  );

  return { service, repository };
}

describe('GeofencesService update', () => {
  it('creates an unassigned geofence when terminalIds is omitted', async () => {
    const { service, repository } = fixture();

    await service.create({
      name: 'Unassigned warehouse',
      shapeType: GeofenceShapeType.Circle,
      coordinates: [{ lat: 33.594, lng: -7.62 }],
      radiusMeters: 250,
      accessMode: GeofenceAccessMode.AllowInside,
      rules: {
        smsAllowed: true,
        gprsAllowed: true,
        rfidAllowed: true,
        serialAllowed: true,
        bluetoothAllowed: true,
        lockAccessAllowed: true,
      },
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ terminalIds: [] }),
    );
  });

  it('updates access mode and keeps legacy applyInside aligned', async () => {
    const { service } = fixture();

    const updated = await service.update('geofence-1', {
      accessMode: GeofenceAccessMode.AllowOutside,
    });

    expect(updated.accessMode).toBe(GeofenceAccessMode.AllowOutside);
    expect(updated.applyInside).toBe(false);
  });

  it('merges partial checkbox rules without resetting other rules', async () => {
    const { service } = fixture();

    const updated = await service.update('geofence-1', {
      rules: {
        lockAccessAllowed: false,
      },
    });

    expect(updated.rules).toEqual({
      smsAllowed: true,
      gprsAllowed: true,
      rfidAllowed: true,
      serialAllowed: true,
      bluetoothAllowed: true,
      lockAccessAllowed: false,
    });
  });

  it('reassigns a geofence to validated lock terminal IDs', async () => {
    const { service } = fixture();

    const updated = await service.update('geofence-1', {
      terminalIds: ['8034400004'],
    });

    expect(updated.terminalIds).toEqual(['8034400004']);
  });

  it('validates the final shape after partial geometry updates', async () => {
    const existing = geofence();
    existing.shapeType = GeofenceShapeType.Polygon;
    existing.coordinates = [
      { lat: 33.594, lng: -7.62 },
      { lat: 33.595, lng: -7.62 },
      { lat: 33.595, lng: -7.619 },
    ];
    const { service } = fixture(existing);

    await expect(
      service.update('geofence-1', {
        coordinates: [
          { lat: 33.594, lng: -7.62 },
          { lat: 33.595, lng: -7.62 },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects empty patches and unknown geofences', async () => {
    const { service } = fixture();
    await expect(service.update('geofence-1', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );

    const missing = fixture(null);
    await expect(
      missing.service.update('missing', {
        accessMode: GeofenceAccessMode.AllowOutside,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
