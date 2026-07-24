import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { VenueChild } from "./venue-child.entity";
import { VenueGallery } from "./venue-gallery.entity";

@Entity("venue_gallery_category")
export class VenueGalleryCategory {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({ name: "name", type: "varchar", length: 255 })
  name?: string;

  @Column({ name: "description", type: "text", nullable: true })
  description?: string;

  @Column({ name: "vendor_id", type: "int", nullable: true })
  vendorId?: number;

  @Column({ name: "child_id", type: "int" })
  childId?: number;

  @Column({ name: "created_by", type: "int", nullable: true })
  createdBy?: number;

  // 🔥 MANY CATEGORY → ONE CHILD VENUE
  @ManyToOne(() => VenueChild, (child) => child.galleryCategories, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "child_id" })
  childVenue?: VenueChild;

  // 🔥 ONE CATEGORY → MANY GALLERY ITEMS
  @OneToMany(() => VenueGallery, (gallery) => gallery.category)
  galleries?: VenueGallery[];

  @CreateDateColumn({ name: "created_at" })
  createdAt?: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt?: Date;
}