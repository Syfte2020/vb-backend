import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

import { SettingGroup } from './setting-group.entity';
import { VenueSetting } from './venue-setting.entity';

@Entity('settings')
export class Setting {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column()
  group_id?: number;

  @ManyToOne(() => SettingGroup, (group) => group.settings, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'group_id' })
  group?: SettingGroup;

  @Column({ unique: true })
  key?: string;

  @Column()
  label?: string;

  @Column({
    type: 'enum',
    enum: [
      'toggle',
      'input',
      'number',
      'select',
      'textarea',
      'date',
      'time',
    ],
  })
  type?:
    | 'toggle'
    | 'input'
    | 'number'
    | 'select'
    | 'textarea'
    | 'date'
    | 'time';

  @Column({ nullable: true })
  placeholder?: string;

  @Column({ type: 'text', nullable: true })
  default_value?: string;

  @Column({ type: 'json', nullable: true })
  validation: any;

  @Column({ default: 0 })
  sort_order?: number;

  @Column({ default: true })
  status?: boolean;

  @OneToMany(() => VenueSetting, (venueSetting) => venueSetting.setting)
  venueSettings?: VenueSetting[];

  @CreateDateColumn()
  created_at?: Date;

  @UpdateDateColumn()
  updated_at?: Date;
}