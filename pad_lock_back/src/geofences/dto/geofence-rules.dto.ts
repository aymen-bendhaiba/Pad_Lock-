import { IsBoolean } from 'class-validator';

export class CreateGeofenceRulesDto {
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

  @IsBoolean()
  lockAccessAllowed: boolean;
}
