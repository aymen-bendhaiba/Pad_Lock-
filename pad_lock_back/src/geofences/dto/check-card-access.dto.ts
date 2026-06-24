import { IsString, Matches } from 'class-validator';

export class CheckCardAccessDto {
  @IsString()
  @Matches(/^\d{10}$/)
  cardNumber: string;
}
