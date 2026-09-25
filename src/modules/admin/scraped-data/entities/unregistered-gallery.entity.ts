// ============================================
// unregistered-gallery.entity.ts
// ============================================

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from "typeorm";

import { UnregisteredVenue } from "./unregistered-venue.entity";

@Entity("unrigistered_gallery")
export class UnregisteredGallery {

  @PrimaryGeneratedColumn()
  id?: number;

  @Column()
  unreg_id?: number;

  @Column({
    type: "text",
    nullable: true,
  })
  images?: string;

  @CreateDateColumn()
  created_at?: Date;

  // ============================================
  // RELATION
  // ============================================

  @ManyToOne(
    () => UnregisteredVenue,
    (venue) => venue.gallery,
    {
      onDelete: "CASCADE",
    },
  )
  @JoinColumn({
    name: "unreg_id",
  })
  venue?: UnregisteredVenue;

}