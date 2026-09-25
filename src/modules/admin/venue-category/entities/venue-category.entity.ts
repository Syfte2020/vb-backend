import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Category } from "./category.entity";

@Entity("venue_categories")
export class VenueCategory {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({ nullable: true })
  category_id?: number;
  
  @Column({ nullable: true })
  name?: string;
  
  @Column({ nullable: true })
  frontImage?: string;

  @Column({ nullable: true })
  backImage?: string;

  @Column({ nullable: true })
  icon?: string;

  @Column({ type: "boolean", default: false })
  cat_status?: boolean;

  @ManyToOne(() => Category, (category) => category.venueCategories)
  @JoinColumn({ name: "category_id" })
  category ?: Category;
}