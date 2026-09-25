import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from "typeorm";

@Entity("loyalty_point")
@Unique(["country_id", "category_id"])
export class LoyaltyPoint {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({
    type: "int",
  })
  country_id?: number;

  @Column({
    type: "int",
  })
  category_id?: number;

  @Column({
    type: "decimal",
    precision: 10,
    scale: 2,
    default: 1,
  })
  point_value?: number;

  @Column({
    type: "int",
    default: 10000,
  })
  max_point?: number;

  @Column({
    type: "tinyint",
    default: 1,
  })
  status?: number;

  @CreateDateColumn()
  created_at?: Date;

  @UpdateDateColumn()
  updated_at?: Date;
}