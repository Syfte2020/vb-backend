export const DEFAULT_TEAM_ROLES = [
  { name: 'Owner',      slug: 'owner',      description: 'Full team access' },
  { name: 'Admin',      slug: 'admin',      description: 'Full team administration access' },
  { name: 'Manager',    slug: 'manager',    description: 'Manager access' },
  { name: 'Operations', slug: 'operations', description: 'Operations access' },
  { name: 'Sales',      slug: 'sales',      description: 'Sales access' },
  { name: 'Finance',    slug: 'finance',    description: 'Finance access' },
  { name: 'Staff',      slug: 'staff',      description: 'Staff access' },
  { name: 'Viewer',     slug: 'viewer',     description: 'Read-only access' },
] as const;

// 'ALL' means "every row currently in the permissions table"
export const ROLE_PERMISSION_MATRIX: Record<string, string[] | 'ALL'> = {
  owner: 'ALL',
  admin: 'ALL',

  manager: [
    'dashboard.view',
    'reservations.view', 'reservations.create', 'reservations.edit', 'reservations.approve',
    'calendar.view', 'calendar.create', 'calendar.edit',
    'listings.view', 'listings.create', 'listings.edit', 'listings.approve',
    'customers.view', 'customers.create', 'customers.edit',
    'packages.view', 'packages.create', 'packages.edit',
    'reports.view', 'reports.export',
  ],

  operations: [
    'dashboard.view',
    'reservations.view', 'reservations.create', 'reservations.edit', 'reservations.approve',
    'calendar.view', 'calendar.create', 'calendar.edit', 'calendar.delete',
    'listings.view', 'listings.edit',
    'customers.view',
  ],

  sales: [
    'dashboard.view',
    'reservations.view', 'reservations.create', 'reservations.edit',
    'customers.view', 'customers.create', 'customers.edit',
    'packages.view', 'packages.create', 'packages.edit',
    'reports.view',
  ],

  finance: [
    'dashboard.view',
    'reservations.view',
    'finance.view', 'finance.create', 'finance.edit', 'finance.approve', 'finance.export',
    'reports.view', 'reports.export',
  ],

  staff: [
    'dashboard.view',
    'reservations.view', 'reservations.create', 'reservations.edit',
    'calendar.view', 'calendar.create', 'calendar.edit',
    'listings.view',
    'customers.view',
  ],

  viewer: [
    'dashboard.view', 'reservations.view', 'calendar.view', 'listings.view',
    'customers.view', 'packages.view', 'finance.view', 'reports.view',
    'settings.view', 'teams.view',
  ],
};