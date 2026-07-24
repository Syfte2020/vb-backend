import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

import { VenueMainCategory } from "./venue-main-category.entity";

@Entity("venue_categories")
export class VenueSubCategory {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column()
  category_id?: number;

  @Column({ type: "varchar", length: 255 })
  name?: string;

  @Column({ nullable: true })
  icon?: string;

  @Column({ nullable: true })
  style_property?: string;

  @Column({ nullable: true })
  frontImage?: string;

  @Column({ nullable: true })
  backImage?: string;

  @Column({ type: "tinyint", default: 1 })
  cat_status?: number;

  // Main Category Relation
  @ManyToOne(
    () => VenueMainCategory,
    (mainCategory) => mainCategory.subCategories,
    {
      onDelete: "CASCADE",
    }
  )
  @JoinColumn({ name: "category_id" })
  mainCategory?: VenueMainCategory;

  @CreateDateColumn()
  created_at?: Date;

  @UpdateDateColumn()
  updated_at?: Date;
}