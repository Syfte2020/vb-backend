export const ROLE_IDS = [
  'manager',
  'operations',
  'sales',
  'finance',
  'staff',
  'viewer',
] as const;

export type RoleId =
  (typeof ROLE_IDS)[number];

export const MASKABLE_FIELDS = [
  {
    key: 'customerName',
    label: 'Customer Name',
    category: 'contact',
  },
  {
    key: 'phone',
    label: 'Phone Number',
    category: 'contact',
  },
  {
    key: 'email',
    label: 'Email Address',
    category: 'contact',
  },
  {
    key: 'address',
    label: 'Address',
    category: 'contact',
  },
  {
    key: 'pricing',
    label: 'Pricing',
    category: 'financial',
  },
  {
    key: 'revenue',
    label: 'Revenue',
    category: 'financial',
  },
  {
    key: 'notes',
    label: 'Private Notes',
    category: 'content',
  },
] as const;

export type MaskableFieldKey =
  (typeof MASKABLE_FIELDS)[number]['key'];

export const PERMISSION_MODULES = [
  {
    key: 'reservations',
    label: 'Reservations',
    actions: [
      'view',
      'create',
      'edit',
      'delete',
      'approve',
      'export',
    ],
    group: 'core',
  },
  {
    key: 'calendar',
    label: 'Calendar',
    actions: [
      'view',
      'create',
      'edit',
      'delete',
    ],
    group: 'core',
  },
  {
    key: 'listings',
    label: 'Listings',
    actions: [
      'view',
      'create',
      'edit',
      'delete',
      'publish',
    ],
    group: 'core',
  },
  {
    key: 'packages',
    label: 'Packages',
    actions: [
      'view',
      'create',
      'edit',
      'delete',
      'approve',
    ],
    group: 'core',
  },
  {
    key: 'customers',
    label: 'Customers',
    actions: [
      'view',
      'edit',
      'export',
    ],
    group: 'core',
  },
  {
    key: 'reports',
    label: 'Reports',
    actions: [
      'view',
      'export',
    ],
    group: 'analytics',
  },
  {
    key: 'finance',
    label: 'Finance',
    actions: [
      'view',
      'create',
      'edit',
      'approve',
      'export',
    ],
    group: 'analytics',
  },
  {
    key: 'addons',
    label: 'Addons',
    actions: [
      'view',
      'create',
      'edit',
      'delete',
    ],
    group: 'config',
  },
  {
    key: 'settings',
    label: 'Settings',
    actions: [
      'view',
      'edit',
    ],
    group: 'config',
  },
  {
    key: 'teams',
    label: 'Teams',
    actions: [
      'view',
      'create',
      'edit',
      'delete',
    ],
    group: 'config',
  },
] as const;

export type ModuleKey =
  (typeof PERMISSION_MODULES)[number]['key'];

export type ActionKey =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'approve'
  | 'export'
  | 'publish';

export const ROLE_DEFAULT_PERMISSIONS: Record<
  RoleId,
  Record<string, ActionKey[]>
> = {
 

  manager: {
    '*': [
      'view',
      'create',
      'edit',
      'approve',
    ],
    finance: ['view'],
    settings: ['view'],
    teams: ['view'],
  },

  operations: {
    reservations: [
      'view',
      'edit',
      'approve',
    ],
    calendar: [
      'view',
      'create',
      'edit',
    ],
    listings: ['view'],
    customers: ['view'],
  },

  sales: {
    reservations: [
      'view',
      'create',
    ],
    packages: [
      'view',
      'create',
    ],
    customers: [
      'view',
      'edit',
    ],
    calendar: ['view'],
  },

  finance: {
    finance: [
      'view',
      'create',
      'edit',
      'approve',
      'export',
    ],
    reports: [
      'view',
      'export',
    ],
    reservations: ['view'],
  },

  staff: {
    calendar: ['view'],
    listings: ['view'],
    reservations: [
      'view',
      'create',
    ],
  },

  viewer: {
    '*': ['view'],
  },
};

export const MEMBER_STATUSES = [
  'active',
  'suspended',
  'pending',
] as const;

export type MemberStatus =
  (typeof MEMBER_STATUSES)[number];

export const INVITE_STATUSES = [
  'invited',
  'accepted',
  'expired',
] as const;

export type InviteStatus =
  (typeof INVITE_STATUSES)[number];

export const ACTIVITY_ACTION_TO_TYPE: Record<
  string,
  string
> = {
  update: 'edit',
  edit: 'edit',
  approve: 'approve',
  login: 'login',
  export: 'export',
  create: 'create',
  view: 'view',
};