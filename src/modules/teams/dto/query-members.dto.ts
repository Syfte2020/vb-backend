import { Transform, Type } from 'class-transformer';
import { IsBooleanString, IsIn, IsOptional, IsString, IsInt, Min } from 'class-validator';
import { MEMBER_STATUSES, ROLE_IDS } from '../constants/team.constants';

export class QueryMembersDto {
  /** Matches ScrollableTabBar tabs: all | admins | managers | staff | suspended | pending */
  @IsOptional()
  @IsIn(['all', 'admins', 'managers', 'staff', 'suspended', 'pending'])
  tab?: string = 'all';

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(ROLE_IDS as unknown as string[])
  role?: string;

  @IsOptional()
  @IsIn(MEMBER_STATUSES as unknown as string[])
  status?: string;

  @IsOptional()
  @IsBooleanString()
  maskedOnly?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 24;
}
