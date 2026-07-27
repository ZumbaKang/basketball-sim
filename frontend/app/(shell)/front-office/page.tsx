"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { FranchiseHome, Player, Team } from "@basketball-sim/shared";
import { formatPayrollDelta, payrollDelta, summarizeTradeSide } from "@/components/trade";
import { millions } from "@/lib/format";

export default function FrontOfficePage() {
  const router = useRouter();
  const [home, setHome] = useState<FranchiseHome | null>(null);
  const [giveId, setGiveId] = useState("");
  const [getId, setGetId] = useState("");
  const [toTeamId, setToTeamId] = useState("");
  const [faId, setFaId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"propose" | "finder" | "offer" | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/league");
      if (res.status === 401) {
        router.replace("/");
        return;
      }
      const json = await res.json();
      if (json.needsFranchise) {
        router.replace("/league");
        return;
      }
      setHome(json.home);
      const roster: Player[] = json.home.roster;
      const others: Team[] = json.home.snapshot.teams.filter(
        (t: Team) => t.id !== json.home.snapshot.userTeamId,
      );
      if (roster[0]) setGiveId(roster[0].id);
      if (others[0]) {
        setToTeamId(others[0].id);
        const firstPartnerPlayer = json.home.snapshot.players.find(
          (p: Player) => p.teamId === others[0]!.id,
        );
        setGetId(firstPartnerPlayer?.id ?? "");
      }
      const fa = json.home.snapshot.players.filter((p: Player) => p.isFreeAgent);
      if (fa[0]) setFaId(fa[0].id);
    })();
  }, [router]);

  if (!home) {
    return (
      <main>
        <div className="skeleton-stack" aria-busy="true" aria-live="polite">
          <span className="sr-only">Loading front office…</span>
          <div className="skeleton" style={{ height: "2.5rem", width: "35%" }} />
          <div className="skeleton" style={{ height: "16rem" }} />
        </div>
      </main>
    );
  }

  const otherTeams = home.snapshot.teams.filter((t) => t.id !== home.snapshot.userTeamId);
  const theirPlayers = home.snapshot.players.filter((p) => p.teamId === toTeamId);
  const freeAgents = home.snapshot.players.filter((p) => p.isFreeAgent).slice(0, 40);
  const userTeam = home.snapshot.teams.find((t) => t.id === home.snapshot.userTeamId);
  const selectedPartner = otherTeams.find((t) => t.id === toTeamId);
  const selectedGive = home.roster.find((p) => p.id === giveId);
  const selectedReceive = theirPlayers.find((p) => p.id === getId);

  const outgoing = summarizeTradeSide(
    selectedGive,
    home.snapshot.contracts.find((c) => c.playerId === giveId),
  );
  const incoming = summarizeTradeSide(
    selectedReceive,
    home.snapshot.contracts.find((c) => c.playerId === getId),
  );

  const busy = pending !== null;

  async function propose() {
    if (busy) return;
    setError(null);
    setMsg(null);
    setPending("propose");
    try {
      const res = await fetch("/api/gm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "propose",
          proposal: {
            leagueId: home!.snapshot.league.id,
            fromTeamId: home!.snapshot.userTeamId,
            toTeamId,
            fromAssets: [{ playerId: giveId }],
            toAssets: [{ playerId: getId }],
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed");
        return;
      }
      setMsg(json.decision.reason);
    } catch {
      setError("Proposal failed");
    } finally {
      setPending(null);
    }
  }

  async function finder() {
    if (busy) return;
    setError(null);
    setMsg(null);
    setPending("finder");
    try {
      const res = await fetch("/api/gm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "finder",
          leagueId: home!.snapshot.league.id,
          playerId: giveId,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed");
        return;
      }
      if (!json.packages?.length) {
        setMsg("No AI teams liked packages for that asset.");
        return;
      }
      const top = json.packages[0];
      setMsg(`${top.teamName}: ${top.decision.reason}`);
      setToTeamId(top.teamId);
      setGetId(top.proposal.toAssets[0]?.playerId ?? "");
      // The finder rewrites both sides of the deal, so send the reader to the
      // summary rather than leaving focus on a button whose context just moved.
      summaryRef.current?.focus();
    } catch {
      setError("Trade finder failed");
    } finally {
      setPending(null);
    }
  }

  async function offer() {
    if (busy) return;
    setError(null);
    setMsg(null);
    setPending("offer");
    try {
      const res = await fetch("/api/gm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "offer",
          offer: {
            leagueId: home!.snapshot.league.id,
            teamId: home!.snapshot.userTeamId,
            playerId: faId,
            salary: 8_000_000,
            years: 2,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed");
        return;
      }
      setMsg(json.result.reason);
    } catch {
      setError("Offer failed");
    } finally {
      setPending(null);
    }
  }

  return (
    <main className="rise front-office">
      <div className="page-head">
        <div>
          <p className="eyebrow">
            {home.snapshot.league.seasonYear} · payroll {millions(home.payroll)}
          </p>
          <h1 className="page-title">Front office</h1>
          <p className="page-sub">Trades, free agents, and AI owners with motives.</p>
        </div>
      </div>

      {msg && (
        <p className="muted" role="status">
          {msg}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <section className="panel trade-builder">
        <div className="panel-head">
          <h2>Propose a trade</h2>
          {selectedPartner && <p className="panel-note">{selectedPartner.gmDirection} front office</p>}
        </div>

        <div className="form trade-form">
          <label>
            You send
            <select value={giveId} disabled={busy} onChange={(e) => setGiveId(e.target.value)}>
              {home.roster.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.ratings.overall})
                </option>
              ))}
            </select>
          </label>
          <label>
            Partner
            <select
              value={toTeamId}
              disabled={busy}
              onChange={(e) => {
                setToTeamId(e.target.value);
                const first = home.snapshot.players.find((p) => p.teamId === e.target.value);
                setGetId(first?.id ?? "");
              }}
            >
              {otherTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.gmDirection})
                </option>
              ))}
            </select>
          </label>
          <label>
            You receive
            <select value={getId} disabled={busy} onChange={(e) => setGetId(e.target.value)}>
              {theirPlayers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.ratings.overall})
                </option>
              ))}
            </select>
          </label>
        </div>

        <div
          className="trade-summary"
          aria-label="Selected trade assets"
          aria-live="polite"
          ref={summaryRef}
          tabIndex={-1}
        >
          <div className="trade-summary-side">
            <span className="trade-summary-label">You send</span>
            <strong className="trade-summary-name">{selectedGive?.name ?? "No player selected"}</strong>
            <span className="trade-summary-team">{userTeam?.name ?? "Your team"}</span>
            <span className="trade-summary-detail">{outgoing.detail}</span>
          </div>
          <span className="trade-summary-divider" aria-hidden="true">
            for
          </span>
          <div className="trade-summary-side">
            <span className="trade-summary-label">You receive</span>
            <strong className="trade-summary-name">
              {selectedReceive?.name ?? "No player selected"}
            </strong>
            <span className="trade-summary-team">{selectedPartner?.name ?? "Trade partner"}</span>
            <span className="trade-summary-detail">{incoming.detail}</span>
          </div>
          <span className="trade-summary-delta">{formatPayrollDelta(payrollDelta(outgoing, incoming))}</span>
        </div>

        <div className="cta-row trade-actions">
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void propose()}>
            {pending === "propose" ? "Sending…" : "Send proposal"}
          </button>
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void finder()}>
            {pending === "finder" ? "Searching…" : "Trade finder"}
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Free agency</h2>
          <p className="panel-note">{freeAgents.length} available</p>
        </div>
        {freeAgents.length === 0 ? (
          <p className="muted">No free agents right now — check back in the offseason.</p>
        ) : (
          <>
            <label className="form free-agent-form">
              Target
              <select value={faId} disabled={busy} onChange={(e) => setFaId(e.target.value)}>
                {freeAgents.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.position} · {p.ratings.overall} ovr
                  </option>
                ))}
              </select>
            </label>
            <div className="cta-row free-agent-actions" style={{ marginTop: "1rem" }}>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void offer()}>
                {pending === "offer" ? "Offering…" : "Offer $8M / 2 yrs"}
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
