import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { VenueParent } from './venue-parent.entity';
import { VenueChildAmenities } from './venue-child-amenities.entity';
import { VenueGallery } from './venue-gallery.entity';
import { VenueShiftTiming } from './venue-shift-timing.entity';
import { VenueShiftHeader } from './venue-shift-header.entity';
import { VenueGalleryCategory } from './venue-gallery-category.entity';
import { Pricing } from './property_pricing.entity';

@Entity('venue_child')
export class VenueChild {
  @PrimaryGeneratedColumn('uuid')
  child_venue_id?: number;

  @Column({ name: 'parent_venue_id', type: 'int', nullable: true })
  parentVenueId?: number;

  @Column({
    name: 'child_auto_no',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  childAutoNo?: string;

  @ManyToOne(() => VenueParent, (parent) => parent.children, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'parent_venue_id' })
  parentVenue?: VenueParent;

  @Column({ name: 'venue_category_id', type: 'int', nullable: true })
  venueCategoryId?: number;

  @Column({ name: 'created_by', type: 'int', nullable: true })
  createdBy?: number;

  @Column({ name: 'child_venue_name', type: 'varchar', length: 255 })
  childVenueName?: string;

  @Column({ name: 'wing', type: 'varchar', length: 255, nullable: true })
  wing?: string;

  @Column({ name: 'renovated', type: 'boolean', default: false })
  renovated?: boolean;

  @Column({
    name: 'child_venue_contact',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  childVenueContact?: string;

  @Column({ name: 'min_guest', type: 'int', nullable: true })
  minGuest?: number;

  @Column({ name: 'guest_rooms', type: 'int', nullable: true })
  guestRooms?: number;

  @Column({
    name: 'total_meeting_space',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  totalMeetingSpace?: string;

  @Column({ name: 'more_info', type: 'text', nullable: true })
  moreInfo?: string;

  @Column({ name: 'child_venue_details', type: 'text', nullable: true })
  childVenueDetails?: string;

  @Column({
    name: 'meeting_space',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  meetingSpace?: string;

  @Column({ name: 'room_size', type: 'varchar', length: 255, nullable: true })
  roomSize?: string;

  @Column({
    name: 'ceiling_height',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  ceilingHeight?: string;

  @Column({
    name: 'room_dimention',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  roomDimension?: string;
  
  @Column({
    name: 'checkIn',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  checkIn?: string;
  
  @Column({
    name: 'checkOut',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  checkOut?: string;

  @Column({
    name: 'u_shape',
    type: 'decimal',
    precision: 20,
    scale: 2,
    nullable: true,
  })
  uShape?: number;

  @Column({
    name: 'banquet_round',
    type: 'decimal',
    precision: 20,
    scale: 2,
    nullable: true,
  })
  banquetRound?: number;

  @Column({
    name: 'cocktail_round',
    type: 'decimal',
    precision: 20,
    scale: 2,
    nullable: true,
  })
  cocktailRound?: number;

  @Column({
    name: 'theater',
    type: 'decimal',
    precision: 20,
    scale: 2,
    nullable: true,
  })
  theater?: number;

  @Column({
    name: 'classroom',
    type: 'decimal',
    precision: 20,
    scale: 2,
    nullable: true,
  })
  classroom?: number;

  @Column({
    name: 'boardroom',
    type: 'decimal',
    precision: 20,
    scale: 2,
    nullable: true,
  })
  boardroom?: number;

  @Column({
    name: 'e_shape',
    type: 'decimal',
    precision: 20,
    scale: 2,
    nullable: true,
  })
  eShape?: number;

  @Column({
    name: 'hollow_square',
    type: 'decimal',
    precision: 20,
    scale: 2,
    nullable: true,
  })
  hollowSquare?: number;

  @Column({
    name: 'perimeter_seating',
    type: 'decimal',
    precision: 20,
    scale: 2,
    nullable: true,
  })
  perimeterSeating?: number;

  @Column({
    name: 'royal_conf',
    type: 'decimal',
    precision: 20,
    scale: 2,
    nullable: true,
  })
  royalConf?: number;

  @Column({
    name: 't_shape',
    type: 'decimal',
    precision: 20,
    scale: 2,
    nullable: true,
  })
  tShape?: number;

  @Column({
    name: 'talk_show',
    type: 'decimal',
    precision: 20,
    scale: 2,
    nullable: true,
  })
  talkShow?: number;

  @Column({ name: 'publish_status', type: 'tinyint', default: 0 })
  publishStatus?: number;

  @Column({ name: 'aditional_info', type: 'text', nullable: true })
  additionalInfo?: string;

  @Column({ name: 'cancellation', type: 'text', nullable: true })
  cancellation?: string;

  @Column({ name: 'terms_condtion', type: 'text', nullable: true })
  termsCondition?: string;

  @Column({ name: 'privacy_policy', type: 'text', nullable: true })
  privacyPolicy?: string;

  @Column({ name: 'pax_terms_condtion', type: 'text', nullable: true })
  paxTermsCondition?: string;

  @Column({ name: 'paid_venue', type: 'tinyint', default: 0 })
  paidVenue?: number;

  @Column({ name: 'venue_mode', type: 'varchar', length: 255, nullable: true })
  venueMode?: string;

  @OneToMany(() => VenueChildAmenities, (amenity) => amenity.childVenue)
  childAmenities?: VenueChildAmenities[];

  @OneToMany(() => VenueGalleryCategory, (cat) => cat.childVenue)
  galleryCategories?: VenueGalleryCategory[];

 @OneToMany(() => Pricing, (pr) => pr.childVenue)
pricings?: Pricing[];

  @OneToMany(() => VenueGallery, (g) => g.childVenue)
  galleries?: VenueGallery[];

  @OneToMany(() => VenueShiftHeader, (sh) => sh.childVenue)
  shiftHeaders?: VenueShiftHeader[];

  @OneToMany(() => VenueShiftTiming, (st) => st.childVenue)
  shiftTimings?: VenueShiftTiming[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt?: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt?: Date;
}
