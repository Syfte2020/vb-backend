import { PartialType } from "@nestjs/mapped-types";
import { CreateLoyaltyPointMasterDto } from "./create-loyalty-point-master.dto";

export class UpdatePointMasterDto extends PartialType(
  CreateLoyaltyPointMasterDto,
) {}