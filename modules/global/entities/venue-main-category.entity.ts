import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn
} from "typeorm";

import { VenueSubCategory } from "./venue-sub-category.entity";

@Entity("category")
export class VenueMainCategory {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({ type: "text"})
  name?: string;
  
  @Column({ type: "text"})
  image?: string;
  
  @Column({ type: "text" })
  video?: string;
  
  @Column({ type: "json", nullable: true })
stat?: {
  hosts: string;
  time: string;
  guests: string;
};
  
  @Column({ type: "int"})
  status?: boolean;
//`image`, `video`, `stat`, `status`
  // One Main Category → Many Sub Categories
  @OneToMany(
    () => VenueSubCategory,
    (subCategory) => subCategory.mainCategory
  )
  subCategories?: VenueSubCategory[];

  @CreateDateColumn()
  created_at?: Date;
}