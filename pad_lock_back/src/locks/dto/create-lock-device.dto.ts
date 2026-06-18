import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateLockDeviceDto {
  @IsString()
  @Matches(/^[A-Za-z0-9]{4,32}$/)
  terminalId: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{14,17}$/)
  imei?: string;
}
