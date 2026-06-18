import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Geofence } from '../geofences/geofence.entity';
import { LockEventsModule } from '../lock-events/lock-events.module';
import { LocksModule } from '../locks/locks.module';
import { PositionsModule } from '../positions/positions.module';
import { TcpGatewayService } from './tcp-gateway.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Geofence]),
    LockEventsModule,
    LocksModule,
    PositionsModule,
  ],
  providers: [TcpGatewayService],
  exports: [TcpGatewayService],
})
export class TcpModule {}
