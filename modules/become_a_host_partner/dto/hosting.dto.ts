import {
  IsString,
  IsOptional,
  IsArray,
  IsEmail,
} from 'class-validator';

export class CreateUnregisteredVenueDto {
  @IsString()
  name ?: string;

  @IsString()
  address ?: string;

  @IsString()
  city ?: string;

  @IsString()
  district ?: string;

  @IsString()
  state ?: string;

  @IsString()
  phone_number ?: string;

  @IsString()
  country ?: string;

  @IsString()
  place_id ?: string;

  @IsOptional()
  map_url?: string;

  @IsOptional()
  contact_person?: string;

  @IsOptional()
  @IsEmail()
  email_address?: string;

  @IsOptional()
  temp_phone?: string;

  @IsOptional()
  otp?: string;

  @IsOptional()
  otp_expire?: Date;

  @IsOptional()
  rating?: number;

  @IsOptional()
  user_ratings_total?: number;

  @IsOptional()
  Status?: string;

  // 🔥 RELATIONS (NOT JSON)
  @IsOptional()
  @IsArray()
  gallery ?: string[]; // image URLs

  @IsOptional()
  @IsArray()
  types ?: number[]; // type IDs

  @IsOptional()
  @IsArray()
  event_tags ? : number[]; // tag IDs
}