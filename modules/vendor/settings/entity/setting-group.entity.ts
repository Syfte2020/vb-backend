import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Setting } from './setting.entity';

@Entity('setting_groups')
export class SettingGroup {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({ length: 100 })
  name?: string;

  @Column({ length: 100, unique: true })
  slug?: string;

  @Column({ nullable: true })
  description?: string;

  // @Column({ nullable: true })
  // icon?: string;

  @Column({ default: 0 })
  sort_order?: number;

  @Column({ default: true })
  status?: boolean;

  @OneToMany(() => Setting, (setting) => setting.group)
  settings?: Setting[];

  @CreateDateColumn()
  created_at?: Date;

  @UpdateDateColumn()
  updated_at?: Date;
}