import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

// 🔥 SAFE JSON PARSER
const parseJSON = (value: any) => {
  try {
    if (!value) return undefined;

    if (typeof value !== 'string') return value;

    const cleaned = value.trim();

    if (cleaned === '[object Object]') return undefined;

    return JSON.parse(cleaned);
  } catch (err) {
    console.log('❌ JSON PARSE ERROR:', value);
    return undefined;
  }
};

class CategoryDto {
  @IsString()
  code!: string;

  @IsString()
  label!: string;
}

export type FastifyFile = {
  filename: string;
  mimetype: string;
  buffer: Buffer;
};

export class CreateChildVenueDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  parent_venue_id!: string;

  @IsString()
  created_by!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  capacity?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  pricingModel?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  sibling_avaliblity?: boolean;

  // ✅ VENUES
  @IsOptional()
  @Transform(({ value }) => parseJSON(value), { toClassOnly: true })
  @IsArray()
  @IsString({ each: true })
  venue_tag?: string[];
  
  // ✅ CATEGORY
  @IsOptional()
  @Transform(({ value }) => parseJSON(value), { toClassOnly: true })
  @IsArray()
  @IsString({ each: true })
  category?: string[];

  // ✅ AMENITIES
  @IsOptional()
  @Transform(({ value }) => parseJSON(value), { toClassOnly: true })
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];

  // ✅ PHOTOS
  @IsOptional()
  @Transform(({ value }) => parseJSON(value), { toClassOnly: true })
  @IsArray()
  @IsString({ each: true })
  photos?: string[];

  // ✅ SHIFTS
  @IsOptional()
  @Transform(({ value }) => parseJSON(value), { toClassOnly: true })
  @IsArray()
  @IsString({ each: true })
  shifts?: string[];

  // ✅ PRICING
  @IsOptional()
  @Transform(({ value }) => parseJSON(value), { toClassOnly: true })
  @IsObject()
  pricing?: Record<string, number>;

  // ✅ FILES (Fastify)
  @IsOptional()
  thumbnail_photo?: FastifyFile;

  @IsOptional()
  banner_photo?: FastifyFile;

  @IsOptional()
  gallery_photos?: FastifyFile[];
}