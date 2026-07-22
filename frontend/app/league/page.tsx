"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { FranchiseHome, Team } from "@basketball-sim/shared";

type Choice = Pick<Team, "id" | "name" | "abbreviation" | "conference" | "division" | "gmDirection">;

export default function LeaguePage() {
  const router = useRouter();
  const [home, setHome] = useState<FranchiseHome | null>(null);
  const [choices, setChoices] = useState<Choice[] | null>(null);
  const [leagueId, setLeagueId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const res = await fetch("/api/league");
    if (res.status === 401) {
      router.replace("/");
      return;
    }
    const json = await res.json();
    if (json.needsFranchise) {
      setChoices(json.choices);
      setLeagueId(json.leagueId);
      setHome(null);
    } else {
      setHome(json.home);
      setChoices(null);
    }
  }

  useEffect(() => {
    void reload();
  }, [router]);

  async function pickTeam(teamId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/franchise/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function advance(mode: "next" | "toUserGame" | "days" | "season", days?: number) {
    if (!home) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/league/advance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId: home.snapshot.league.id,
          mode,
          days,
          autoSimUserGames: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Advance failed");
      setMessage(json.result.message);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Advance failed");
    } finally {
      setBusy(false);
    }
  }

  async function playNext() {
    if (!home) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/games/play-next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leagueId: home.snapshot.league.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Play failed");
      router.push(`/games/${json.game.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Play failed");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
  }

  if (choices) {
    return (
      <main className="shell">
        <div className="topbar">
          <div className="mark">TIPOFF</div>
          <button type="button" className="btn btn-secondary" onClick={() => void logout()}>
            Log out
          </button>
        </div>
        <h1 className="brand" style={{ fontSize: "clamp(2rem, 6vw, 3.4rem)" }}>
          Pick your franchise
        </h1>
        <p className="tagline">Thirty clubs. One desk. You run the roster — AI owners run the rest.</p>
        {error && <p className="error">{error}</p>}
        <div className="grid-teams" style={{ marginTop: "1.5rem" }}>
          {choices.map((t) => (
            <button
              key={t.id}
              type="button"
              className="team"
              style={{ textAlign: "left", cursor: "pointer", border: "1px solid var(--line)", width: "100%" }}
              disabled={busy}
              onClick={() => void pickTeam(t.id)}
            >
              <h3>
                {t.abbreviation} · {t.name}
              </h3>
              <p>
                {t.conference} / {t.division} · AI vibe: {t.gmDirection}
              </p>
            </button>
          ))}
        </div>
      </main>
    );
  }

  if (!home) {
    return (
      <main className="shell">
        <p className="muted">Loading franchise…</p>
      </main>
    );
  }

  const my = home.snapshot.teams.find((t) => t.id === home.snapshot.userTeamId);
  const myStanding = home.standings.find((s) => s.teamId === home.snapshot.userTeamId);

  return (
    <main className="shell">
      <div className="topbar">
        <div className="mark">TIPOFF</div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <a className="btn btn-secondary" href="/standings">
            Standings
          </a>
          <a className="btn btn-secondary" href="/front-office">
            Front office
          </a>
          <a className="btn btn-secondary" href="/history">
            History
          </a>
          <span className="muted">{home.user.displayName}</span>
          <button type="button" className="btn btn-secondary" onClick={() => void logout()}>
            Log out
          </button>
        </div>
      </div>

      <h1 className="brand" style={{ fontSize: "clamp(2rem, 6vw, 3.4rem)" }}>
        {my?.name ?? "Franchise"}
      </h1>
      <p className="tagline">
        {home.snapshot.league.seasonYear} · Day {home.snapshot.league.day} · {home.snapshot.league.phase}
        {myStanding ? ` · ${myStanding.wins}-${myStanding.losses} (#${myStanding.rank} ${myStanding.conference})` : ""}
      </p>

      {message && <p className="muted">{message}</p>}
      {error && <p className="error">{error}</p>}

      <section className="panel">
        <h2>Advance</h2>
        <div className="cta-row">
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void playNext()}>
            {busy ? "Working…" : "Play next game"}
          </button>
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void advance("next")}>
            Sim day
          </button>
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void advance("toUserGame")}>
            Sim to my game
          </button>
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void advance("days", 7)}>
            Sim week
          </button>
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void advance("season")}>
            Sim season
          </button>
        </div>
        {home.nextGame && (
          <p className="muted" style={{ marginTop: "0.75rem" }}>
            Next on schedule: day {home.nextGame.day}
            {home.nextGame.isPlayoff ? " (playoffs)" : ""}
          </p>
        )}
      </section>

      <section className="panel">
        <h2>Roster · payroll ${(home.payroll / 1_000_000).toFixed(1)}M</h2>
        <div style={{ overflowX: "auto" }}>
          <table className="box-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Pos</th>
                <th>Age</th>
                <th>OVR</th>
                <th>POT</th>
                <th>MIN</th>
                <th>INJ</th>
              </tr>
            </thead>
            <tbody>
              {home.roster.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.position}</td>
                  <td>{p.age}</td>
                  <td>{p.ratings.overall}</td>
                  <td>{p.potential}</td>
                  <td>{p.targetMinutes}</td>
                  <td>{p.injuredDays > 0 ? `${p.injuredDays}d` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>News</h2>
        <ul className="game-list">
          {home.news.map((n) => (
            <li key={n.id}>
              <a href="#news">
                <span>{n.headline}</span>
                <span className="muted">
                  D{n.day} · {n.kind}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h2>Recent box scores</h2>
        {home.recentGames.length === 0 ? (
          <p className="muted">No games yet — advance the calendar.</p>
        ) : (
          <ul className="game-list">
            {home.recentGames.map((game) => (
              <li key={game.id}>
                <a href={`/games/${game.id}`}>
                  <span>
                    {game.home.teamName} {game.home.pts} — {game.away.pts} {game.away.teamName}
                  </span>
                  <span className="muted">{game.isPlayoff ? "Playoffs" : "RS"}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
