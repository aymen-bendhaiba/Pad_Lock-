import { IsBoolean, IsString, Matches } from 'class-validator';

export class UnlockChannelsDto {
  @IsBoolean()
  sms: boolean;

  @IsBoolean()
  gprs: boolean;

  @IsBoolean()
  rfid: boolean;

  @IsBoolean()
  serial: boolean;

  @IsBoolean()
  bluetooth: boolean;
}

export class SetUnlockChannelsDto extends UnlockChannelsDto {
  @IsString()
  @Matches(/^[A-Za-z0-9]{4,32}$/)
  terminalId: string;
}
