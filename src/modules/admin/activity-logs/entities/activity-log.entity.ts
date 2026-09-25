import {

  Entity,

  PrimaryGeneratedColumn,

  Column,

  CreateDateColumn,

} from "typeorm";

@Entity("activity_logs")

export class ActivityLog {

  @PrimaryGeneratedColumn()

  id?: number;

  @Column()

  action?: string;

  @Column()

  module?: string;

  @Column({
    nullable: true,
  })

  module_id?: string;

  @Column({
    nullable: true,
  })

  user_id?: string;

  @Column({
    type: "longtext",
    nullable: true,
  })

  description?: string;

  @Column({
    nullable: true,
  })

  ip_address?: string;

  @Column({
    type: "json",
    nullable: true,
  })

  metadata?: any;

@Column({ type: "text", nullable: true })
user_agent?: string;

  @CreateDateColumn()

  created_at?: Date;
}