import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { VenueChild } from "./venue-child.entity";
import { VenueShiftTiming } from "./venue-shift-timing.entity";

@Entity("venue_shift_header")
export class VenueShiftHeader {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({ name: "name", type: "varchar", length: 255 })
  name?: string;

  @Column({ name: "custom_name", type: "varchar", length: 255, nullable: true })
  customName?: string;

  @Column({ name: "Shift_type", type: "varchar", length: 50 })
  shiftType?: string;

  @Column({ name: "child_id", type: "int" })
  childId?: number;

  @Column({ name: "from_time", type: "time" })
  fromTime?: string;

  @Column({ name: "to_time", type: "time" })
  toTime?: string;

  @Column({ name: "base_price_update", type: "decimal", precision: 10, scale: 2, nullable: true })
  basePriceUpdate?: number;

  @Column({ name: "publish", type: "tinyint", default: 0 })
  publish?: number;

  // 🔥 MANY SHIFT HEADER → ONE CHILD VENUE
  @ManyToOne(() => VenueChild, (child) => child.shiftHeaders, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "child_id" })
  childVenue?: VenueChild;

  // 🔥 ONE HEADER → MANY TIMINGS
  @OneToMany(() => VenueShiftTiming, (timing) => timing.shiftHeader)
  timings?: VenueShiftTiming[];

  @CreateDateColumn({ name: "created_at" })
  createdAt?: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt?: Date;
}