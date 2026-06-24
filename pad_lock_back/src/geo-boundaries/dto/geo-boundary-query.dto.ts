import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { GeoBoundaryType } from '../geo-boundary.entity';

export class GeoBoundaryQueryDto {
  @IsOptional()
  @IsEnum(GeoBoundaryType)
  type?: GeoBoundaryType;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  countryCode?: string;

  @IsOptional()
  @IsString()
  continent?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
