// dto/loyalty-point-master-item.dto.ts

import {
  IsNumber,
} from "class-validator";

export class LoyaltyPointMasterItemDto {

  @IsNumber()
  category_id?: number;

  @IsNumber()
  points?: number;

  @IsNumber()
  max_points?: number;
  
  @IsNumber()
  active?: number;
}