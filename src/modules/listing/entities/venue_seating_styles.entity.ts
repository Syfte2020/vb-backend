import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('venue_seating_styles')
export class VenueSeatingStyle {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({ name: 'venue_id' })
  venueId?: number;

  @Column({ name: 'seating_type' })
  seatingType?: string;

  @Column({ name: 'is_enabled' })
  isEnabled?: number;

  @Column()
  capacity?: number;

  @Column({ name: 'sort_order' })
  sortOrder?: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt?: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt?: Date;
}