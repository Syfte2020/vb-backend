import {
  IsString, IsEmail, IsOptional, IsInt, IsIn,
  IsArray, IsBoolean, IsObject, ArrayNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AddTeamMemberDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  contactMethod?: string;

  @IsInt()
  @Type(() => Number) // coerces "6" -> 6 if it ever arrives as a string
  role?: number;

  @IsOptional()
  @IsBoolean()
  loginAccess?: boolean;

  @IsIn(['all', 'selected'])
  venueAccess?: 'all' | 'selected';

  @IsOptional()
  @IsArray()
  venues?: string[];

  @IsOptional()
  @IsObject()
  permissions?: Record<string, string[]>;
}