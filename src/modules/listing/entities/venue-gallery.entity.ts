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
import { VenueGalleryCategory } from "./venue-gallery-category.entity";

@Entity("venue_gallery")
export class VenueGallery {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({ name: "child_venue_id", type: "int" })
  childVenueId?: number;

  @Column({ name: "attachment", type: "text", nullable: true })
  attachment?: string;

  @Column({ name: "name", type: "varchar", length: 255, nullable: true })
  name?: string;

  @Column({ name: "g_category", type: "int" })
  categoryId?: number;

  @Column({ name: "description", type: "text", nullable: true })
  description?: string;

  // @Column({ name: "image_type", type: "varchar", length: 50, nullable: true })
  // imageType?: string;
  @Column({
  name: "image_type",
  type: "varchar",
  length: 100,
  nullable: true,
})
imageType ?: string;

  @Column({ name: "file_extension", type: "varchar", length: 20, nullable: true })
  fileExtension?: string;

  // 🔥 MANY GALLERY → ONE CHILD VENUE
  @ManyToOne(() => VenueChild, (child) => child.galleries, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "child_venue_id" })
  childVenue?: VenueChild;

  // 🔥 MANY GALLERY → ONE CATEGORY
  @ManyToOne(() => VenueGalleryCategory, (cat) => cat.galleries, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "g_category" })
  category?: VenueGalleryCategory;

  @CreateDateColumn({ name: "created_at" })
  createdAt?: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt?: Date;
}