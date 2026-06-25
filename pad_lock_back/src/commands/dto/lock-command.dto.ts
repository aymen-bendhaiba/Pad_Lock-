import {
  IsBoolean,
  IsInt,
  IsPhoneNumber,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class TerminalIdDto {
  @IsString()
  @Matches(/^[A-Za-z0-9]{4,32}$/)
  terminalId: string;
}

export class UnlockDto extends TerminalIdDto {
  @IsString()
  @MinLength(4)
  password: string;
}

export class BatteryThresholdDto extends TerminalIdDto {
  @IsInt()
  @Min(0)
  @Max(90)
  threshold: number;
}

export class ModifyPasswordDto extends TerminalIdDto {
  @IsString()
  @MinLength(4)
  currentPassword: string;

  @IsString()
  @MinLength(4)
  newPassword: string;
}

export class DeepSleepDto extends TerminalIdDto {
  @IsBoolean()
  enabled: boolean;

  @IsInt()
  @Min(0)
  threshold: number;
}

export class VipPhoneDto extends TerminalIdDto {
  @IsInt()
  @Min(1)
  @Max(5)
  index: number;

  @IsPhoneNumber()
  phoneNumber: string;
}

export class VipSmsDto extends TerminalIdDto {
  @IsInt()
  @Min(0)
  @Max(1)
  vip1: number;

  @IsInt()
  @Min(0)
  @Max(1)
  vip2: number;

  @IsInt()
  @Min(0)
  @Max(1)
  vip3: number;

  @IsInt()
  @Min(0)
  @Max(1)
  vip4: number;

  @IsInt()
  @Min(0)
  @Max(1)
  vip5: number;
}
