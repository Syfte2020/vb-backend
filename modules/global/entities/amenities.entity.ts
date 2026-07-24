import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

import { AmenitiesCategory } from "./amenities-category.entity";

@Entity("amenities")
export class Amenities {

  @PrimaryGeneratedColumn("uuid")
  id?: string;

  @Column()
  amenities_category_id?: string;

  @Column()
  name?: string;

  @Column()
  created_by?: string;
  
  @Column()
  svg_icon?: string;

  // RELATION

 @ManyToOne(
  () => AmenitiesCategory,
  (category: AmenitiesCategory) =>
    category.amenities,
)
  @JoinColumn({
    name: "amenities_category_id",
  })
  category?: AmenitiesCategory;

  @CreateDateColumn()
  created_at?: Date;

  @UpdateDateColumn()
  updated_at?: Date;
}