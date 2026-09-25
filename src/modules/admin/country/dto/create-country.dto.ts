import { IsString, IsBoolean, IsOptional } from "class-validator";

export class CreateCountryDto {

  @IsString()
  name?: string;

  @IsString()
  iso_code?: string;

  @IsString()
  phone_code?: string;

  @IsString()
  currency_code?: string;

  @IsBoolean()
  @IsOptional()
  status?: boolean;
}