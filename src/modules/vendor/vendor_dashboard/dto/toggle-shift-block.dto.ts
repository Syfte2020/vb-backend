import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class ToggleShiftBlockDto {
  @IsDateString()
  date?: string;

  @IsString()
  @MaxLength(255)
  shiftKey?: string;

  @IsBoolean()
  blocked?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}