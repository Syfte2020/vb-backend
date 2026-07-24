import { IsOptional, IsString, IsNumberString } from 'class-validator';

export class VenueFilterDto {

  @IsOptional()
  @IsString()
  type?: string;
  
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  amenities?: string;

  @IsOptional()
  @IsString()
  tags?: string;

  @IsOptional()
  @IsNumberString()
  page?: number;

  @IsOptional()
  @IsNumberString()
  limit?: number;
}