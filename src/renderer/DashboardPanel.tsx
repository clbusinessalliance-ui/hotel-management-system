import { useEffect, useState } from "react";
import type { PmsInfo, PmsSummary } from "@shared/ipc/contract.ts";
import { getBridge } from "./pmsClient.ts";

/**
 * Minimal verification panel: pulls the read-only summary + info over typed IPC
 * and shows seeded counts. Intentionally not a full module screen — it exists to
 * prove the renderer ↔ main data path end to end.
 */
export default function DashboardPanel() {
  const [info, setInfo] = useState<PmsInfo | null>(null);
  const [summary, setSummary] = useState<PmsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const bridge = getBridge();
    if (!bridge) {
      setError("Desktop bridge unavailable — running in browser preview (no Electron).");
      return;
    }
    Promise.all([bridge.getInfo(), bridge.getSummary()])
      .then(([i, s]) => {
        setInfo(i);
        setSummary(s);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  if (error) {
    return (
      <section className="placeholder-card">
        <h2>Live data</h2>
        <p className="muted">{error}</p>
      </section>
    );
  }

  if (!summary || !info) {
    return (
      <section className="placeholder-card">
        <h2>Live data</h2>
        <p className="muted">Loading seeded data over IPC…</p>
      </section>
    );
  }

  const c = summary.counts;
  const cards: Array<[string, number]> = [
    ["Rooms", c.rooms],
    ["Room types", c.roomTypes],
    ["Guests", c.guests],
    ["Reservations", c.reservations],
    ["Invoices", c.invoices],
    ["Users", c.users],
  ];

  return (
    <section className="placeholder-card">
      <h2>{summary.property ? summary.property.name : "No property"} </h2>
      <p className="muted">
        {summary.property ? `${summary.property.type} · ` : ""}
        served live from the main process over typed IPC — app v{info.version}, door provider:{" "}
        <code>{info.doorProvider}</code>
      </p>
      <div className="stat-grid">
        {cards.map(([label, value]) => (
          <div className="stat" key={label}>
            <div className="stat-value">{value}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
