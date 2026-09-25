import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ROLE_IDS } from '../constants/team.constants';
import type { ActionKey, ModuleKey } from '../constants/team.constants';

class ModulePermissionsDto {
  [moduleKey: string]: ActionKey[];
}

export class CreateMemberDto {
  @IsNotEmpty()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsIn(['email', 'whatsapp', 'phone'])
  contactMethod?: 'email' | 'whatsapp' | 'phone';

  @IsIn(ROLE_IDS as unknown as string[])
  role?: string;

  /** 'all' | 'selected' | 'category' — from Step 3 of the wizard */
  @IsIn(['all', 'selected', 'category'])
  venueAccess?: 'all' | 'selected' | 'category';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  venueIds?: string[];

  @IsBoolean()
  loginAccess?: boolean;

  /** Per-module action overrides, pre-filled from the role default on the client. */
  @IsOptional()
  @ValidateNested()
  @Type(() => ModulePermissionsDto)
  permissions?: Record<ModuleKey, ActionKey[]>;
}