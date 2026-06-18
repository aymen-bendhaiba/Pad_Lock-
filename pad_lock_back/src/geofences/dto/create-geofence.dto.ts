import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsLatitude,
  IsLongitude,
  IsObject,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class GeofenceCoordinateDto {
  @IsLatitude()
  lat: number;

  @IsLongitude()
  lng: number;
}

class GeofenceRulesDto {
  @IsBoolean()
  smsAllowed: boolean;

  @IsBoolean()
  gprsAllowed: boolean;

  @IsBoolean()
  rfidAllowed: boolean;

  @IsBoolean()
  serialAllowed: boolean;

  @IsBoolean()
  bluetoothAllowed: boolean;
}

export class CreateGeofenceDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsArray()
  @ArrayMinSize(3)
  @ValidateNested({ each: true })
  @Type(() => GeofenceCoordinateDto)
  coordinates: GeofenceCoordinateDto[];

  @IsBoolean()
  applyInside: boolean;

  @IsObject()
  @ValidateNested()
  @Type(() => GeofenceRulesDto)
  rules: GeofenceRulesDto;
}
