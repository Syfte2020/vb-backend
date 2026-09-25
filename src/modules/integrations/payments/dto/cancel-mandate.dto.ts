import { IsInt, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class CancelMandateDto {
  @IsInt()
  @IsPositive()
  mandateId: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
