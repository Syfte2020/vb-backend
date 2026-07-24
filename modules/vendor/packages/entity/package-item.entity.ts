import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PackageCategory } from './package-category.entity';

@Entity('package_items_list')
export class PackageItem {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column()
  cat_id?: number;

  @Column()
  item_name?: string;

  @Column('decimal')
  item_price?: number;

  @Column('decimal', { default: 0 })
  item_price_1?: number;

  @Column({ nullable: true })
  image?: string;

  @Column({ default: 0 })
  food_pre?: number;

  @ManyToOne(
    () => PackageCategory,
    (category) => category.package_item,
  )
  @JoinColumn({ name: 'cat_id' })
  category?: PackageCategory;
}