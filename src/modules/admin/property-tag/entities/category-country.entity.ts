import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from "typeorm";

import { Category } from "./property-tag.entity";
import { Country } from "../../country/entities/country.entity";

@Entity("category_country")
export class CategoryCountry {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column()
  category_id?: number;

  @Column()
  country_id?: number;

  // ✅ auto timestamp is better
  @CreateDateColumn()
  created_at?: Date;

  // =========================
  // RELATIONS
  // =========================

  @ManyToOne(() => Category, (category) => category.categoryCountries, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "category_id" })
  category?: Category;

  @ManyToOne(() => Country, (country) => country.categoryCountries, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "country_id" })
  country?: Country;
}