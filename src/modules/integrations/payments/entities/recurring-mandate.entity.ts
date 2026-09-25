import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { PaymentMethod } from '../enums/payment-method.enum';
import { MandateStatus } from '../enums/mandate-status.enum';
import { MandateFrequency } from '../enums/frequency.enum';
import { RecurringMandateTransaction } from './recurring-mandate-transaction.entity';

/**
 * A single Razorpay recurring "mandate" — the token-based authorization a
 * customer grants once (via UPI Autopay or Card OTP/3DS) that lets us debit
 * them again later without re-authentication.
 *
 * One row = one live authorization. A user who cancels and re-subscribes
 * gets a new row rather than a reused one, so history is never lost.
 */
@Entity('recurring_mandates')
@Index(['userId', 'status'])
export class RecurringMandate {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Index()
  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @Index()
  @Column({ name: 'razorpay_customer_id', type: 'varchar', length: 64 })
  razorpayCustomerId: string;

  /**
   * The Razorpay `token_id` (e.g. `token_Gzn7hz9AhjPnMz`) generated once the
   * authorization payment is captured. Null until then.
   */
  @Index()
  @Column({ name: 'token_id', type: 'varchar', length: 64, nullable: true })
  tokenId: string | null;

  /**
   * The NPCI/UPI mandate reference for UPI Autopay (`payment.upi.mandate_id`),
   * or the same value as `token_id` for card recurring where Razorpay does
   * not expose a separate mandate reference. Null until authenticated.
   */
  @Index()
  @Column({ name: 'mandate_id', type: 'varchar', length: 64, nullable: true })
  mandateId: string | null;

  @Column({
    name: 'payment_method',
    type: 'enum',
    enum: PaymentMethod,
  })
  paymentMethod: PaymentMethod;

  /**
   * The first, small "registration" charge used purely to authenticate the
   * mandate: ₹1 for UPI Autopay, ₹5 for cards (refunded once captured, per
   * Razorpay's card recurring guidelines). Stored in rupees.
   */
  @Column({
    name: 'authorization_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
  })
  authorizationAmount: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: MandateStatus,
    default: MandateStatus.CREATED,
  })
  status: MandateStatus;

  /**
   * Ceiling amount (rupees) Razorpay will allow us to debit per recurring
   * charge against this token — set to the subscription's plan amount at
   * creation time. `charge-token` validates every request against this.
   */
  @Column({ name: 'max_amount', type: 'decimal', precision: 12, scale: 2 })
  maxAmount: string;

  @Column({
    name: 'frequency',
    type: 'enum',
    enum: MandateFrequency,
  })
  frequency: MandateFrequency;

  @Column({ name: 'start_date', type: 'datetime' })
  startDate: Date;

  /**
   * Mandate expiry (mirrors the `token.expire_at` sent to Razorpay). Null
   * means "no expiry configured" — treat cautiously, Razorpay still
   * enforces its own token expiry even if we don't track it here.
   */
  @Column({ name: 'end_date', type: 'datetime', nullable: true })
  endDate: Date | null;

  /**
   * Operational field not in the original spec, kept nullable so it never
   * blocks anything: the Razorpay order used for the *authorization*
   * payment. Needed to reconcile `payment.captured` / `token.confirmed`
   * webhooks back to this row before a token_id exists yet.
   */
  @Index()
  @Column({
    name: 'razorpay_order_id',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  razorpayOrderId: string | null;

  /**
   * Free-form context: venue quantity, billing cycle, price-per-venue used,
   * card network/type once known, cancellation reason, etc. Keeps the
   * table schema stable while plan-specific data evolves.
   */
  // Typed as `any` rather than `Record<string, any> | null` on purpose:
  // TypeORM's DeepPartial inference for `.update()` calls chokes on an
  // index-signature object type here (spurious "not assignable to
  // _QueryDeepPartialEntity<...>" errors) — `any` sidesteps that while the
  // JSON column itself still round-trips a plain object fine at runtime.
  @Column({ name: 'metadata', type: 'json', nullable: true })
  metadata: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(
    () => RecurringMandateTransaction,
    (transaction) => transaction.mandate,
  )
  transactions: RecurringMandateTransaction[];
}
