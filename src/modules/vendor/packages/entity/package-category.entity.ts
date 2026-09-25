import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
} from 'typeorm';
import { PackageItem } from './package-item.entity';

@Entity('package_items_category')
export class PackageCategory {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column()
  item_category?: string;

  @Column({ nullable: true })
  cat_icon?: string;

  @Column({ default: 1 })
  cat_publish?: number;

  @Column({ default: 0 })
  cat_amt?: number;

@Column({ default: 0 })
  created_by?: number;
  
  @Column({ default: 0 })
  types?: number;

  

  @OneToMany(
    () => PackageItem,
    (item) => item.category,
  )
  package_item?: PackageItem[];
}