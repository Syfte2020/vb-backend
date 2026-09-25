import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as crypto from 'crypto';

import { TwilioService } from '../../integrations/twilio/twilio.service';
/**
 * venuebook.in — Membership service (MySQL, plain SQL).
 * Same function names + response shapes as services/membership.static.js.
 *
 * ⚠ VENUE_TABLE: change to your real vendor-venue table/columns.
 */
const VENUE_TABLE = { table: 'venue_child', id: 'child_venue_id', vendor: 'created_by', name: 'child_venue_name' };

const CYCLE_MONTHS: Record<string, number> = { monthly: 1, quarterly: 3, yearly: 12 };

@Injectable()
export class MembershipService {
  constructor(private readonly db: DataSource,

    private readonly twilioService: TwilioService,
  ) {}

  /* ───────── helpers ───────── */

  private json<T>(v: any, fallback: T): T {
    if (v == null) return fallback;
    if (typeof v === 'string') {
      try { return JSON.parse(v); } catch { return fallback; }
    }
    return v;
  }

  private expiryFor(start: Date, cycle: string): Date | null {
    const months = CYCLE_MONTHS[cycle];
    if (!months) return null; // lifetime
    const d = new Date(start);
    d.setMonth(d.getMonth() + months);
    return d;
  }

  private formatNumber(prefix: string, n: number, digits: number) {
    return `${prefix ?? ''}${String(n).padStart(digits || 1, '0')}`;
  }

  /** Locks the program row and issues the next member number. Call inside a transaction. */
  private async issueNumber(q: any, vendorId: number): Promise<string> {
    await q.query('INSERT IGNORE INTO membership_programs (vendor_id) VALUES (?)', [vendorId]);
    const [p] = await q.query('SELECT * FROM membership_programs WHERE vendor_id = ? FOR UPDATE', [vendorId]);
    const n = Number(p.member_id_next_number) || 1;
    await q.query('UPDATE membership_programs SET member_id_next_number = ? WHERE vendor_id = ?', [n + 1, vendorId]);
    return this.formatNumber(p.member_id_prefix, n, p.member_id_digits);
  }

  private async ensureProgram(vendorId: number) {
    await this.db.query('INSERT IGNORE INTO membership_programs (vendor_id) VALUES (?)', [vendorId]);
  }

  private tierOut(t: any) {
    return {
      id: t.id,
      name: t.name,
      description: t.description,
      price: Number(t.price),
      billing_cycle: t.billing_cycle,
      benefits: this.json(t.benefits, { custom: [] }),
      early_booking_days: t.early_booking_days,
      pricing: t.discount_type ? { discount_type: t.discount_type, discount_value: Number(t.discount_value) } : null,
      all_venues_eligible: !!t.all_venues_eligible,
      venue_ids: this.json<string[]>(t.venue_ids, []),
      sort_order: t.sort_order,
      archived: !!t.archived,
      ...(t.member_count != null && { member_count: Number(t.member_count) }),
    };
  }

  private tierParams(data: any) {
    return [
      data.name?.trim(),
      data.description ?? '',
      Number(data.price) || 0,
      data.billing_cycle ?? 'yearly',
      JSON.stringify(data.benefits ?? {}),
      data.early_booking_days ?? null,
      data.pricing?.discount_type ?? null,
      data.pricing?.discount_value ?? null,
      data.all_venues_eligible === false ? 0 : 1,
      JSON.stringify(data.venue_ids ?? []),
    ];
  }

  /** Does this tier unlock this venue's access rule? */
  private tierUnlocks(tier: any, venueId: string, accessTierIds: string[]) {
    if (!tier || tier.archived) return false;
    if (accessTierIds.length && !accessTierIds.map(String).includes(String(tier.id))) return false;
    if (!tier.all_venues_eligible && !this.json<string[]>(tier.venue_ids, []).map(String).includes(String(venueId))) return false;
    return true;
  }

  private async vendorAccessRows(vendorId: number) {
    const rows = await this.db.query(
      `SELECT venue_id, access_mode, tier_ids FROM membership_venue_access WHERE vendor_id = ? AND access_mode <> 'public'`,
      [vendorId],
    );
    return rows.map((r: any) => ({ venue_id: String(r.venue_id), mode: r.access_mode, tier_ids: this.json<string[]>(r.tier_ids, []) }));
  }

  /* ───────── vendor: program / overview ───────── */

