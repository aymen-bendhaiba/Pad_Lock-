import { Module } from '@nestjs/common';
import { TcpConnectionsModule } from '../tcp/tcp-connections.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [TcpConnectionsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
