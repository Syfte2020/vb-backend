import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  IsObject,
} from 'class-validator';

import { Transform, Type } from 'class-transformer';

export class UpdateListingDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minCapacity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxCapacity?: number;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  pincode?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  propety_category?: string;

  /* ─────────────────────────────
     Existing uploaded image URLs
  ───────────────────────────── */

  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  })
  @IsArray()
  photos?: string[];

  /* ─────────────────────────────
     Amenities
  ───────────────────────────── */

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? JSON.parse(value) : value,
  )
  @IsArray()
  amenities?: string[];

  /* ─────────────────────────────
     Pricing
  ───────────────────────────── */

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? JSON.parse(value) : value,
  )
  @IsObject()
  pricing?: any;

  /* ─────────────────────────────
     Photo Sections
  ───────────────────────────── */

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? JSON.parse(value) : value,
  )
  @IsArray()
  photoSections?: any[];

  /* ─────────────────────────────
     Tags
  ───────────────────────────── */

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? JSON.parse(value) : value,
  )
  @IsArray()
  event_tags?: number[];

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? JSON.parse(value) : value,
  )
  @IsArray()
  venue_tags?: number[];

  /* ─────────────────────────────
     Policies
  ───────────────────────────── */

  @IsOptional()
  @IsString()
  cancellationPolicy?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  termsAccepted?: boolean;

  @IsOptional()
  @IsString()
  houseRules?: string;
}