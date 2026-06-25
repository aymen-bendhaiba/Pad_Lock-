import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
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

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @MaxLength(32, { each: true })
  @IsOptional()
  terminalIds?: string[];

  @IsUUID()
  geoBoundaryId: string;

  @IsEnum(GeofenceAccessMode)
  accessMode: GeofenceAccessMode;

  @IsObject()
  @ValidateNested()
  @Type(() => CreateGeofenceRulesDto)
  rules: CreateGeofenceRulesDto;
}
