import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("venue_categories")
export class VenueTag {

  @PrimaryGeneratedColumn()
  id?: string;

  @Column()
  name?: string;

  @Column({
    nullable: true,
  })
  icon?: string;

  @Column({
    nullable: true,
  })
  frontImage?: string;

 

  @Column({
    default: "0",
  })
  cat_status?: number;

  @CreateDateColumn()
  created_at ?: Date;

  @UpdateDateColumn()
  updated_at ?: Date;
}