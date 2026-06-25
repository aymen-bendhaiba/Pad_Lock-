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
} from '../../lock-events/lock-event.entity';

export enum ReportGroupBy {
  Day = 'day',
  Week = 'week',
  Month = 'month',
}

export enum UnlockMethod {
  Rfid = 'rfid',
  StaticPassword = 'static_password',
  DynamicPassword = 'dynamic_password',
  Bluetooth = 'bluetooth',
  Other = 'other',
}

export class ReportQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  terminalId?: string;

  @IsOptional()
  @IsEnum(ReportGroupBy)
  groupBy: ReportGroupBy = ReportGroupBy.Day;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 50;
}

export class AlertsReportQueryDto extends ReportQueryDto {
  @IsOptional()
  @IsEnum(LockEventType)
  type?: LockEventType;

  @IsOptional()
  @IsEnum(LockEventSeverity)
  severity?: LockEventSeverity;

  @IsOptional()
  @IsEnum(LockEventStatus)
  status?: LockEventStatus;
}

export class GeofencesReportQueryDto extends ReportQueryDto {
  @IsOptional()
  @IsString()
  geofenceId?: string;
}

export class UnlocksReportQueryDto extends ReportQueryDto {
  @IsOptional()
  @IsString()
  geofenceId?: string;

  @IsOptional()
  @IsEnum(UnlockMethod)
  method?: UnlockMethod;
}

export class MileageReportQueryDto extends ReportQueryDto {}

export class BatteryReportQueryDto extends ReportQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  below?: number;
}

/** Shared query params for the lightweight GET /api/reports summary endpoint. */
export class ReportSummaryQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  terminalId?: string;

  @IsOptional()
  @IsEnum(ReportGroupBy)
  groupBy: ReportGroupBy = ReportGroupBy.Day;
}
