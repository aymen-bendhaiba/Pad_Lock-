import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LockEvent } from '../lock-events/lock-event.entity';
import { LockPosition } from '../positions/lock-position.entity';
import { GeofenceTransition } from '../geofences/geofence-transition.entity';
import { RetentionService } from './retention.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([LockEvent, LockPosition, GeofenceTransition]),
  ],
  providers: [RetentionService],
})
export class RetentionModule {}
