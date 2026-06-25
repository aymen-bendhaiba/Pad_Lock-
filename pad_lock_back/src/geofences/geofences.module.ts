import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GeoBoundariesModule } from '../geo-boundaries/geo-boundaries.module';
import { LockDevice } from '../locks/lock-device.entity';
import { PositionsModule } from '../positions/positions.module';
import { RfidCard } from '../rfid/rfid-card.entity';
import { TcpModule } from '../tcp/tcp.module';
import { Geofence } from './geofence.entity';
import { GeofencesController } from './geofences.controller';
import { GeofencesService } from './geofences.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Geofence, RfidCard, LockDevice]),
    GeoBoundariesModule,
    TcpModule,
    PositionsModule,
  ],
  controllers: [GeofencesController],
  providers: [GeofencesService],
})
export class GeofencesModule {}
