import {
  IsNotEmpty,
  IsOptional,
} from "class-validator";

export class CreateEventTagDto {

  @IsNotEmpty()
  name?: string;

  @IsOptional()
  icon?: string;

  @IsOptional()
  image?: string;

  @IsOptional()
  status?: string;
}