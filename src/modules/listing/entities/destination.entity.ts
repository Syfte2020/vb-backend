import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DestinationPlace } from './destination-place.entity';

@Entity('destinations')
export class Destination {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({ nullable: true })
  google_place_id?: string;

  @Column()
  name?: string;

  @Column({ unique: true })
  slug?: string;

  @Column({ nullable: true })
  type?: string;

  @Column({ nullable: true, type: 'text' })
  formatted_address?: string;

  @Column({ nullable: true })
  state?: string;

  @Column({ nullable: true })
  district?: string;

  @Column({ nullable: true })
  country?: string;

  @Column('decimal', {
    precision: 10,
    scale: 7,
    nullable: true,
  })
  latitude?: number;

  @Column('decimal', {
    precision: 10,
    scale: 7,
    nullable: true,
  })
  longitude?: number;

 @Column({ nullable: true })
  image?: string;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  popularity_score?: number;

  @Column({ default: 1 })
  status?: number;

  @OneToMany(
    () => DestinationPlace,
    (place) => place.destination,
  )
  places?: DestinationPlace[];

  @CreateDateColumn()
  created_at?: Date;

  @UpdateDateColumn()
  updated_at?: Date;
}