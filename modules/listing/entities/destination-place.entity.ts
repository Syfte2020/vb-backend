import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Destination } from './destination.entity';

@Entity('destination_places')
export class DestinationPlace {
  @PrimaryGeneratedColumn()
  id?: number;


  @Column({ nullable: true })
  google_place_id?: string;

  @Column()
  name?: string;

  @Column({ nullable: true })
  category?: string;

  @Column({ type: 'text', nullable: true })
  formatted_address?: string;

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

  @Column({
    type: 'decimal',
    precision: 3,
    scale: 1,
    default: 0,
  })
  rating?: number;

  @Column({ default: 0 })
  total_ratings?: number;

 @Column({ nullable: true })
  image?: string;

  @Column({ type: 'text', nullable: true })
  opening_hours?: string;

  @Column({ type: 'text', nullable: true })
  google_maps_url?: string;

  @Column({ default: 1 })
  status?: number;

  @ManyToOne(
    () => Destination,
    (destination) => destination.places,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'id' })
  destination?: Destination;

  @CreateDateColumn()
  created_at?: Date;

  @UpdateDateColumn()
  updated_at?: Date;
}