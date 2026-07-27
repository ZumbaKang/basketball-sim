"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { FranchiseHome, Team } from "@basketball-sim/shared";
import { ScrollableTable } from "@/components/ScrollableTable";
import { millions, record } from "@/lib/format";

type Choice = Pick<Team, "id" | "name" | "abbreviation" | "conference" | "division" | "gmDirection">;

export default function LeaguePage() {
  const router = useRouter();
  const [home, setHome] = useState<FranchiseHome | null>(null);
  const [choices, setChoices] = useState<Choice[] | null>(null);
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

  if (choices) {
    return (
      <main className="rise">
        <div className="page-head">
          <div>
            <p className="eyebrow">New franchise</p>
            <h1 className="page-title">Pick your club</h1>
            <p className="page-sub">Thirty teams. One desk. You run the roster — AI owners run the rest.</p>
          </div>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="grid-teams">
          {choices.map((t) => (
            <button key={t.id} type="button" className="team" disabled={busy} onClick={() => void pickTeam(t.id)}>
              <span className="team-abbr">{t.abbreviation}</span>
              <h3>{t.name}</h3>
              <p>
                {t.conference} · {t.division} · plays {t.gmDirection}
              </p>
            </button>
          ))}
        </div>
      </main>
    );
  }

  if (!home) {
    return (
      <main>
        <div className="skeleton-stack" aria-busy="true" aria-live="polite">
          <span className="sr-only">Loading franchise…</span>
          <div className="skeleton" style={{ height: "2.5rem", width: "40%" }} />
          <div className="skeleton" style={{ height: "5rem" }} />
          <div className="skeleton" style={{ height: "14rem" }} />
        </div>
      </main>
    );
  }

  const league = home.snapshot.league;
  const my = home.snapshot.teams.find((t) => t.id === home.snapshot.userTeamId);
  const myStanding = home.standings.find((s) => s.teamId === home.snapshot.userTeamId);
  const healthy = home.roster.filter((p) => p.injuredDays === 0).length;

  return (
    <main className="rise">
      <div className="page-head">
        <div>
          <p className="eyebrow">
            {league.seasonYear} · Day {league.day} · {league.phase}
          </p>
          <h1 className="page-title">{my?.name ?? "Franchise"}</h1>
        </div>
        <div className="cta-row">
          <Link className="btn btn-secondary btn-sm" href="/standings">
            Standings
          </Link>
          <Link className="btn btn-secondary btn-sm" href="/front-office">
            Front office
          </Link>
        </div>
      </div>

      <div className="stat-strip">
        <div className="stat">
          <p className="stat-label">Record</p>
          <p className="stat-value">{myStanding ? record(myStanding.wins, myStanding.losses) : "—"}</p>
        </div>
        <div className="stat">
          <p className="stat-label">Conference</p>
          <p className="stat-value stat-value-accent">
            {myStanding ? `#${myStanding.rank}` : "—"}
            <span style={{ fontSize: "0.8rem", marginLeft: "0.35rem" }}>{myStanding?.conference ?? ""}</span>
          </p>
        </div>
        <div className="stat">
          <p className="stat-label">Payroll</p>
          <p className="stat-value">{millions(home.payroll)}</p>
        </div>
        <div className="stat">
          <p className="stat-label">Available</p>
          <p className="stat-value">
            {healthy}
            <span style={{ fontSize: "0.8rem", color: "var(--text-faint)" }}>/{home.roster.length}</span>
          </p>
        </div>
      </div>

      {message && <p className="muted">{message}</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <section className="panel">
        <div className="panel-head">
          <h2>Advance</h2>
          {home.nextGame && (
            <p className="panel-note">
              Next game · day {home.nextGame.day}
              {home.nextGame.isPlayoff ? " · playoffs" : ""}
            </p>
          )}
        </div>
        <div className="cta-row dashboard-actions">
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
      </section>

      <section className="panel mobile-table-panel roster-panel">
        <div className="panel-head">
          <h2>Roster</h2>
          <p className="panel-note">{millions(home.payroll)} payroll</p>
        </div>
        <ScrollableTable
          label="Franchise roster"
          offscreenColumns="age, overall, potential, target minutes, and injury status"
        >
          <table className="box-table">
            <thead>
              <tr>
                <th scope="col">Player</th>
                <th scope="col">Pos</th>
                <th scope="col">Age</th>
                <th scope="col">OVR</th>
                <th scope="col">POT</th>
                <th scope="col">MIN</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {home.roster.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link className="cell-link" href={`/players/${p.id}`}>
                      {p.name}
                    </Link>
                  </td>
                  <td>{p.position}</td>
                  <td>{p.age}</td>
                  <td>{p.ratings.overall}</td>
                  <td>{p.potential}</td>
                  <td>{p.targetMinutes}</td>
                  <td>
                    {p.injuredDays > 0 ? (
                      <span className="tag tag-danger">out {p.injuredDays}d</span>
                    ) : (
                      <span className="muted">active</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableTable>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Recent box scores</h2>
        </div>
        {home.recentGames.length === 0 ? (
          <p className="muted">No games yet — advance the calendar.</p>
        ) : (
          <ul className="feed">
            {home.recentGames.map((game) => {
              const homeWon = game.home.pts > game.away.pts;
              return (
                <li key={game.id}>
                  <Link className="feed-item" href={`/games/${game.id}`}>
                    <span>
                      <strong style={{ color: homeWon ? "var(--accent)" : undefined }}>
                        {game.home.teamName} {game.home.pts}
                      </strong>
                      {" — "}
                      <strong style={{ color: homeWon ? undefined : "var(--accent)" }}>
                        {game.away.pts} {game.away.teamName}
                      </strong>
                    </span>
                    <span className="feed-meta">{game.isPlayoff ? "Playoffs" : "Regular season"}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>League wire</h2>
          <p className="panel-note">{home.news.length} updates</p>
        </div>
        {home.news.length === 0 ? (
          <p className="muted">Nothing on the wire yet.</p>
        ) : (
          <ul className="feed">
            {home.news.map((n) => (
              <li key={n.id} className="feed-item">
                <span>{n.headline}</span>
                <span className="feed-meta">
                  <span className="tag">{n.kind}</span> day {n.day}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
