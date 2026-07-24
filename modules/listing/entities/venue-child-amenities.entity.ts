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

@Entity("venue_child_amenities")
export class VenueChildAmenities {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({ name: "amenities_id" })
  amenitiesId?: string;

  @Column({ name: "created_by", type: "int", nullable: true })
  createdBy?: number;

  @Column({ name: "child_venue_id"})
  childVenueId?: number;

  // 🔥 MANY TO ONE → VenueChild
  @ManyToOne(() => VenueChild, (child) => child.childAmenities, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "child_venue_id" })
  childVenue?: VenueChild;

  @CreateDateColumn({ name: "created_at" })
  createdAt?: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt?: Date;
}