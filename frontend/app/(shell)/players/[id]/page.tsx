"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { FranchiseHome, PlayerGameLine } from "@basketball-sim/shared";
import { ScrollableTable } from "@/components/ScrollableTable";
import { millions } from "@/lib/format";

type LoggedGame = {
  gameId: string;
  opponent: string;
  isPlayoff: boolean;
  line: PlayerGameLine;
};

const RATING_ROWS = [
  ["Offense", "offense"],
  ["Defense", "defense"],
  ["Shooting", "shooting"],
  ["Rebounding", "rebounding"],
  ["Playmaking", "playmaking"],
  ["Stamina", "stamina"],
] as const;

export default function PlayerPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [home, setHome] = useState<FranchiseHome | null>(null);

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
    })();
  }, [router]);

  if (!home) {
    return (
      <main>
        <div className="skeleton-stack" aria-busy="true" aria-live="polite">
          <span className="sr-only">Loading player…</span>
          <div className="skeleton" style={{ height: "7rem" }} />
          <div className="skeleton" style={{ height: "12rem" }} />
        </div>
      </main>
    );
  }

  const player = home.snapshot.players.find((p) => p.id === params.id);

  if (!player) {
    return (
      <main>
        <div className="page-head">
          <h1 className="page-title">Player not found</h1>
        </div>
        <p className="muted">That player is no longer in this league.</p>
        <Link className="btn btn-secondary btn-sm" href="/league">
          Back to franchise
        </Link>
      </main>
    );
  }

  const team = home.snapshot.teams.find((t) => t.id === player.teamId);
  const contract = home.snapshot.contracts.find((c) => c.playerId === player.id);

  const log: LoggedGame[] = home.recentGames.flatMap((game) => {
    const onHome = game.home.players.find((p) => p.playerId === player.id);
    const onAway = game.away.players.find((p) => p.playerId === player.id);
    const line = onHome ?? onAway;
    if (!line) return [];
    return [
      {
        gameId: game.id,
        opponent: onHome ? game.away.teamName : game.home.teamName,
        isPlayoff: Boolean(game.isPlayoff),
        line,
      },
    ];
  });

  return (
    <main className="rise">
      <div className="page-head">
        <div>
          <p className="eyebrow">{team ? team.name : "Free agent"}</p>
          <h1 className="page-title">{player.name}</h1>
        </div>
        <Link className="btn btn-secondary btn-sm" href="/league">
          Back to roster
        </Link>
      </div>

      <div className="player-hero">
        <div className="player-badge">{player.ratings.overall}</div>
        <div>
          <p className="stat-label">Overall</p>
          <p className="muted" style={{ margin: "0.25rem 0 0" }}>
            {player.position} · age {player.age} · {player.potential} potential
          </p>
          <p className="muted" style={{ margin: "0.25rem 0 0" }}>
            {contract ? `${millions(contract.salary)} · ${contract.yearsRemaining}y remaining` : "No contract"}
          </p>
        </div>
        <div style={{ marginLeft: "auto" }}>
          {player.injuredDays > 0 ? (
            <span className="tag tag-danger">out {player.injuredDays}d</span>
          ) : (
            <span className="tag tag-good">active</span>
          )}
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>Attributes</h2>
          <p className="panel-note">
            rotation #{player.rotationOrder} · {player.targetMinutes} target min
          </p>
        </div>
        <div className="rating-bars">
          {RATING_ROWS.map(([label, key]) => {
            const value = player.ratings[key];
            return (
              <div className="rating-bar" key={key}>
                <span className="rating-bar-label">{label}</span>
                <span
                  className="rating-bar-track"
                  role="meter"
                  aria-valuenow={value}
                  aria-valuemin={0}
                  aria-valuemax={99}
                  aria-label={`${label} rating`}
                >
                  <span className="rating-bar-fill" style={{ width: `${Math.min(100, value)}%` }} />
                </span>
                <span className="rating-bar-value">{value}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel mobile-table-panel">
        <div className="panel-head">
          <h2>Recent games</h2>
          <p className="panel-note">last {home.recentGames.length} league games</p>
        </div>
        {log.length === 0 ? (
          <p className="muted">No game logs yet — advance the calendar to generate box scores.</p>
        ) : (
          <ScrollableTable
            label={`${player.name} recent game log`}
            offscreenColumns="minutes, points, rebounds, assists, turnovers, and shooting splits"
          >
            <table className="box-table">
              <thead>
                <tr>
                  <th scope="col">Opponent</th>
                  <th scope="col">MIN</th>
                  <th scope="col">PTS</th>
                  <th scope="col">REB</th>
                  <th scope="col">AST</th>
                  <th scope="col">TOV</th>
                  <th scope="col">FG</th>
                  <th scope="col">3P</th>
                  <th scope="col">FT</th>
                </tr>
              </thead>
              <tbody>
                {log.map((entry) => (
                  <tr key={entry.gameId}>
                    <td>
                      <Link className="cell-link" href={`/games/${entry.gameId}`}>
                        {entry.opponent}
                      </Link>
                      {entry.isPlayoff && (
                        <span className="tag tag-accent" style={{ marginLeft: "0.5rem" }}>
                          PO
                        </span>
                      )}
                    </td>
                    <td>{entry.line.minutes.toFixed(1)}</td>
                    <td>{entry.line.pts}</td>
                    <td>{entry.line.reb}</td>
                    <td>{entry.line.ast}</td>
                    <td>{entry.line.tov}</td>
                    <td>
                      {entry.line.fgm}-{entry.line.fga}
                    </td>
                    <td>
                      {entry.line.tpm}-{entry.line.tpa}
                    </td>
                    <td>
                      {entry.line.ftm}-{entry.line.fta}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>
        )}
      </section>
    </main>
  );
}
