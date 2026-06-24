import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { RfidCardRole } from '../rfid-card.entity';

export class RfidCardsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Matches(/^\d{10}$/, { each: true })
  cards: string[];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @IsEnum(RfidCardRole)
  role?: RfidCardRole;
}

export class UpdateRfidCardRoleDto {
  @IsEnum(RfidCardRole)
  role: RfidCardRole;
}
