import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('countries')
export class Country {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({ type: 'varchar', length: 150 })
  name?: string;

  @Column({ type: 'varchar', length: 10, unique: true })
  iso_code?: string;

  @Column({ type: 'varchar', length: 10 })
  phone_code?: string;

  @Column({ type: 'varchar', length: 10 })
  currency_code?: string;

  @Column({ type: 'text', nullable: true })
  flag?: string;

  @Column({ type: 'tinyint', default: 1 })
  status?: number;

  @CreateDateColumn()
  created_at?: Date;

  @UpdateDateColumn()
  updated_at?: Date;
}