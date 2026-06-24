import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Geofence } from '../geofences/geofence.entity';
import { GeofenceDeviceState } from '../geofences/geofence-device-state.entity';
import { GeofenceTransition } from '../geofences/geofence-transition.entity';
import { LockEventsModule } from '../lock-events/lock-events.module';
import { LockConfigurationsModule } from '../lock-configurations/lock-configurations.module';
import { LocksModule } from '../locks/locks.module';
import { PositionsModule } from '../positions/positions.module';
import { RfidCard } from '../rfid/rfid-card.entity';
import { TcpGatewayService } from './tcp-gateway.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      Geofence,
      GeofenceDeviceState,
      GeofenceTransition,
      RfidCard,
    ]),
    LockEventsModule,
    forwardRef(() => LockConfigurationsModule),
    LocksModule,
    PositionsModule,
  ],
  providers: [TcpGatewayService],
  exports: [TcpGatewayService],
})
export class TcpModule {}
