import { IsOptional, IsString, IsArray, IsNumber } from "class-validator";
import { Type } from "class-transformer";

export class CreatePropertyTagDto {
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsString()
  video?: string;

  /*
  |--------------------------------------------------------------------------
  | STAT JSON
  |--------------------------------------------------------------------------
  */
  @IsOptional()
  stat?: {
    hosts?: string;
    guests?: string;
    time?: string;
  };

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  type?: string;

  /*
  |--------------------------------------------------------------------------
  | COUNTRY IDS (IMPORTANT ADDITION)
  |--------------------------------------------------------------------------
  */

  @IsOptional()
  @IsArray()
  @Type(() => Number)
  country_ids?: number[];
}