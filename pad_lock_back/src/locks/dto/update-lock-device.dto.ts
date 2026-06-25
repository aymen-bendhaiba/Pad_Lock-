import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { LockDeviceStatus } from '../lock-device.entity';

export class UpdateLockDeviceDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{14,17}$/)
  imei?: string;

  @IsOptional()
  @IsEnum(LockDeviceStatus)
  status?: LockDeviceStatus;
}
