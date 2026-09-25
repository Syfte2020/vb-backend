import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';
import { MEMBER_STATUSES, ROLE_IDS } from '../constants/team.constants';

export class UpdateMemberDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsIn(ROLE_IDS as unknown as string[])
  role?: string;

  @IsOptional()
  @IsIn(MEMBER_STATUSES as unknown as string[])
  status?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  venueIds?: string[];

  @IsOptional()
  @IsBoolean()
  loginAccess?: boolean;

  /** Whether masking is turned on for this user at all (user_roles.mask_data). */
  @IsOptional()
  @IsBoolean()
  masked?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  maskedFields?: string[];
}
