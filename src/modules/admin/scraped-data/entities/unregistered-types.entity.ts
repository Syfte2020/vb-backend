// ============================================
// unregistered-types.entity.ts
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

@Entity("unrigistered_types")
export class UnregisteredTypes {

  @PrimaryGeneratedColumn()
  id?: number;

  @Column()
  unreg_id?: number;

  @Column()
  types_id?: number;

  @CreateDateColumn()
  created_at?: Date;

  // ============================================
  // RELATION
  // ============================================

  @ManyToOne(
    () => UnregisteredVenue,
    (venue) => venue.types,
    {
      onDelete: "CASCADE",
    },
  )
  @JoinColumn({
    name: "unreg_id",
  })
  venue?: UnregisteredVenue;

}