/**
 * Preload script — the secure bridge between the renderer and the main process.
 *
 * Exposes a minimal, explicit, read-only API surface (contextIsolation = true).
 * The shape is the shared `PmsBridge` contract, so the renderer and main process
 * stay type-compatible. The renderer never touches Node, the database, or IPC
 * channels directly — only these named methods.
 */

import { contextBridge, ipcRenderer } from "electron";
import { IPC, type PmsBridge } from "@shared/ipc/contract.ts";

const bridge: PmsBridge = {
  getInfo: () => ipcRenderer.invoke(IPC.info),
  getSummary: () => ipcRenderer.invoke(IPC.summary),
  listRooms: () => ipcRenderer.invoke(IPC.rooms),
  listRoomTypes: () => ipcRenderer.invoke(IPC.roomTypes),
  listReservations: () => ipcRenderer.invoke(IPC.reservations),
  listGuests: () => ipcRenderer.invoke(IPC.guests),
  listHousekeeping: () => ipcRenderer.invoke(IPC.housekeeping),
  listProperties: () => ipcRenderer.invoke(IPC.properties),
  listUsers: () => ipcRenderer.invoke(IPC.users),
  listRoles: () => ipcRenderer.invoke(IPC.roles),
  listInvoices: () => ipcRenderer.invoke(IPC.invoices),
  listPayments: () => ipcRenderer.invoke(IPC.payments),
  listAccessKeys: () => ipcRenderer.invoke(IPC.accessKeys),
  listAccessEvents: () => ipcRenderer.invoke(IPC.accessEvents),

  login: (username, password) => ipcRenderer.invoke(IPC.login, username, password),
  logout: () => ipcRenderer.invoke(IPC.logout),
  createUser: (input) => ipcRenderer.invoke(IPC.createUser, input),
  updateUser: (input) => ipcRenderer.invoke(IPC.updateUser, input),
  setUserPassword: (userId, password) => ipcRenderer.invoke(IPC.setUserPassword, userId, password),
  changeReservationStatus: (id, to) =>
    ipcRenderer.invoke(IPC.changeReservationStatus, id, to),
  changeRoomStatus: (id, to) => ipcRenderer.invoke(IPC.changeRoomStatus, id, to),
  advanceHousekeepingTask: (id, to) =>
    ipcRenderer.invoke(IPC.advanceHousekeepingTask, id, to),
  recordPayment: (invoiceId, amount, method, reference) =>
    ipcRenderer.invoke(IPC.recordPayment, invoiceId, amount, method, reference),
  recordRefund: (invoiceId) => ipcRenderer.invoke(IPC.recordRefund, invoiceId),
  updateProperty: (input) => ipcRenderer.invoke(IPC.updateProperty, input),
  createRoomType: (input) => ipcRenderer.invoke(IPC.createRoomType, input),
  createRoom: (input) => ipcRenderer.invoke(IPC.createRoom, input),
  createGuest: (input) => ipcRenderer.invoke(IPC.createGuest, input),
  updateGuest: (input) => ipcRenderer.invoke(IPC.updateGuest, input),
  createReservation: (input) => ipcRenderer.invoke(IPC.createReservation, input),
  updateReservation: (input) => ipcRenderer.invoke(IPC.updateReservation, input),
  issueRoomKey: (reservationId, medium) =>
    ipcRenderer.invoke(IPC.issueRoomKey, reservationId, medium),
  revokeRoomKey: (keyId) => ipcRenderer.invoke(IPC.revokeRoomKey, keyId),
  revealKeySecret: (keyId) => ipcRenderer.invoke(IPC.revealKeySecret, keyId),
};

contextBridge.exposeInMainWorld("pms", bridge);
