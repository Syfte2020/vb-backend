import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

import { VenueChild } from './venue-child.entity';
@Entity('property_pricing')
export class Pricing {
  @PrimaryGeneratedColumn()
  id?: number;

  // 👇 Link to child venue / listing
  @Index()
  @Column({ name: 'child_venue_id', type: 'varchar' })
  childVenueId?: string;

  // 👇 Display name (Nightly, Weekly, etc.)
  @Column({ type: 'varchar' })
  name?: string;

  // 👇 Key used in frontend/backend mapping
  @Column({ name: 'pricing_key', type: 'varchar' })
  pricingKey?: string;

  // 👇 actual price
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  amount?: number;

  // 👇 optional metadata
  @Column({ type: 'boolean', default: true })
  enabled?: boolean;

  @Column({ type: 'varchar', nullable: true })
  category?: string;

  // 🔥 MANY SHIFT HEADER → ONE CHILD VENUE
@ManyToOne(() => VenueChild, (child) => child.pricings, {
  onDelete: "CASCADE",
})
@JoinColumn({ name: "child_venue_id" })
childVenue?: VenueChild;

  @CreateDateColumn({ name: 'created_at' })
  createdAt?: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt?: Date;
}
