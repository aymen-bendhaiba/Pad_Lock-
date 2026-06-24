import { Type } from 'class-transformer';
import {
  IsInt,
  IsObject,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class UpdateSimConfigurationDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  @Matches(/^[^,()\s]+$/, {
    message: 'ipAddress cannot contain spaces, commas, or parentheses',
  })
  ipAddress?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(65530)
  port?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  @Matches(/^[^,()]+$/, {
    message: 'apn cannot contain commas or parentheses',
  })
  apn?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(50)
  @Matches(/^[^,()]*$/, {
    message: 'apnUser cannot contain commas or parentheses',
  })
  apnUser?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(50)
  @Matches(/^[^,()]*$/, {
    message: 'apnPassword cannot contain commas or parentheses',
  })
  apnPassword?: string;
}

export class UpdateLockConfigurationDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => UpdateSimConfigurationDto)
  sim1?: UpdateSimConfigurationDto;

  @ValidateIf((_object, value) => value !== undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => UpdateSimConfigurationDto)
  sim2?: UpdateSimConfigurationDto;

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(5)
  @Max(600)
  trackingUploadIntervalSeconds?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(5)
  @Max(1440)
  wakeUpIntervalMinutes?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(500)
  vibrationLevelMg?: number;
}
