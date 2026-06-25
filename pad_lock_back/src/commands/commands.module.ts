import { Module } from '@nestjs/common';
import { TcpModule } from '../tcp/tcp.module';
import { CommandsController } from './commands.controller';
import { CommandsService } from './commands.service';

@Module({
  imports: [TcpModule],
  controllers: [CommandsController],
  providers: [CommandsService],
})
export class CommandsModule {}
