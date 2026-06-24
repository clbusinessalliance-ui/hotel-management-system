/**
 * Development seed data.
 *
 * Uses fixed ids so re-running is idempotent (repositories upsert on id), and a
 * `isSeeded` guard avoids redundant work. Seeds infrastructure-level sample data
 * only — no business behaviour. Permissions are inlined here to keep the data
 * layer from depending on the domain core.
 */

import type { DataContext } from "../repositories.ts";
import { hashPassword } from "../auth.ts";

export async function isSeeded(ctx: DataContext): Promise<boolean> {
  const props = await ctx.properties.list();
  return props.length > 0;
}

/**
 * Dev convenience: ensure the admin user can sign in with admin / admin. Safe to
 * run on every startup (idempotent) — works for fresh and already-seeded DBs.
 */
export async function ensureAdminPassword(ctx: DataContext): Promise<void> {
  const admin = await ctx.users.findByUsername("admin");
  if (!admin) return;
  // Reactivate too, so the dev admin can never be locked out by an edit.
  if (!admin.active) await ctx.users.save({ ...admin, active: true });
  await ctx.users.setPasswordHash(admin.id, hashPassword("admin"));
}

export async function seedDev(ctx: DataContext): Promise<void> {
  const now = new Date().toISOString();
  const stamp = { createdAt: now, updatedAt: now };

  const propertyId = "prop_demo";
  await ctx.properties.save({
    id: propertyId, name: "Seaside Guesthouse", type: "guesthouse",
    address: "1 Harbour Road", timezone: "UTC", currency: "USD", ...stamp,
  });

  await ctx.roomTypes.save({
    id: "rt_std", propertyId, code: "STD", name: "Standard", basePrice: 9000, maxOccupancy: 2, ...stamp,
  });
  await ctx.roomTypes.save({
    id: "rt_dlx", propertyId, code: "DLX", name: "Deluxe", basePrice: 12000, maxOccupancy: 3, ...stamp,
  });

  await ctx.rooms.save({ id: "room_101", propertyId, roomTypeId: "rt_std", number: "101", floor: "1", status: "available", ...stamp });
  await ctx.rooms.save({ id: "room_102", propertyId, roomTypeId: "rt_std", number: "102", floor: "1", status: "dirty", ...stamp });
  await ctx.rooms.save({ id: "room_201", propertyId, roomTypeId: "rt_dlx", number: "201", floor: "2", status: "occupied", ...stamp });

  await ctx.roles.save({
    id: "role_owner", name: "owner", description: "Full access", permissions: ["*"], ...stamp,
  });
  await ctx.roles.save({
    id: "role_front", name: "front_desk", description: "Front desk staff",
    permissions: ["reservation:*", "guest:*", "room:read", "billing:read", "access:issue"], ...stamp,
  });

  await ctx.users.save({
    id: "user_admin", username: "admin", displayName: "Administrator",
    email: "admin@example.com", roleIds: ["role_owner"], active: true, ...stamp,
  });

  await ctx.guests.save({
    id: "guest_demo", firstName: "Ada", lastName: "Lovelace",
    email: "ada@example.com", phone: "+1-555-0100", ...stamp,
  });

  await ctx.reservations.save({
    id: "resv_demo", propertyId, guestId: "guest_demo", roomId: "room_201", roomTypeId: "rt_dlx",
    checkIn: "2026-06-12", checkOut: "2026-06-15", status: "confirmed",
    ratePerNight: 12000, currency: "USD", notes: "Sea view requested", ...stamp,
  });

  await ctx.invoices.save({
    id: "inv_demo", reservationId: "resv_demo", status: "open", currency: "USD", total: 36000, ...stamp,
  });
  await ctx.payments.save({
    id: "pay_demo", invoiceId: "inv_demo", method: "card", amount: 20000, reference: "AUTH-123", ...stamp,
  });

  await ctx.housekeeping.save({
    id: "hk_demo", roomId: "room_102", assignedTo: undefined, status: "pending",
    scheduledFor: "2026-06-12", notes: "Checkout clean", ...stamp,
  });
}
