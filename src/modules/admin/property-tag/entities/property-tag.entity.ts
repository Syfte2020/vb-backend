import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from "typeorm";

import { CategoryCountry } from "./category-country.entity";

@Entity("category")
export class Category {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({ type: "varchar", length: 255, nullable: true })
  name?: string;

  @Column({ type: "text", nullable: true })
  image?: string;

  @Column({ type: "text", nullable: true })
  video?: string;

  @Column({ type: "json", nullable: true })
  stat?: {
    entity?: string;
    views?: number;
    bookings?: number;
    rating?: number;
    [key: string]: any;
  };

  @Column({ type: "tinyint", default: 1 })
  status?: number;

  @CreateDateColumn({ type: "timestamp", name: "created_at" })
  created_at?: Date;

  // ✅ FIXED RELATION
  @OneToMany(
    () => CategoryCountry,
    (categoryCountry) => categoryCountry.category
  )
  categoryCountries?: CategoryCountry[];
}