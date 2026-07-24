import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { VenueChild } from "./venue-child.entity";
import { VenueShiftHeader } from "./venue-shift-header.entity";

@Entity("venue_shift_timing")
export class VenueShiftTiming {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({ name: "child_venue_id", type: "int" })
  childVenueId?: number;

  @Column({ name: "from_date", type: "date" })
  fromDate?: string;

  @Column({ name: "to_date", type: "date" })
  toDate?: string;

  @Column({ name: "shift_type", type: "varchar", length: 50 })
  shiftType?: string;

  @Column({ name: "from_time", type: "time" })
  fromTime?: string;

  @Column({ name: "to_time", type: "time" })
  toTime?: string;

  @Column({ name: "price", type: "decimal", precision: 10, scale: 2 })
  price?: number;

  @Column({ name: "base_price", type: "decimal", precision: 10, scale: 2, nullable: true })
  basePrice?: number;

  // 🔥 MANY TIMING → ONE CHILD VENUE
  @ManyToOne(() => VenueChild, (child) => child.shiftTimings, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "child_venue_id" })
  childVenue?: VenueChild;

  // 🔥 MANY TIMING → ONE SHIFT HEADER
  @ManyToOne(() => VenueShiftHeader, (header) => header.timings, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "shift_type", referencedColumnName: "shiftType" })
  shiftHeader?: VenueShiftHeader;

  @CreateDateColumn({ name: "created_at" })
  createdAt?: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt?: Date;
}