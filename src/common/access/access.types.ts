export type AccountType = 'vendor' | 'team';

/** Normalised identity taken from req.user (JWT) */
export interface AccessIdentity {
  sub: number;        // users.id OR team_members.id
  type: AccountType;
}

export interface AccessProfile {
  name: string;
  email: string;
  phone: string | null;
  avatar: string | null;
}

export interface AccessContext {
  type: AccountType;
  actorId: number;        // who is logged in (vendor id or team member id)
  ownerId: number;        // whose data → pass this to every service
  vendorId: string | null; // e.g. 'V00086'
  isOwner: boolean;       // vendor = true → full access
  roleId: number | null;
  roleName: string | null;
  permissions: string[];
  profile: AccessProfile;
}