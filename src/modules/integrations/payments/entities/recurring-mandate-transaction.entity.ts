import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import {
  TransactionStatus,
  TransactionType,
} from '../enums/transaction-status.enum';
import { RecurringMandate } from './recurring-mandate.entity';

/**
 * Immutable audit trail of every attempt to move money against a mandate —
 * the authorization charge, every recurring debit, and any refund. This is
 * what "log transaction history" (requirement 7) and dispute/reconciliation
 * investigations both read from. Rows are written BEFORE calling Razorpay
 * (status = processing) and updated after the response comes back, so a
 * crash mid-call still leaves a trace instead of a silent gap.
 *
 * CHANGED (problem #10): added a unique index on (mandate_id,
 * idempotency_key). Previously idempotency_key only had a plain (non-
 * unique) index, so the app-level "does a transaction with this key
 * already exist?" check in RazorpayService.chargeToken() had a race
 * window — two near-simultaneous calls (e.g. a manual retry racing the
 * cron) could both pass that SELECT before either INSERT committed,
 * producing two recurring charges for the same billing period. NULL
 * values (authorization-type transactions, which don't use an idempotency
 * key) are exempt from this constraint on both MySQL and Postgres — each
 * NULL is treated as distinct — so this only constrains rows that
 * actually set a key.
 */
@Entity('recurring_mandate_transactions')
@Index(['mandateId', 'status'])
@Index(['mandateId', 'idempotencyKey'], { unique: true })
export class RecurringMandateTransaction {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Index()
  @Column({ name: 'mandate_id', type: 'int' })
  mandateId: number;

  @ManyToOne(() => RecurringMandate, (mandate) => mandate.transactions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'mandate_id' })
  mandate: RecurringMandate;

  @Column({ name: 'transaction_type', type: 'enum', enum: TransactionType })
  transactionType: TransactionType;

  @Index()
  @Column({
    name: 'razorpay_order_id',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  razorpayOrderId: string | null;

  @Index()
  @Column({
    name: 'razorpay_payment_id',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  razorpayPaymentId: string | null;

  @Column({ name: 'amount', type: 'decimal', precision: 12, scale: 2 })
  amount: string;

  @Column({ name: 'currency', type: 'varchar', length: 3, default: 'INR' })
  currency: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.INITIATED,
  })
  status: TransactionStatus;

  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason: string | null;

  /** Raw Razorpay response/webhook payload for this event, for audits. */
  @Column({ name: 'raw_response', type: 'json', nullable: true })
  rawResponse: Record<string, any> | null;

  /**
   * Caller-supplied idempotency key for `charge-token` (e.g.
   * `sub_42_2026-10`). A repeat request with the same key + mandate_id
   * returns the original transaction instead of charging twice — see
   * `RazorpayService.chargeToken`. Now backed by a real unique constraint
   * (mandate_id, idempotency_key) — see the class-level note above.
   */
  @Column({
    name: 'idempotency_key',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  idempotencyKey: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
