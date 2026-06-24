import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';
import { Geofence } from '../geofences/geofence.entity';
import { GeofenceDeviceState } from '../geofences/geofence-device-state.entity';
import { GeofenceTransition } from '../geofences/geofence-transition.entity';
import { GeoBoundary } from '../geo-boundaries/geo-boundary.entity';
import { LockEvent } from '../lock-events/lock-event.entity';
import { LockConfiguration } from '../lock-configurations/lock-configuration.entity';
import { LockDevice } from '../locks/lock-device.entity';
import { LockPosition } from '../positions/lock-position.entity';
import { RfidCard } from '../rfid/rfid-card.entity';
import { User } from '../users/user.entity';

export const databaseConfig: TypeOrmModuleAsyncOptions = {
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const common = {
      type: 'postgres' as const,
      ssl: config.get<boolean>('DB_SSL')
        ? {
            rejectUnauthorized: false,
          }
        : false,
      entities: [
        User,
        LockDevice,
        RfidCard,
        LockEvent,
        LockConfiguration,
        LockPosition,
        Geofence,
        GeofenceDeviceState,
        GeofenceTransition,
        GeoBoundary,
      ],
      synchronize: config.getOrThrow<boolean>('DB_SYNCHRONIZE'),
    };
    const databaseUrl = config.get<string>('DATABASE_URL');

    if (databaseUrl) {
      return {
        ...common,
        url: databaseUrl,
      };
    }

    return {
      ...common,
      host: config.getOrThrow<string>('DB_HOST'),
      port: config.getOrThrow<number>('DB_PORT'),
      username: config.getOrThrow<string>('DB_USER'),
      password: config.getOrThrow<string>('DB_PASSWORD'),
      database: config.getOrThrow<string>('DB_NAME'),
    };
  },
};
