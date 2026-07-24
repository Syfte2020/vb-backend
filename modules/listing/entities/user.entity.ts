import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({ nullable: true })
  name?: string;

  @Column({ nullable: true, unique: true })
  vendor_id?: string;

  @Column({ nullable: true, type: 'text' })
  logo?: string;

  @Column({ nullable: true })
  role_id?: number;

  @Column({ nullable: true })
  created_by?: number;

  @Column({ nullable: true, unique: true })
  email?: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ nullable: true })
  city?: string;

  @Column({ nullable: true, type: 'text' })
  address?: string;

  @Column({ nullable: true })
  state?: string;

  @Column({ nullable: true })
  country?: string;

  @Column({ nullable: true })
  role_type?: string;

  @Column({ nullable: true, select: false })
  password?: string;

  @CreateDateColumn({
    name: 'created_at',
  })
  created_at?: Date;

  @UpdateDateColumn({
    name: 'updated_at',
  })
  updated_at?: Date;
}