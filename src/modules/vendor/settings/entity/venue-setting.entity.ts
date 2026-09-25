import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Setting } from './setting.entity';

@Entity('venue_settings')
export class VenueSetting {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column()
  venue_id?: number;

  @Column()
  setting_id?: number;

  @ManyToOne(() => Setting, (setting) => setting.venueSettings, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'setting_id' })
  setting?: Setting;

  @Column({
    type: 'text',
    nullable: true,
  })
  value?: string;

  @CreateDateColumn()
  created_at?: Date;

  @UpdateDateColumn()
  updated_at?: Date;
}