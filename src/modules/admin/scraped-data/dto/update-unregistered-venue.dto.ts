// ============================================
// update-unregistered-venue.dto.ts
// ============================================

import {
  IsOptional,
  IsNumberString,
  IsString,
} from "class-validator";

export class UpdateUnregisteredVenueDto {

  // ============================================
  // STATUS
  // ============================================

  @IsOptional()
  @IsNumberString()
  status?: string;

  // ============================================
  // VENUE TYPES
  // JSON STRING
  // ============================================

  @IsOptional()
  @IsString()
  venueTypes?: string;

  // ============================================
  // EVENT TYPES
  // JSON STRING
  // ============================================

  @IsOptional()
  @IsString()
  eventTypes?: string;
}