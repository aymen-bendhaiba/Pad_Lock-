import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LocksModule } from '../locks/locks.module';
import { PositionsModule } from '../positions/positions.module';
import { LockEvent } from './lock-event.entity';
import { LockEventsController } from './lock-events.controller';
import { LockEventsService } from './lock-events.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([LockEvent]),
    LocksModule,
    PositionsModule,
  ],
  controllers: [LockEventsController],
  providers: [LockEventsService],
  exports: [LockEventsService],
})
export class LockEventsModule {}
