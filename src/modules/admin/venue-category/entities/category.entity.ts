import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
} from "typeorm";
import { VenueCategory } from "./venue-category.entity";

@Entity("category")
export class Category {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column()
  name?: string;

  @OneToMany(
    () => VenueCategory,
    (vc) => vc.category,
  )
  venueCategories?: VenueCategory[];
}