import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany
} from "typeorm";

import { CategoryCountry } from "../../property-tag/entities/category-country.entity";

@Entity("countries")
export class Country {

  @PrimaryGeneratedColumn()
  id?: string;

  @Column()
  name?: string;

  @Column({ unique: true })
  iso_code?: string;

  @Column()
  phone_code?: string;

  @Column()
  currency_code?: string;

  @Column({ default: true })
  status?: boolean;

    @OneToMany(
    () => CategoryCountry,
    (categoryCountry) => categoryCountry.country
  )
  categoryCountries?: CategoryCountry[];
  

  @CreateDateColumn()
  created_at?: Date;

  @UpdateDateColumn()
  updated_at?: Date;
}