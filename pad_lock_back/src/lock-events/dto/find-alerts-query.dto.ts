import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  LockEventSeverity,
  LockEventStatus,
  LockEventType,
} from '../lock-event.entity';

export class FindAlertsQueryDto {
  @IsOptional()
  @IsString()
  terminalId?: string;

  @IsOptional()
  @IsEnum(LockEventStatus)
  status?: LockEventStatus;

  @IsOptional()
  @IsEnum(LockEventType)
  type?: LockEventType;

  @IsOptional()
  @IsEnum(LockEventSeverity)
  severity?: LockEventSeverity;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 100;
}
