import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column()
  name?: string;

  @Column({ unique: true })
  email?: string;

  @Column()
  password?: string;

  // 🔥 presence system
  @Column({ default: false })
  isOnline?: boolean;

  @Column({ type: 'datetime', nullable: true })
  lastLoginAt?: Date;

  @Column({ type: 'datetime', nullable: true })
  lastLogoutAt?: Date;

  @Column({ type: 'datetime', nullable: true })
  lastSeenAt?: Date;

  @Column({ nullable: true })
  socketId?: string;

  @CreateDateColumn()
  createdAt?: Date;

  @UpdateDateColumn()
  updatedAt?: Date;
}