"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { FranchiseHome, Player, Team } from "@basketball-sim/shared";

export default function FrontOfficePage() {
  const router = useRouter();
  const [home, setHome] = useState<FranchiseHome | null>(null);
  const [giveId, setGiveId] = useState("");
  const [getId, setGetId] = useState("");
  const [toTeamId, setToTeamId] = useState("");
  const [faId, setFaId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      if (others[0]) setToTeamId(others[0].id);
      const fa = json.home.snapshot.players.filter((p: Player) => p.isFreeAgent);
      if (fa[0]) setFaId(fa[0].id);
    })();
  }, [router]);

  if (!home) {
    return (
      <main className="shell">
        <p className="muted">Loading front office…</p>
      </main>
    );
  }

  const otherTeams = home.snapshot.teams.filter((t) => t.id !== home.snapshot.userTeamId);
  const theirPlayers = home.snapshot.players.filter((p) => p.teamId === toTeamId);
  const freeAgents = home.snapshot.players.filter((p) => p.isFreeAgent).slice(0, 40);

  async function propose() {
    setError(null);
    setMsg(null);
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
  }

  async function finder() {
    setError(null);
    setMsg(null);
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
  }

  async function offer() {
    setError(null);
    setMsg(null);
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
  }

  return (
    <main className="shell">
      <div className="topbar">
        <a className="mark" href="/league">
          TIPOFF
        </a>
        <a className="btn btn-secondary" href="/league">
          Franchise
        </a>
      </div>
      <h1 className="brand" style={{ fontSize: "clamp(2rem, 5vw, 3rem)" }}>
        Front office
      </h1>
      <p className="tagline">Trades, free agents, and AI owners with motives.</p>
      {msg && <p className="muted">{msg}</p>}
      {error && <p className="error">{error}</p>}

      <section className="panel">
        <h2>Propose a trade</h2>
        <div className="form">
          <label>
            You send
            <select value={giveId} onChange={(e) => setGiveId(e.target.value)}>
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
              onChange={(e) => {
                setToTeamId(e.target.value);
                const first = home.snapshot.players.find((p) => p.teamId === e.target.value);
                if (first) setGetId(first.id);
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
            <select value={getId} onChange={(e) => setGetId(e.target.value)}>
              {theirPlayers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.ratings.overall})
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="cta-row">
          <button type="button" className="btn btn-primary" onClick={() => void propose()}>
            Send proposal
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => void finder()}>
            Trade finder
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>Free agency</h2>
        {freeAgents.length === 0 ? (
          <p className="muted">No free agents right now — check back in the offseason.</p>
        ) : (
          <>
            <label className="form">
              Target
              <select value={faId} onChange={(e) => setFaId(e.target.value)}>
                {freeAgents.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.position} · {p.ratings.overall} ovr
                  </option>
                ))}
              </select>
            </label>
            <div className="cta-row">
              <button type="button" className="btn btn-primary" onClick={() => void offer()}>
                Offer $8M / 2 yrs
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
