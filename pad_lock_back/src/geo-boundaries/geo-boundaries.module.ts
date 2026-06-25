import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GeoBoundariesController } from './geo-boundaries.controller';
import { GeoBoundary } from './geo-boundary.entity';
import { GeoBoundariesService } from './geo-boundaries.service';

@Module({
  imports: [TypeOrmModule.forFeature([GeoBoundary])],
  controllers: [GeoBoundariesController],
  providers: [GeoBoundariesService],
  exports: [GeoBoundariesService],
})
export class GeoBoundariesModule {}
