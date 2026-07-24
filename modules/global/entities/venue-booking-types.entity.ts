import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("booking_event_types")
export class BookingEventType {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({ type: "varchar", length: 255 })
  event_name?: string;

  @Column({ nullable: true })
  frontImage?: string;

  @Column({ nullable: true })
  backImage?: string;

  @Column({ nullable: true })
  icon?: string;

  @Column({ type: "tinyint", default: 1 })
  status?: number;

  @CreateDateColumn()
  created_at?: Date;

  @UpdateDateColumn()
  updated_at?: Date;
}