import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LocksModule } from '../locks/locks.module';
import { TcpConnectionsModule } from '../tcp/tcp-connections.module';
import { LockPosition } from './lock-position.entity';
import { PositionsController } from './positions.controller';
import { PositionsService } from './positions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([LockPosition]),
    LocksModule,
    TcpConnectionsModule,
  ],
  controllers: [PositionsController],
  providers: [PositionsService],
  exports: [PositionsService],
})
export class PositionsModule {}
