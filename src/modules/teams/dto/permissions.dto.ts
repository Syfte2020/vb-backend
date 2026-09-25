import {
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

import { ROLE_IDS } from '../constants/team.constants';

import type {
  ActionKey,
  ModuleKey,
} from '../constants/team.constants';

/**
 * ============================================================
 * MEMBER PERMISSIONS
 * ============================================================
 */

export class UpdateMemberPermissionsDto {
  @IsObject()
  @IsOptional()
  permissions?: Record<ModuleKey, ActionKey[]>;
}

/**
 * ============================================================
 * MASKING
 * ============================================================
 */

class RoleMaskingRuleDto {
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  fields?: string[];
}

class UserMaskingRuleDto {
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  fields?: string[];
}

export class UpdateMaskingRulesDto {
  @IsOptional()
  @IsObject()
  roleRules?: Record<string, RoleMaskingRuleDto>;

  @IsOptional()
  @IsObject()
  userRules?: Record<string, UserMaskingRuleDto>;
}

/**
 * ============================================================
 * CREATE ROLE PRESET
 * ============================================================
 */

export class CreateRolePresetDto {
  @IsString()
  @IsIn(ROLE_IDS as readonly string[])
  base!: string;

  @IsString()
  label!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

/**
 * ============================================================
 * UPDATE ROLE PRESET INFO
 * ============================================================
 */

export class UpdateRolePresetInfoDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

/**
 * ============================================================
 * UPDATE ROLE PRESET PERMISSIONS
 * ============================================================
 */

export class UpdateRolePresetPermissionsDto {
  @IsObject()
  @IsOptional()
  permissions?: Record<ModuleKey, ActionKey[]>;
}