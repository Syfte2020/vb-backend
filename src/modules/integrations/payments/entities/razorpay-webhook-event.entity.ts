import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from 'typeorm';

/**
 * Idempotency ledger for inbound Razorpay webhooks. Razorpay retries
 * webhooks that don't return 2xx quickly, and can also send the same event
 * more than once — this table is what lets the webhook handler safely
 * no-op on a repeat instead of double-crediting a payment.
 */
@Entity('razorpay_webhook_events')
export class RazorpayWebhookEvent {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Index({ unique: true })
  @Column({ name: 'event_id', type: 'varchar', length: 64 })
  eventId: string;

  @Column({ name: 'event_type', type: 'varchar', length: 64 })
  eventType: string;

  @Column({ name: 'payload', type: 'json' })
  payload: Record<string, any>;

  @Column({
    name: 'status',
    type: 'enum',
    enum: ['received', 'processed', 'failed'],
    default: 'received',
  })
  status: 'received' | 'processed' | 'failed';

  @Column({ name: 'error', type: 'text', nullable: true })
  error: string | null;

  @Column({ name: 'processed_at', type: 'datetime', nullable: true })
  processedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
