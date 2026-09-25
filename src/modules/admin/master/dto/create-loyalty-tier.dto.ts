import {
  IsString,
  IsNumber,
  IsOptional,
  IsIn,
} from "class-validator";

export class CreateLoyaltyTierDto {

  @IsString()
  tier_name?: string;

  @IsNumber()
  min_points?: number;

  @IsNumber()
  max_points?: number;

  @IsNumber()
  discount_percentage?: number;

  @IsNumber()
  bonus_percentage?: number;

  @IsNumber()
  validity_days?: number;

  @IsOptional()
  @IsIn([0, 1])
  status?: number;
}