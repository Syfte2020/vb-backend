import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Venue } from './venue.entity';

@Entity('system_user_venues')
export class SystemUserVenue {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({ name: 'user_id' })
  userId?: number;

  @Column({ name: 'venue_id' })
  venueId?: number;

  @Column({ name: 'assigned_by', nullable: true })
  assignedBy?: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt?: Date;

  @ManyToOne(() => User, (u) => u.venueAssignments)
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @ManyToOne(() => Venue)
  @JoinColumn({ name: 'venue_id' })
  venue?: Venue;
}
