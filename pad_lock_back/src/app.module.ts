import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { CommandsModule } from './commands/commands.module';
import { databaseConfig } from './database/database.config';
import { GeofencesModule } from './geofences/geofences.module';
import { validateEnv } from './config/env.validation';
import { LockEventsModule } from './lock-events/lock-events.module';
import { LocksModule } from './locks/locks.module';
import { PositionsModule } from './positions/positions.module';
import { RfidModule } from './rfid/rfid.module';
import { TcpModule } from './tcp/tcp.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    TypeOrmModule.forRootAsync(databaseConfig),
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
    PositionsModule,
    GeofencesModule,
    CommandsModule,
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
