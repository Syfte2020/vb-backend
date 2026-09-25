export const PERMISSIONS = {
  DASHBOARD_VIEW: 'View Dashboard',
  CALENDAR_VIEW: 'View Calendar',
  CALENDAR_CREATE: 'Create Calendar',
  CALENDAR_EDIT: 'Edit Calendar',
  CALENDAR_DELETE: 'Delete Calendar',
  CUSTOMERS_VIEW: 'View Customers',
  LISTINGS_VIEW: 'View Listings',
  LISTINGS_EDIT: 'Edit Listings',
  RESERVATIONS_VIEW: 'View Reservations',
  RESERVATIONS_CREATE: 'Create Reservations',
  RESERVATIONS_EDIT: 'Edit Reservations',
  RESERVATIONS_APPROVE: 'Approve Reservations',
};

// Vendor → own id | Team → owner's id
export function getOwnerId(user: any): number {
  console.log("logged in user is : ")
  console.log(user)
  return user?.is_team ? Number(user?.owner_id) : Number(user?.id);
}