import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from "typeorm";

import { VenueChild } from "./venue-child.entity";

@Entity("venue_parent")
export class VenueParent {
  @PrimaryGeneratedColumn("uuid")
  parent_venue_id?: number;

  @Column({ name: "parent_auto_no", type: "varchar", length: 255, nullable: true })
  parentAutoNo?: string;

  @Column({ name: "created_by", type: "int", nullable: true })
  createdBy?: number;

  @Column({ name: "venue_name", type: "varchar", length: 255 })
  venueName?: string;

  @Column({ name: "venue_company_name", type: "varchar", length: 255, nullable: true })
  venueCompanyName?: string;

  @Column({ name: "venue_address", type: "text", nullable: true })
  venueAddress?: string;

  @Column({ name: "venue_country", type: "varchar", length: 100, nullable: true })
  venueCountry?: string;

  @Column({ name: "venue_state", type: "varchar", length: 100, nullable: true })
  venueState?: string;

  @Column({ name: "venue_city", type: "varchar", length: 100, nullable: true })
  venueCity?: string;

  @Column({ name: "venue_pincode", type: "varchar", length: 20, nullable: true })
  venuePincode?: string;

  @Column({ name: "facebook_url", type: "text", nullable: true })
  facebookUrl?: string;

  @Column({ name: "instagram_url", type: "text", nullable: true })
  instagramUrl?: string;

  @Column({ name: "youtube_url", type: "text", nullable: true })
  youtubeUrl?: string;

  @Column({ name: "twitter_url", type: "text", nullable: true })
  twitterUrl?: string;

  @Column({ name: "website_url", type: "text", nullable: true })
  websiteUrl?: string;

  @Column({ name: "std_code", type: "varchar", length: 20, nullable: true })
  stdCode?: string;

  @Column({ name: "land_number", type: "varchar", length: 50, nullable: true })
  landNumber?: string;

  @Column({ name: "district", type: "varchar", length: 100, nullable: true })
  district?: string;

  @Column({ name: "lat", type: "decimal", precision: 10, scale: 6, nullable: true })
  lat?: number;

  @Column({ name: "lng", type: "decimal", precision: 10, scale: 6, nullable: true })
  lng?: number;

  @Column({ name: "rating", type: "decimal", precision: 3, scale: 2, default: 0 })
  rating?: number;

  @Column({ name: "reviews", type: "int", default: 0 })
  reviews?: number;

  @Column({ name: "place_id", type: "text", nullable: true })
  placeId?: string;

  @Column({ name: "user_ratings_total", type: "int", default: 0 })
  userRatingsTotal?: number;

  @Column({ name: "publish_status", type: "tinyint", default: 0 })
  publishStatus?: string;

  @Column({ name: "venue_settings", type: "text", nullable: true })
  venueSettings?: string;

  @Column({ name: "new_youtube", type: "text", nullable: true })
  newYoutube?: string;

  @Column({ name: "video_url", type: "text", nullable: true })
  videoUrl?: string;

  @Column({ name: "banner_content", type: "text", nullable: true })
  bannerContent?: string;

  @Column({ name: "banner_section", type: "text", nullable: true })
  bannerSection?: string;

  @Column({ name: "displayMediaType", type: "varchar", length: 50, nullable: true })
  displayMediaType?: string;

  @Column({ name: "about_venues", type: "text", nullable: true })
  aboutVenues?: string;

  @Column({ name: "excellence", type: "text", nullable: true })
  excellence?: string;

  @Column({ name: "hosted", type: "text", nullable: true })
  hosted?: string;

  @Column({ name: "clients", type: "text", nullable: true })
  clients?: string;

  @Column({ name: "capacity", type: "varchar", length: 255, nullable: true })
  capacity?: string;

  @Column({ name: "sponsered", type: "tinyint", default: 0 })
  sponsored?: number;
  
  @Column({ name: "propety_category", type: "varchar", length: 255, nullable: true})
  propetyCategory?: number;

  //new 
   @Column({ name: "logo", type: "text", nullable: true })
  logo?: string;


   @Column({ name: "conatct_person", type: "varchar", length: 255, nullable: true })
  conatct_person?: string;

   @Column({ name: "email", type: "varchar", length: 255, nullable: true })
  email?: string;

   @Column({ name: "phone", type: "varchar", length: 255, nullable: true })
  phone?: string;

   @Column({ name: "property_size", type: "varchar", length: 255, nullable: true })
  property_size?: string;

   @Column({ name: "build_year", type: "varchar", length: 255, nullable: true })
  build_year?: string; 
  
  @Column({ name: "opertaion_year", type: "varchar", length: 255, nullable: true })
  opertaion_year?: string; 
  
  @Column({ name: "child_count", type: "varchar", length: 255, nullable: true })
  child_count?: number;

  // 🔥 ONE TO MANY RELATION
  @OneToMany(() => VenueChild, (child) => child.parentVenue)
  children?: VenueChild[];

  @CreateDateColumn({ name: "created_at" })
  createdAt?: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt?: Date;
}