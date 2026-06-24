import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { LockEventStatus } from '../lock-event.entity';

export class FindAlertsQueryDto {
  @IsOptional()
  @IsString()
  terminalId?: string;

  @IsOptional()
  @IsEnum(LockEventStatus)
  status?: LockEventStatus;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
