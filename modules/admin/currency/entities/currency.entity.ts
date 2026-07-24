import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("currencies")
export class Currency {

  @PrimaryGeneratedColumn()
  id?: string;

  @Column({ unique: true })
  code?: string; // USD, INR, EUR

  @Column()
  name?: string; // US Dollar

  @Column()
  symbol?: string; // $, ₹

  @Column({
    type: "decimal",
    precision: 10,
    scale: 4,
    default: 1,
  })
  exchange_rate?: number; // base USD = 1

  @Column({
    default: true,
  })
  is_active?: boolean;

//   @Column({ nullable: true })
//   created_by?: string;

  @CreateDateColumn()
  created_at?: Date;

  @UpdateDateColumn()
  updated_at?: Date;
}