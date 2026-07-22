"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { GameResult, PlayerGameLine, TeamGameLine } from "@basketball-sim/shared";

function BoxTable({ line }: { line: TeamGameLine }) {
  return (
    <div style={{ overflowX: "auto", marginBottom: "1.25rem" }}>
      <h3 style={{ fontFamily: "var(--font-display)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {line.teamName}
      </h3>
      <table className="box-table">
        <thead>
          <tr>
            <th>Player</th>
            <th>MIN</th>
            <th>PTS</th>
            <th>REB</th>
            <th>AST</th>
            <th>STL</th>
            <th>BLK</th>
            <th>TOV</th>
            <th>FG</th>
            <th>3P</th>
            <th>FT</th>
          </tr>
        </thead>
        <tbody>
          {line.players.map((p: PlayerGameLine) => (
            <tr key={p.playerId}>
              <td>{p.playerName}</td>
              <td>{p.minutes.toFixed(1)}</td>
              <td>{p.pts}</td>
              <td>{p.reb}</td>
              <td>{p.ast}</td>
              <td>{p.stl}</td>
              <td>{p.blk}</td>
              <td>{p.tov}</td>
              <td>
                {p.fgm}-{p.fga}
              </td>
              <td>
                {p.tpm}-{p.tpa}
              </td>
              <td>
                {p.ftm}-{p.fta}
              </td>
            </tr>
          ))}
          <tr>
            <td>
              <strong>Team</strong>
            </td>
            <td />
            <td>
              <strong>{line.pts}</strong>
            </td>
            <td>{line.reb}</td>
            <td>{line.ast}</td>
            <td>{line.stl}</td>
            <td>{line.blk}</td>
            <td>{line.tov}</td>
            <td>
              {line.fgm}-{line.fga}
            </td>
            <td>
              {line.tpm}-{line.tpa}
            </td>
            <td>
              {line.ftm}-{line.fta}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function GamePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [game, setGame] = useState<GameResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/games/${params.id}`);
      if (res.status === 401) {
        router.replace("/");
        return;
      }
      const json = (await res.json()) as { game?: GameResult; error?: string };
      if (!res.ok || !json.game) {
        setError(json.error ?? "Game not found");
        return;
      }
      setGame(json.game);
    })();
  }, [params.id, router]);

  if (error) {
    return (
      <main className="shell">
        <p className="error">{error}</p>
        <a className="btn btn-secondary" href="/league">
          Back to league
        </a>
      </main>
    );
  }

  if (!game) {
    return (
      <main className="shell">
        <p className="muted">Loading box score…</p>
      </main>
    );
  }

  return (
    <main className="shell">
      <div className="topbar">
        <a className="mark" href="/league">
          TIPOFF
        </a>
        <a className="btn btn-secondary" href="/league">
          Back to league
        </a>
      </div>

      <div className="scoreboard">
        <div className="side">
          <div className="name">{game.home.teamName}</div>
          <div className="pts">{game.home.pts}</div>
        </div>
        <div className="vs">FINAL</div>
        <div className="side">
          <div className="name">{game.away.teamName}</div>
          <div className="pts">{game.away.pts}</div>
        </div>
      </div>

      <p className="muted" style={{ marginTop: 0 }}>
        {new Date(game.playedAt).toLocaleString()}
      </p>

      <section className="panel">
        <h2>Box score</h2>
        <BoxTable line={game.home} />
        <BoxTable line={game.away} />
      </section>
    </main>
  );
}
