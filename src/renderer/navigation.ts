/**
 * Navigation model for the desktop shell.
 * One entry per top-level PMS module. Pure data so it can be reused on web later.
 */

export interface NavItem {
  key: string;
  label: string;
  icon: string; // emoji placeholder; swap for an icon set later
  description: string;
  /** Permission required to see this module. Undefined = always visible. */
  requiredPermission?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: "🏠", description: "At-a-glance occupancy, arrivals, departures and tasks." },
  { key: "frontdesk", label: "Front Desk", icon: "🛎️", description: "Today's arrivals, in-house guests, departures and room availability.", requiredPermission: "reservation:read" },
  { key: "reservations", label: "Reservations", icon: "📅", description: "Create and manage bookings, check-ins and check-outs.", requiredPermission: "reservation:read" },
  { key: "rooms", label: "Rooms", icon: "🛏️", description: "Rooms, room types and live room status.", requiredPermission: "room:read" },
  { key: "guests", label: "Guests", icon: "🧑", description: "Guest profiles and history.", requiredPermission: "guest:read" },
  { key: "property", label: "Property", icon: "🏨", description: "Hotel / guesthouse settings and configuration.", requiredPermission: "property:read" },
  { key: "housekeeping", label: "Housekeeping", icon: "🧹", description: "Cleaning tasks and room turnover.", requiredPermission: "housekeeping:read" },
  { key: "billing", label: "Billing", icon: "💳", description: "Folios, invoices and payments.", requiredPermission: "billing:read" },
  { key: "reports", label: "Reports", icon: "📊", description: "Occupancy, revenue and operational reports.", requiredPermission: "report:read" },
  { key: "access", label: "Access", icon: "🔑", description: "Door keys via the brand-neutral access engine.", requiredPermission: "access:issue" },
  { key: "users", label: "Users & Roles", icon: "👥", description: "Staff accounts, roles and permissions.", requiredPermission: "user:read" },
];
