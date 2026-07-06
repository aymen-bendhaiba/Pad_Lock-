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
import { TcpConnectionsModule } from './tcp-connections.module';
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
    TcpConnectionsModule,
    forwardRef(() => LockConfigurationsModule),
    LocksModule,
    forwardRef(() => PositionsModule),
  ],
  providers: [TcpGatewayService],
  exports: [TcpConnectionsModule, TcpGatewayService],
})
export class TcpModule {}
