import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

import { Amenities } from "./amenities.entity";

@Entity("amenities_categories")
export class AmenitiesCategory {

  @PrimaryGeneratedColumn("uuid")
  id?: string;

  @Column()
  category?: string;
  
  

  @Column()
  vendor_id ?: string;

  // RELATION

  @OneToMany(
  () => Amenities,
  (amenity: Amenities) =>
    amenity.category,
)
amenities ?: Amenities[];

  @CreateDateColumn()
  created_at ?: Date;

  @UpdateDateColumn()
  updated_at ?: Date;
}