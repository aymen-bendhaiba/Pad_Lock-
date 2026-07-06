import { Module } from '@nestjs/common';
import { TcpConnectionsService } from './tcp-connections.service';

@Module({
  providers: [TcpConnectionsService],
  exports: [TcpConnectionsService],
})
export class TcpConnectionsModule {}
