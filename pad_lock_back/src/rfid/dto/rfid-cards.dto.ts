import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

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
}
