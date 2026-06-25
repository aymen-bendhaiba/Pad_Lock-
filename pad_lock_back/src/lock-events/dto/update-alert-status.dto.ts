import { IsEnum } from 'class-validator';
import { LockEventStatus } from '../lock-event.entity';

export class UpdateAlertStatusDto {
  @IsEnum(LockEventStatus)
  status: LockEventStatus;
}
