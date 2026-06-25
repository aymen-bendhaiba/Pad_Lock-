import { IsInt, Max, Min } from 'class-validator';

export class RfidGroupParamDto {
  @IsInt()
  @Min(1)
  @Max(25)
  group: number;
}