  async getMembershipProgram(vendorId: number) {
    await this.ensureProgram(vendorId);
    const [p] = await this.db.query('SELECT * FROM membership_programs WHERE vendor_id = ?', [vendorId]);
    return {
      public_booking_window_days: p.public_booking_window_days,
      renewal_grace_days: p.renewal_grace_days,
      expiry_reminder_days: p.expiry_reminder_days,
      allow_online_signup: !!p.allow_online_signup,
      member_id_prefix: p.member_id_prefix,
      member_id_next_number: p.member_id_next_number,
      member_id_digits: p.member_id_digits,
    };
  }

  async saveMembershipProgram(vendorId: number, data: any) {
    const cur = await this.getMembershipProgram(vendorId);
    const next = { ...cur, ...data };

    if (next.member_id_prefix === cur.member_id_prefix) {
      const rows = await this.db.query(
        'SELECT member_number FROM memberships WHERE vendor_id = ? AND member_number LIKE ?',
        [vendorId, `${cur.member_id_prefix}%`],
      );
      const highest = rows.reduce((max: number, r: any) => {
        const tail = Number(String(r.member_number).slice(cur.member_id_prefix.length));
        return Number.isFinite(tail) ? Math.max(max, tail) : max;
      }, 0);
      if (Number(next.member_id_next_number) <= highest) {
        throw new BadRequestException(`Next member number must be higher than ${highest}, the highest already issued.`);
      }
    }

    await this.db.query(
      `UPDATE membership_programs SET public_booking_window_days = ?, renewal_grace_days = ?, expiry_reminder_days = ?,
         allow_online_signup = ?, member_id_prefix = ?, member_id_next_number = ?, member_id_digits = ?
       WHERE vendor_id = ?`,
      [
        next.public_booking_window_days, next.renewal_grace_days, next.expiry_reminder_days,
        next.allow_online_signup ? 1 : 0, next.member_id_prefix, next.member_id_next_number, next.member_id_digits,
        vendorId,
      ],
    );
    return this.getMembershipProgram(vendorId);
  }

  async getMembershipOverview(vendorId: number) {
    const [[a], [t], [v], [e], [r]] = await Promise.all([
      this.db.query(`SELECT COUNT(*) c FROM memberships WHERE vendor_id = ? AND status = 'active'`, [vendorId]),
      this.db.query(`SELECT COUNT(*) c FROM membership_tiers WHERE vendor_id = ? AND archived = 0`, [vendorId]),
      this.db.query(`SELECT COUNT(*) c FROM membership_venue_access WHERE vendor_id = ? AND access_mode = 'members_only'`, [vendorId]),
      this.db.query(
        `SELECT COUNT(*) c FROM memberships WHERE vendor_id = ? AND status = 'active'
           AND expires_at IS NOT NULL AND expires_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 30 DAY)`,
        [vendorId],
      ),
      this.db.query(
        `SELECT COALESCE(SUM(CASE WHEN type = 'refund' THEN -amount WHEN status = 'paid' THEN amount ELSE 0 END), 0) total
           FROM membership_transactions WHERE vendor_id = ?`,
        [vendorId],
      ),
    ]);
    const breakdown = await this.db.query(
      `SELECT t.id tier_id, t.name, COUNT(m.id) count
         FROM membership_tiers t
         LEFT JOIN memberships m ON m.tier_id = t.id AND m.status = 'active'
        WHERE t.vendor_id = ?
        GROUP BY t.id, t.name, t.sort_order
        ORDER BY t.sort_order`,
      [vendorId],
    );
    return {
      active_members: Number(a.c),
      active_tiers: Number(t.c),
      members_only_venues: Number(v.c),
      expiring_soon: Number(e.c),
      revenue: Number(r.total),
      tier_breakdown: breakdown.map((b: any) => ({ tier_id: b.tier_id, name: b.name, count: Number(b.count) })),
    };
  }

  /* ───────── vendor: tiers ───────── */

  private async findTier(vendorId: number, id: number | string) {
    const [t] = await this.db.query(
      `SELECT t.*, (SELECT COUNT(*) FROM memberships m WHERE m.tier_id = t.id AND m.status = 'active') member_count
         FROM membership_tiers t WHERE t.id = ? AND t.vendor_id = ?`,
      [id, vendorId],
    );
    if (!t) throw new NotFoundException('Tier not found.');
    return t;
  }

