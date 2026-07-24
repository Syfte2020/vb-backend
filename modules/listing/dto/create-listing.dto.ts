export class CreateListingDto {

  // -------- VENUE INFO --------

  title?: string;
  description?: string;
  category?: string;
  subcategory?: number;

  // -------- ADDRESS --------

  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;

  lat?: number;
  lng?: number;

  // -------- CAPACITY --------

  capacity?: {
    minGuests?: number;
    maxGuests?: number;
  };

  // -------- AMENITIES --------

  amenities?: string[];

  // -------- PRICING --------

  pricing?: {
    shifts?: Record<
      string,
      {
        enabled?: boolean;
        price?: number;
      }
    >;
  };

  // -------- IMAGES --------

  images?: any[];
}