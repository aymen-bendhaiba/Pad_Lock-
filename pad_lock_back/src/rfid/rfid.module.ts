import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LocksModule } from '../locks/locks.module';
import { TcpModule } from '../tcp/tcp.module';
import { RfidCard } from './rfid-card.entity';
import { RfidController } from './rfid.controller';
import { RfidService } from './rfid.service';

@Module({
  imports: [TypeOrmModule.forFeature([RfidCard]), LocksModule, TcpModule],
  controllers: [RfidController],
  providers: [RfidService],
})
export class RfidModule {}
