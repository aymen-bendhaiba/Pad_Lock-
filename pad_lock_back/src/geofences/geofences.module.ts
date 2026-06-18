import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TcpModule } from '../tcp/tcp.module';
import { Geofence } from './geofence.entity';
import { GeofencesController } from './geofences.controller';
import { GeofencesService } from './geofences.service';

@Module({
  imports: [TypeOrmModule.forFeature([Geofence]), TcpModule],
  controllers: [GeofencesController],
  providers: [GeofencesService],
})
export class GeofencesModule {}
