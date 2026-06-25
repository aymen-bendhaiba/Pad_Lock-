import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsObject,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { GeofenceAccessMode, GeofenceShapeType } from '../geofence.entity';

class UpdateGeofenceCoordinateDto {
  @IsLatitude()
  lat: number;

  @IsLongitude()
  lng: number;
}

export class UpdateGeofenceRulesDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  smsAllowed?: boolean;

  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  gprsAllowed?: boolean;

  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  rfidAllowed?: boolean;

  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  serialAllowed?: boolean;

  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  bluetoothAllowed?: boolean;

  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  lockAccessAllowed?: boolean;
}

export class UpdateGeofenceDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(120)
  name?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @MaxLength(32, { each: true })
  terminalIds?: string[];

  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(GeofenceShapeType)
  shapeType?: GeofenceShapeType;

  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateGeofenceCoordinateDto)
  coordinates?: UpdateGeofenceCoordinateDto[];

  @ValidateIf((_object, value) => value !== undefined)
  @IsNumber()
  @Min(1)
  radiusMeters?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(GeofenceAccessMode)
  accessMode?: GeofenceAccessMode;

  @ValidateIf((_object, value) => value !== undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => UpdateGeofenceRulesDto)
  rules?: UpdateGeofenceRulesDto;
}
