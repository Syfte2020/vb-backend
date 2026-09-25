// ============================================
// unregistered-event-types.entity.ts
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

@Entity("unrigistered_event_types")
export class UnregisteredEventTypes {

  @PrimaryGeneratedColumn()
  id?: number;

  @Column()
  unreg_id?: number;

  @Column()
  event_id?: number;

  @CreateDateColumn()
  created_at?: Date;

  // ============================================
  // RELATION
  // ============================================

  @ManyToOne(
    () => UnregisteredVenue,
    (venue) => venue.eventTypes,
    {
      onDelete: "CASCADE",
    },
  )
  @JoinColumn({
    name: "unreg_id",
  })
  venue?: UnregisteredVenue;

}