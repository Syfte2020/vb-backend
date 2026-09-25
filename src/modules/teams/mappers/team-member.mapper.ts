import { User } from '../entities/user.entity';
import { UserRole } from '../entities/user-role.entity';
import { SystemUserVenue } from '../entities/system-user-venue.entity';
import { ActivityLog } from '../entities/activity-log.entity';
import { LoginHistory } from '../entities/login-history.entity';
import { ACTIVITY_ACTION_TO_TYPE } from '../constants/team.constants';

export interface TeamMemberDto {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string; // system_roles.rid
  status: 'active' | 'suspended' | 'pending';
  isOnline: boolean;
  masked: boolean;
  venues: string[];
  lastActive: string;
  loginDevice: string;
  loginLocation: string;
  joinedAt: string;
  loginAccess: boolean;
  maskedFields: string[];
  recentActions: { time: string; action: string; type: string }[];
  loginHistory: { device: string; location: string; time: string; status: 'success' | 'failed' }[];
  inviteStatus: 'invited' | 'accepted' | 'expired';
}

/** Relative "5 min ago" / "Just now" formatting, matching the mock data style. */
export function toRelativeTime(date: Date | string | null): string {
  if (!date) return 'Never';

  const value = new Date(date);
  const diffMs = Date.now() - value.getTime();

  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min} min ago`;

  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? 's' : ''} ago`;

  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;

  const weeks = Math.floor(days / 7);
  return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
}

export function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export interface MemberJoinedData {
  user: User;
  userRole?: UserRole & { role?: { rid: string } };
  venues: (SystemUserVenue & { venue?: { name: string } })[];
  recentActions: ActivityLog[];
  loginHistory: LoginHistory[];
  maskedFields: string[]; // resolved from a masking-rules source (role default + user override)
}

export function toTeamMemberDto(data: MemberJoinedData): TeamMemberDto {
  const {
    user,
    userRole,
    venues,
    recentActions,
    loginHistory,
    maskedFields,
  } = data;

  const lastLoginEntry = loginHistory[0];

  return {
    id: String(user.id),
    name: String(user.name),
    email: String(user.email),
    phone: String(user.phone),
    role: userRole?.role?.rid ?? 'viewer',
    status: user.status as 'active' | 'suspended' | 'pending',
    isOnline: Boolean(user.isOnline),
    masked: Boolean(userRole?.maskData),

    venues: venues
      .map((v) => v.venue?.name)
      .filter((name): name is string => !!name),

    lastActive: String(),//toRelativeTime(user.lastSeen ?? user.lastLogin)),

    loginDevice: lastLoginEntry?.device ?? '—',
    loginLocation: '—',

    joinedAt:'-',
      // user.inviteStatus === 'invited'
      //   ? `Invited ${formatMonthYear(user.createdAt)}`
      //   : formatMonthYear(user.createdAt),

    loginAccess:
      user.status !== 'suspended' &&
      user.inviteStatus === 'accepted',

    maskedFields,

   recentActions: (recentActions ?? []).map((a) => ({
  time: toRelativeTime(a.createdAt ?? null),
  action: a.description ?? `${a.action} ${a.module}`,
  type:
    ACTIVITY_ACTION_TO_TYPE[
      a.action as keyof typeof ACTIVITY_ACTION_TO_TYPE
    ] ?? "view",
})),

loginHistory: (loginHistory ?? []).map((l) => ({
  device: l.device ?? "—",
  location: "—",
  time: toRelativeTime(l.loginTime ?? null),
  status: l.loginStatus as "success" | "failed",
})),

    inviteStatus: user.inviteStatus as
      | 'invited'
      | 'accepted'
      | 'expired',
  };
}


