import { Module } from '@nestjs/common';
import { LocksModule } from '../locks/locks.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [LocksModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
