// ============================================
// unregistered-venue.entity.ts
// ============================================

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

import { UnregisteredGallery } from "./unregistered-gallery.entity";

import { UnregisteredTypes } from "./unregistered-types.entity";

import { UnregisteredEventTypes } from "./unregistered-event-types.entity";

@Entity("unrigistered_venues")
export class UnregisteredVenue {

  @PrimaryGeneratedColumn()
  id?: number;

  @Column({ nullable: true })
  name?: string;

  @Column({ type: "text", nullable: true })
  address?: string;

  @Column({ nullable: true })
  city?: string;

  @Column({ nullable: true })
  district?: string;

  @Column({ nullable: true })
  state?: string;

  @Column({ nullable: true })
  country?: string;

  @Column({ nullable: true })
  phone_number?: string;

  @Column({ nullable: true })
  place_id?: string;

  @Column({ nullable: true })
  lat?: string;

  @Column({ nullable: true })
  lng?: string;

  @Column({ type: "json", nullable: true })
  geometry: any;

  @Column({ type: "text", nullable: true })
  map_url?: string;

  @Column({ nullable: true })
  contact_person?: string;

  @Column({ nullable: true })
  email_address?: string;

  @Column({ type: "text", nullable: true })
  email_verified_url?: string;

  @Column({
    type: "tinyint",
    default: 0,
  })
  email_verified?: number; 
  
  @Column({
    type: "int",
    default: 0,
  })
  types?: number;

  @Column({
    type: "tinyint",
    default: 0,
  })
  email_link_sent?: number;

  @Column({ nullable: true })
  temp_phone?: string;

  @Column({ nullable: true })
  otp?: string;

  @Column({
    type: "datetime",
    nullable: true,
  })
  otp_expire?: Date;

  @Column({
    type: "decimal",
    precision: 3,
    scale: 2,
    default: 0,
  })
  rating?: number;

  @Column({
    default: 0,
  })
  user_ratings_total?: number;

  @Column({
    name: "Status",
    type: "tinyint",
    default: 1,
  })
  status?: number;

  @CreateDateColumn()
  created_at?: Date;

  @UpdateDateColumn()
  updated_at?: Date;

  // ============================================
  // RELATIONS
  // ============================================

  @OneToMany(
    () => UnregisteredGallery,
    (gallery) => gallery.venue,
    {
      cascade: true,
    },
  )
  gallery?: UnregisteredGallery[];

  @OneToMany(
    () => UnregisteredTypes,
    (types) => types.venue,
    {
      cascade: true,
    },
  )
  property_types?: UnregisteredTypes[];

  @OneToMany(
    () => UnregisteredEventTypes,
    (event) => event.venue,
    {
      cascade: true,
    },
  )
  eventTypes?: UnregisteredEventTypes[];

}