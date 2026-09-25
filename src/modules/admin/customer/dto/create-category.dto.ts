import { IsBoolean, IsOptional, IsString, IsNumber} from "class-validator";
import { Transform } from "class-transformer";

export class CreateCategoryDto {
  @IsString()
  name?: string;

  @IsNumber()
  @Transform(({ value }) => Number(value))
  category?: number;

  @IsOptional()
  @IsString()
  frontImage?: string;

  @IsOptional()
  @IsString()
  backImage?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  status?: boolean;
}