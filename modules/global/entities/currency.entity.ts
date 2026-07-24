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
  id?: number;

  @Column({ unique: true })
  code?: string;

  @Column()
  name?: string;

  @Column()
  symbol?: string;

  @Column("decimal", { precision: 12, scale: 6 })
  exchange_rate?: number;

  @Column({ default: true })
  is_active?: boolean;

  @CreateDateColumn()
  created_at?: Date;

  @UpdateDateColumn()
  updated_at?: Date;
}