  private async assertUniqueName(vendorId: number, name: string, exceptId: number | string = 0) {
    const [dup] = await this.db.query(
      `SELECT id FROM membership_tiers WHERE vendor_id = ? AND archived = 0 AND LOWER(TRIM(name)) = LOWER(TRIM(?)) AND id <> ?`,
      [vendorId, name ?? '', exceptId],
    );
    if (dup) throw new BadRequestException('A tier with this name already exists.');
  }

  async listMembershipTiers(vendorId: number, includeArchived = false) {
    const rows = await this.db.query(
      `SELECT t.*, (SELECT COUNT(*) FROM memberships m WHERE m.tier_id = t.id AND m.status = 'active') member_count
         FROM membership_tiers t
        WHERE t.vendor_id = ? ${includeArchived ? '' : 'AND t.archived = 0'}
        ORDER BY t.sort_order`,
      [vendorId],
    );
    return { tiers: rows.map((t: any) => this.tierOut(t)) };
  }

  async createMembershipTier(vendorId: number, data: any) {
    if (!data?.name?.trim()) throw new BadRequestException('Tier name is required.');
    await this.assertUniqueName(vendorId, data.name);
    const [{ next }] = await this.db.query(
      'SELECT COALESCE(MAX(sort_order) + 1, 0) next FROM membership_tiers WHERE vendor_id = ?',
      [vendorId],
    );
    const res = await this.db.query(
      `INSERT INTO membership_tiers
         (name, description, price, billing_cycle, benefits, early_booking_days, discount_type, discount_value,
          all_venues_eligible, venue_ids, vendor_id, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [...this.tierParams(data), vendorId, next],
    );
    return this.tierOut(await this.findTier(vendorId, res.insertId));
  }

  async updateMembershipTier(vendorId: number, id: number, data: any) {
    await this.findTier(vendorId, id);
    await this.assertUniqueName(vendorId, data?.name, id);
    await this.db.query(
      `UPDATE membership_tiers SET name = ?, description = ?, price = ?, billing_cycle = ?, benefits = ?,
         early_booking_days = ?, discount_type = ?, discount_value = ?, all_venues_eligible = ?, venue_ids = ?
       WHERE id = ? AND vendor_id = ?`,
      [...this.tierParams(data), id, vendorId],
    );
    return this.tierOut(await this.findTier(vendorId, id));
  }

  async setTierArchived(vendorId: number, id: number, archived: boolean) {
    await this.findTier(vendorId, id);
    await this.db.query('UPDATE membership_tiers SET archived = ? WHERE id = ? AND vendor_id = ?', [archived ? 1 : 0, id, vendorId]);
    return this.tierOut(await this.findTier(vendorId, id));
  }

  async reorderMembershipTiers(vendorId: number, ids: (number | string)[]) {
    await this.db.transaction(async (q) => {
      for (let i = 0; i < ids.length; i++) {
        await q.query('UPDATE membership_tiers SET sort_order = ? WHERE id = ? AND vendor_id = ?', [i, ids[i], vendorId]);
      }
      // tiers not in the list (e.g. archived) go after, keeping their order
      const rest = await q.query('SELECT id FROM membership_tiers WHERE vendor_id = ? ORDER BY sort_order', [vendorId]);
      let n = ids.length;
      for (const r of rest) {
        if (!ids.map(String).includes(String(r.id))) {
          await q.query('UPDATE membership_tiers SET sort_order = ? WHERE id = ?', [n++, r.id]);
        }
      }
    });
    return { ok: true };
  }

  /* ───────── vendor: venue access ───────── */

  async listMembershipVenues(vendorId: number) {
    const V = VENUE_TABLE;
    const rows = await this.db.query(
      `SELECT v.${V.id} id, v.${V.name} name, a.access_mode, a.tier_ids
         FROM ${V.table} v
         LEFT JOIN membership_venue_access a ON a.venue_id = v.${V.id}
        WHERE v.${V.vendor} = ?`,
      [vendorId],
    );
    return {
      venues: rows.map((r: any) => ({
        id: String(r.id),
        name: r.name,
        city: r.city ?? '',
        access_mode: r.access_mode ?? 'public',
        tier_ids: this.json<string[]>(r.tier_ids, []),
      })),
    };
  }

  async saveMembershipVenueAccess(vendorId: number, venueId: string, data: any) {
    const V = VENUE_TABLE;
    const [venue] = await this.db.query(
      `SELECT ${V.id} id FROM ${V.table} WHERE ${V.id} = ? AND ${V.vendor} = ?`,
      [venueId, vendorId],
    );
    if (!venue) throw new NotFoundException('Venue not found.');

    const mode = data?.mode ?? 'public';
    const tierIds = mode === 'public' ? [] : data?.tier_ids ?? [];
    await this.db.query(
      `INSERT INTO membership_venue_access (venue_id, vendor_id, access_mode, tier_ids) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE access_mode = VALUES(access_mode), tier_ids = VALUES(tier_ids)`,
      [venueId, vendorId, mode, JSON.stringify(tierIds)],
    );
    return { id: String(venueId), access_mode: mode, tier_ids: tierIds };
  }

  /* ───────── vendor: members ───────── */

  private memberRow(m: any, tiersById: Map<string, any>, access: any[]) {
    const tier = tiersById.get(String(m.tier_id));
    return {
      id: m.id,
      member_number: m.member_number,
      customer: { name: m.customer_name, email: m.customer_email, phone: m.customer_phone },
      tier: tier ? { id: tier.id, name: tier.name } : null,
      status: m.status,
      starts_at: m.starts_at,
      expires_at: m.expires_at,
      payment_status: m.payment_status,
      eligible_venue_count: access.filter((a) => this.tierUnlocks(tier, a.venue_id, a.tier_ids)).length,
    };
  }

  private async tierMap(vendorId: number) {
    const tiers = await this.db.query('SELECT * FROM membership_tiers WHERE vendor_id = ?', [vendorId]);
    return new Map<string, any>(tiers.map((t: any) => [String(t.id), t]));
  }

  async listMembershipMembers(vendorId: number, params: any = {}) {
    const where = ['m.vendor_id = ?'];
    const args: any[] = [vendorId];

    if (params.status) { where.push('m.status = ?'); args.push(params.status); }
    if (params.tier_id) { where.push('m.tier_id = ?'); args.push(params.tier_id); }
    if (params.q) {
      where.push('(m.member_number LIKE ? OR m.customer_name LIKE ? OR m.customer_email LIKE ? OR m.customer_phone LIKE ?)');
      const like = `%${String(params.q).trim()}%`;
      args.push(like, like, like, like);
    }
    if (params.expiring) {
      where.push(`m.status = 'active' AND m.expires_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 30 DAY)`);
    }

    const limit = Math.min(Number(params.limit) || 20, 100);
    const page = Math.max(1, Number(params.page) || 1);
    const sqlWhere = where.join(' AND ');

    const [{ total }] = await this.db.query(`SELECT COUNT(*) total FROM memberships m WHERE ${sqlWhere}`, args);
    const rows = await this.db.query(
      `SELECT m.* FROM memberships m WHERE ${sqlWhere} ORDER BY m.starts_at DESC LIMIT ? OFFSET ?`,
      [...args, limit, (page - 1) * limit],
    );

    const [tiers, access] = await Promise.all([this.tierMap(vendorId), this.vendorAccessRows(vendorId)]);
    return { members: rows.map((m: any) => this.memberRow(m, tiers, access)), total: Number(total) };
  }

  async getMembershipMember(vendorId: number, id: number) {
    const [m] = await this.db.query('SELECT * FROM memberships WHERE id = ? AND vendor_id = ?', [id, vendorId]);
    if (!m) throw new NotFoundException('Member not found.');

    const [tiers, access] = await Promise.all([this.tierMap(vendorId), this.vendorAccessRows(vendorId)]);
    const tier = tiers.get(String(m.tier_id));
    const eligibleIds = access.filter((a) => this.tierUnlocks(tier, a.venue_id, a.tier_ids)).map((a) => a.venue_id);

    const V = VENUE_TABLE;
    const eligible = eligibleIds.length
      ? await this.db.query(`SELECT ${V.id} id, ${V.name} name FROM ${V.table} WHERE ${V.id} IN (?)`, [eligibleIds])
      : [];
    const transactions = await this.db.query(
      `SELECT id, membership_id, type, amount, currency, status, created_at
         FROM membership_transactions WHERE membership_id = ? ORDER BY created_at`,
      [m.id],
    );

    return {
      ...this.memberRow(m, tiers, access),
      amount_paid: Number(m.amount_paid),
      source: m.source,
      all_venues: !!tier?.all_venues_eligible,
      eligible_venues: eligible.map((v: any) => ({ id: String(v.id), name: v.name })),
      bookings: [], // TODO: join your bookings table on the member's user_id / email
      transactions: transactions.map((t: any) => ({ ...t, amount: Number(t.amount) })),
    };
  }

  async createMembershipMember(vendorId: number, data: any) {
    const [tier] = await this.db.query('SELECT * FROM membership_tiers WHERE id = ? AND vendor_id = ?', [data?.tier_id, vendorId]);
    if (!tier) throw new BadRequestException('Choose a tier.');

    const name = data?.customer?.name?.trim() ?? '';
    const email = data?.customer?.email?.trim().toLowerCase() ?? '';
    const phone = data?.customer?.phone?.trim() ?? '';
    if (!name && !email && !phone) throw new BadRequestException('Add a name, email or phone.');

    const [dup] = await this.db.query(
      `SELECT id FROM memberships
        WHERE vendor_id = ? AND status IN ('active','pending')
          AND ((? <> '' AND LOWER(customer_email) = ?) OR (? <> '' AND customer_phone = ?))`,
      [vendorId, email, email, phone, phone],
    );
    if (dup) throw new ConflictException('This customer already has an active membership.');

    const start = data.starts_at ? new Date(data.starts_at) : new Date();
    const paymentStatus = data.payment_status || 'paid';
    const paid = paymentStatus === 'paid';

    const id = await this.db.transaction(async (q) => {
      const number = await this.issueNumber(q, vendorId);
      const res = await q.query(
        `INSERT INTO memberships
           (vendor_id, member_number, customer_name, customer_email, customer_phone, tier_id, status,
            starts_at, expires_at, payment_status, amount_paid, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual')`,
        [
          vendorId, number, name, email, phone, tier.id,
          paymentStatus === 'pending' ? 'pending' : 'active',
          start, this.expiryFor(start, tier.billing_cycle), paymentStatus, paid ? tier.price : 0,
        ],
      );
      if (paid) {
        await q.query(
          `INSERT INTO membership_transactions (vendor_id, membership_id, tier_id, type, amount, status)
           VALUES (?, ?, ?, 'purchase', ?, 'paid')`,
          [vendorId, res.insertId, tier.id, tier.price],
        );
      }
      return res.insertId;
    });
    return { id };
  }

  async updateMembershipMember(vendorId: number, id: number, data: any) {
    const [m] = await this.db.query('SELECT id FROM memberships WHERE id = ? AND vendor_id = ?', [id, vendorId]);
    if (!m) throw new NotFoundException('Member not found.');

    const sets: string[] = [];
    const args: any[] = [];
    if (data.tier_id != null) {
      const [t] = await this.db.query('SELECT id FROM membership_tiers WHERE id = ? AND vendor_id = ?', [data.tier_id, vendorId]);
      if (!t) throw new BadRequestException('Tier not found.');
      sets.push('tier_id = ?'); args.push(t.id);
    }
    if (data.status) { sets.push('status = ?'); args.push(data.status); }
    if ('expires_at' in data) { sets.push('expires_at = ?'); args.push(data.expires_at ? new Date(data.expires_at) : null); }

    if (sets.length) {
      await this.db.query(`UPDATE memberships SET ${sets.join(', ')} WHERE id = ?`, [...args, id]);
    }
    return { id: m.id };
  }

  /* ───────── customer ───────── */

  /** Pass vendor_id, or venue_id (vendor is looked up from the venue). */
  async listPublicMembershipTiers(params: { vendor_id?: number; venue_id?: number }) {
    let vendorId = params.vendor_id;
    let access: any = null;

    if (params.venue_id) {
      const V = VENUE_TABLE;
      const [v] = await this.db.query(`SELECT ${V.vendor} vendor_id FROM ${V.table} WHERE ${V.id} = ?`, [params.venue_id]);
      if (!v) return { tiers: [] };
      vendorId = v.vendor_id;
      [access] = await this.db.query('SELECT * FROM membership_venue_access WHERE venue_id = ?', [params.venue_id]);
    }
    if (!vendorId) throw new BadRequestException('vendor_id or venue_id is required.');

    const program = await this.getMembershipProgram(vendorId);
    if (!program.allow_online_signup) return { tiers: [] };

    let tiers = await this.db.query(
      'SELECT * FROM membership_tiers WHERE vendor_id = ? AND archived = 0 ORDER BY sort_order',
      [vendorId],
    );
    if (access && access.access_mode !== 'public') {
      const ids = this.json<string[]>(access.tier_ids, []);
      tiers = tiers.filter((t: any) => this.tierUnlocks(t, String(params.venue_id), ids));
    }
    return {
      tiers: tiers.map((t: any) => {
        const o = this.tierOut(t);
        return {
          id: o.id, name: o.name, description: o.description, price: o.price, billing_cycle: o.billing_cycle,
          benefits: o.benefits, early_booking_days: o.early_booking_days, pricing: o.pricing,
        };
      }),
    };
  }

  async getMyMemberships(userId: number) {
    const rows = await this.db.query(
      `SELECT m.id, m.status, m.starts_at, m.expires_at, t.id tier_id, t.name tier_name
         FROM memberships m JOIN membership_tiers t ON t.id = m.tier_id
        WHERE m.user_id = ?
        ORDER BY m.starts_at DESC`,
      [userId],
    );
    return {
      memberships: rows.map((r: any) => ({
        id: r.id,
        tier: { id: r.tier_id, name: r.tier_name },
        status: r.status,
        starts_at: r.starts_at,
        expires_at: r.expires_at,
      })),
    };
  }

  async getVenueEligibility(userId: number, venueId: number) {
    const [access] = await this.db.query('SELECT * FROM membership_venue_access WHERE venue_id = ?', [venueId]);
    if (!access || access.access_mode !== 'members_only') return { allowed: true, reason: null };

    const accessTierIds = this.json<string[]>(access.tier_ids, []);
    const [required] = accessTierIds.length
      ? await this.db.query(
          'SELECT name FROM membership_tiers WHERE id IN (?) AND archived = 0 ORDER BY sort_order LIMIT 1',
          [accessTierIds],
        )
      : [null];
    const requiredName = required?.name ?? null;
    const deny = (reason: string) => ({ allowed: false, reason, required_tier: requiredName });

    const [m] = await this.db.query(
      `SELECT * FROM memberships WHERE user_id = ? AND vendor_id = ? ORDER BY starts_at DESC LIMIT 1`,
      [userId, access.vendor_id],
    );
    if (!m || m.status === 'cancelled') return deny('MEMBERSHIP_REQUIRED');
    if (m.status === 'expired' || (m.expires_at && new Date(m.expires_at).getTime() < Date.now())) return deny('MEMBERSHIP_EXPIRED');
    if (m.status === 'suspended') return deny('MEMBERSHIP_SUSPENDED');
    if (m.status === 'pending') return deny('MEMBERSHIP_PENDING');

    const [tier] = await this.db.query('SELECT * FROM membership_tiers WHERE id = ?', [m.tier_id]);
    if (!this.tierUnlocks(tier, String(venueId), accessTierIds)) return deny('TIER_UPGRADE_REQUIRED');

    return {
      allowed: true,
      reason: null,
      membership: { id: m.id, tier: { id: tier.id, name: tier.name }, expires_at: m.expires_at },
      member_price: tier.discount_type ? { discount_type: tier.discount_type, discount_value: Number(tier.discount_value) } : null,
    };
  }

  /**
   * Step 1 of an online purchase. Creates a transaction row.
   * Free tier → activates immediately. Paid tier → create the Razorpay order with your
   * existing RazorpayApiClient and save its id via razorpay_order_id.
   */
  async startMembershipPurchase(user: { id: number; name?: string; email?: string; phone?: string }, data: any) {
    const [tier] = await this.db.query('SELECT * FROM membership_tiers WHERE id = ? AND archived = 0', [data?.tier_id]);
    if (!tier) throw new BadRequestException('Tier not available.');

    const res = await this.db.query(
      `INSERT INTO membership_transactions (vendor_id, user_id, tier_id, type, amount, status, razorpay_order_id)
       VALUES (?, ?, ?, 'purchase', ?, 'created', ?)`,
      [tier.vendor_id, user.id, tier.id, tier.price, data?.razorpay_order_id ?? null],
    );

    if (Number(tier.price) <= 0) {
      const membershipId = await this.activate(res.insertId, user, null);
      return { membership_id: membershipId, activated: true };
    }
    return { transaction_id: res.insertId, amount: Number(tier.price), currency: 'INR', activated: false };
  }

  /** Step 2: frontend sends Razorpay's success payload. Verify signature, then activate. */
  async verifyMembershipPurchase(user: { id: number; name?: string; email?: string; phone?: string }, data: any) {
    const { transaction_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = data ?? {};
    const [tx] = await this.db.query(
      'SELECT * FROM membership_transactions WHERE id = ? AND user_id = ?',
      [transaction_id, user.id],
    );
    if (!tx) throw new NotFoundException('Purchase not found.');
    if (tx.status === 'paid') return { ok: true, membership_id: tx.membership_id };

    // Razorpay signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret)
    // Swap process.env for your IntegrationService secret if that's where it lives.
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET ?? '')
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');
    if (!razorpay_signature || expected !== razorpay_signature || tx.razorpay_order_id !== razorpay_order_id) {
      await this.db.query(`UPDATE membership_transactions SET status = 'failed' WHERE id = ?`, [tx.id]);
      throw new BadRequestException('Payment verification failed.');
    }

    const membershipId = await this.activate(tx.id, user, razorpay_payment_id);
    return { ok: true, membership_id: membershipId };
  }

  /** Marks the transaction paid and creates / renews / upgrades the user's membership with that vendor. */
  private async activate(txId: number, user: { id: number; name?: string; email?: string; phone?: string }, paymentId: string | null) {
    return this.db.transaction(async (q) => {
      const [tx] = await q.query('SELECT * FROM membership_transactions WHERE id = ? FOR UPDATE', [txId]);
      const [tier] = await q.query('SELECT * FROM membership_tiers WHERE id = ?', [tx.tier_id]);
      const now = new Date();
      const expires = this.expiryFor(now, tier.billing_cycle);
      const paymentStatus = Number(tier.price) > 0 ? 'paid' : 'waived';

      const [existing] = await q.query(
        'SELECT id FROM memberships WHERE user_id = ? AND vendor_id = ? ORDER BY starts_at DESC LIMIT 1 FOR UPDATE',
        [user.id, tx.vendor_id],
      );

      let membershipId: number;
      if (existing) {
        // keep the member number, switch tier + restart the period
        await q.query(
          `UPDATE memberships SET tier_id = ?, status = 'active', starts_at = ?, expires_at = ?,
             payment_status = ?, amount_paid = ? WHERE id = ?`,
          [tier.id, now, expires, paymentStatus, tier.price, existing.id],
        );
        membershipId = existing.id;
      } else {
        const number = await this.issueNumber(q, tx.vendor_id);
        const res = await q.query(
          `INSERT INTO memberships
             (vendor_id, user_id, member_number, customer_name, customer_email, customer_phone, tier_id, status,
              starts_at, expires_at, payment_status, amount_paid, source)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, 'online')`,
          [
            tx.vendor_id, user.id, number, user.name ?? '', (user.email ?? '').toLowerCase(), user.phone ?? '',
            tier.id, now, expires, paymentStatus, tier.price,
          ],
        );
        membershipId = res.insertId;
      }

      await q.query(
        `UPDATE membership_transactions SET status = 'paid', membership_id = ?, razorpay_payment_id = ? WHERE id = ?`,
        [membershipId, paymentId, txId],
      );
      return membershipId;
    });
  }

  /** Optional: call from a daily cron to flip lapsed memberships to 'expired'. */
  async expireLapsed() {
    await this.db.query(
      `UPDATE memberships SET status = 'expired' WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at < NOW()`,
    );
  }


  /* ───────── vendor: member lookup + OTP (booking form) ───────── */
 
  /**
   * Can this member book ALL of these venues right now?
   * Returns null when allowed, otherwise a reason code.
   * Call this again from your booking-create service — never trust the frontend alone.
   */
  async memberBlockReason(m: any, venueIds: (number | string)[]): Promise<string | null> {
    if (m.status === 'cancelled') return 'MEMBERSHIP_REQUIRED';
    if (m.status === 'expired' || (m.expires_at && new Date(m.expires_at).getTime() < Date.now())) return 'MEMBERSHIP_EXPIRED';
    if (m.status === 'suspended') return 'MEMBERSHIP_SUSPENDED';
    if (m.status === 'pending') return 'MEMBERSHIP_PENDING';
    if (!venueIds.length) return null;
 
    const [tier] = await this.db.query('SELECT * FROM membership_tiers WHERE id = ?', [m.tier_id]);
    const rules = await this.db.query(
      `SELECT venue_id, access_mode, tier_ids FROM membership_venue_access
        WHERE venue_id IN (?) AND access_mode <> 'public'`,
      [venueIds],
    );
    for (const r of rules) {
      if (!this.tierUnlocks(tier, String(r.venue_id), this.json<string[]>(r.tier_ids, []))) return 'TIER_UPGRADE_REQUIRED';
    }
    return null;
  }
 
  async lookupMemberForBooking(vendorId: number, number: string, venueIds: (number | string)[]) {
    const [m] = await this.db.query(
      'SELECT * FROM memberships WHERE vendor_id = ? AND UPPER(member_number) = UPPER(?)',
      [vendorId, String(number ?? '').trim()],
    );
    if (!m) throw new NotFoundException('Member not found.');
 
    const [tier] = await this.db.query('SELECT * FROM membership_tiers WHERE id = ?', [m.tier_id]);
    const reason = await this.memberBlockReason(m, venueIds);
    return {
      id: m.id,
      name: m.customer_name,
      phone: m.customer_phone,
      email: m.customer_email,
      membership_no: m.member_number,
      tier: tier ? { id: tier.id, name: tier.name } : null,
      status: m.status,
      expires_at: m.expires_at,
      eligible: reason === null,
      reason,
      member_price: tier?.discount_type
        ? { discount_type: tier.discount_type, discount_value: Number(tier.discount_value) }
        : null,
    };
  }
 
  private hashOtp(otp: string) {
    return crypto.createHash('sha256').update(otp).digest('hex');
  }
 
  async sendMemberOtp(vendorId: number, memberId: number) {
    const [m] = await this.db.query('SELECT * FROM memberships WHERE id = ? AND vendor_id = ?', [memberId, vendorId]);
    if (!m) throw new NotFoundException('Member not found.');
    if (!m.customer_phone) throw new BadRequestException('This member has no phone number on file.');
 
    const otp = String(crypto.randomInt(100000, 1000000));
    await this.db.query(
      `INSERT INTO membership_otps (membership_id, otp_hash, expires_at, attempts, verified_at)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE), 0, NULL)
       ON DUPLICATE KEY UPDATE otp_hash = VALUES(otp_hash), expires_at = VALUES(expires_at), attempts = 0, verified_at = NULL`,
      [m.id, this.hashOtp(otp)],
    );


const phone = String(m.customer_phone).replace(/\D/g, "");

const phoneWithCountryCode = phone.startsWith("91")
  ? `+${phone}`
  : `+91${phone}`;

await this.twilioService.sendWhatsApp(phoneWithCountryCode, otp);
    
 
    // TODO: send through your existing SMS/WhatsApp provider, e.g.
    //   await this.sms.send(m.customer_phone, `Your venuebook.in membership OTP is ${otp}`);
    if (process.env.NODE_ENV !== 'production') console.log(`[membership OTP] member ${m.id}: ${otp}`);
 
    return { sent: true };
  }
 
  async verifyMemberOtp(vendorId: number, memberId: number, otp: string) {
    const [row] = await this.db.query(
      `SELECT o.* FROM membership_otps o JOIN memberships m ON m.id = o.membership_id
        WHERE o.membership_id = ? AND m.vendor_id = ?`,
      [memberId, vendorId],
    );
    if (!row || new Date(row.expires_at).getTime() < Date.now() || row.attempts >= 5) return { verified: false };
 
    const ok = crypto.timingSafeEqual(Buffer.from(row.otp_hash), Buffer.from(this.hashOtp(String(otp ?? '').trim())));
    if (!ok) {
      await this.db.query('UPDATE membership_otps SET attempts = attempts + 1 WHERE membership_id = ?', [memberId]);
      return { verified: false };
    }
    await this.db.query('UPDATE membership_otps SET verified_at = NOW() WHERE membership_id = ?', [memberId]);
    return { verified: true };
  }
 
  /** For your booking-create service: member must be OTP-verified in the last 30 min and allowed at these venues. */
  async assertMemberCanBook(vendorId: number, memberId: number, venueIds: (number | string)[]) {
    const [m] = await this.db.query(
      `SELECT m.* FROM memberships m JOIN membership_otps o ON o.membership_id = m.id
        WHERE m.id = ? AND m.vendor_id = ? AND o.verified_at > DATE_SUB(NOW(), INTERVAL 30 MINUTE)`,
      [memberId, vendorId],
    );
    if (!m) throw new BadRequestException('Membership is not verified.');
    const reason = await this.memberBlockReason(m, venueIds);
    if (reason) throw new BadRequestException(reason);
    return m;
  }
 
 
}
