import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("booking_event_types")
export class EventTag {

  @PrimaryGeneratedColumn()
  id?: string;

  @Column()
  event_name?: string;

  @Column({
    nullable: true,
  })
  icon?: string;

  @Column({
    nullable: true,
  })
  frontImage?: string;

 

  @Column({
    default: "0",
  })
  status?: number;

  @CreateDateColumn()
  created_at ?: Date;

  @UpdateDateColumn()
  updated_at ?: Date;
}