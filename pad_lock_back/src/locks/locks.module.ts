import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TcpConnectionsModule } from '../tcp/tcp-connections.module';
import { LockDevice } from './lock-device.entity';
import { LocksController } from './locks.controller';
import { LocksService } from './locks.service';

@Module({
  imports: [TypeOrmModule.forFeature([LockDevice]), TcpConnectionsModule],
  controllers: [LocksController],
  providers: [LocksService],
  exports: [LocksService],
})
export class LocksModule {}
