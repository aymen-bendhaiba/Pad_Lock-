import {
  IsDateString,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { LockEventSeverity, LockEventType } from '../lock-event.entity';

export class CreateLockEventDto {
  @IsEnum(LockEventType)
  type: LockEventType;

  @IsOptional()
  @IsEnum(LockEventSeverity)
  severity?: LockEventSeverity;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  source?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{10}$/)
  rfidCardNumber?: string;

  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @IsObject()
  rawPayload?: Record<string, unknown>;

  @IsDateString()
  occurredAt: string;
}
