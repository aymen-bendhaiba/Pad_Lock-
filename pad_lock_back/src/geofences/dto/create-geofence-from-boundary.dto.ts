import {
  IsEnum,
  IsObject,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GeofenceAccessMode } from '../geofence.entity';
import { CreateGeofenceRulesDto } from './geofence-rules.dto';

export class CreateGeofenceFromBoundaryDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsUUID()
  geoBoundaryId: string;

  @IsEnum(GeofenceAccessMode)
  accessMode: GeofenceAccessMode;

  @IsObject()
  @ValidateNested()
  @Type(() => CreateGeofenceRulesDto)
  rules: CreateGeofenceRulesDto;
}
