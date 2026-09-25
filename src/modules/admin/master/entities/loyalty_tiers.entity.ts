import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("loyalty_tiers")
export class LoyaltyTier {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column()
  country_id?: number;

  @Column()
  tier_name?: string;

  @Column("int")
  min_points?: number;

  @Column("int")
  max_points?: number;

  @Column("decimal", { precision: 10, scale: 2, default: 0 })
  discount_percentage?: number;

  @Column("decimal", { precision: 10, scale: 2, default: 0, nullable: true })
  bonus_percentage?: number;

  @Column("int")
  validity_days?: number;

  @Column({ type: "tinyint", default: 1 })
  status?: number;

  @CreateDateColumn()
  created_at?: Date;

  @UpdateDateColumn()
  updated_at?: Date;
}