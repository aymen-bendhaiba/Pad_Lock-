import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LocksModule } from '../locks/locks.module';
import { TcpModule } from '../tcp/tcp.module';
import { LockConfiguration } from './lock-configuration.entity';
import { LockConfigurationsController } from './lock-configurations.controller';
import { LockConfigurationsService } from './lock-configurations.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([LockConfiguration]),
    LocksModule,
    forwardRef(() => TcpModule),
  ],
  controllers: [LockConfigurationsController],
  providers: [LockConfigurationsService],
  exports: [LockConfigurationsService],
})
export class LockConfigurationsModule {}
