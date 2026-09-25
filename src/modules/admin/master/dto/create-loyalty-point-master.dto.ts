import {
  IsArray,
  ValidateNested,
  ArrayNotEmpty,
  IsNotEmpty,
} from "class-validator";

import { Type } from "class-transformer";

import { LoyaltyPointMasterItemDto } from "./loyalty-point-master-item.dto";

export class CreateLoyaltyPointMasterDto {

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => LoyaltyPointMasterItemDto)
  data?: LoyaltyPointMasterItemDto[];
}