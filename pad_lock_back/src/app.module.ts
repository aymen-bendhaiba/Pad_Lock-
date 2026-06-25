import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { CommandsModule } from './commands/commands.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { databaseConfig } from './database/database.config';
import { GeofencesModule } from './geofences/geofences.module';
import { GeoBoundariesModule } from './geo-boundaries/geo-boundaries.module';
import { validateEnv } from './config/env.validation';
import { LockEventsModule } from './lock-events/lock-events.module';
import { LockConfigurationsModule } from './lock-configurations/lock-configurations.module';
import { LocksModule } from './locks/locks.module';
import { PositionsModule } from './positions/positions.module';
import { RfidModule } from './rfid/rfid.module';
import { TcpModule } from './tcp/tcp.module';
import { UsersModule } from './users/users.module';
import { RetentionModule } from './retention/retention.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    TypeOrmModule.forRootAsync(databaseConfig),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 120,
      },
    ]),
    UsersModule,
    AuthModule,
    LocksModule,
    TcpModule,
    RfidModule,
    LockEventsModule,
    LockConfigurationsModule,
    PositionsModule,
    GeoBoundariesModule,
    GeofencesModule,
    CommandsModule,
    DashboardModule,
    RetentionModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
