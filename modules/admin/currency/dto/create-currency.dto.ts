import { IsString, IsOptional, IsBoolean, IsNumber } from "class-validator";

export class CreateCurrencyDto {

  @IsString()
  code?: string;

  @IsString()
  name?: string;

  @IsString()
  symbol?: string;

  @IsNumber()
  exchange_rate?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsString()
  created_by?: string;

}