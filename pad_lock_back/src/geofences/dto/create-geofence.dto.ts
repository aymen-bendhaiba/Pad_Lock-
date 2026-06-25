import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GeofenceAccessMode, GeofenceShapeType } from '../geofence.entity';
import { CreateGeofenceRulesDto } from './geofence-rules.dto';

class GeofenceCoordinateDto {
  @IsLatitude()
  lat: number;

  @IsLongitude()
  lng: number;
}

export class CreateGeofenceDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @MaxLength(32, { each: true })
  @IsOptional()
  terminalIds?: string[];

  @IsEnum(GeofenceShapeType)
  shapeType: GeofenceShapeType;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GeofenceCoordinateDto)
  coordinates: GeofenceCoordinateDto[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  radiusMeters?: number;

  @IsOptional()
  @IsBoolean()
  applyInside?: boolean;

  @IsEnum(GeofenceAccessMode)
  accessMode: GeofenceAccessMode;

  @IsObject()
  @ValidateNested()
  @Type(() => CreateGeofenceRulesDto)
  rules: CreateGeofenceRulesDto;
}
