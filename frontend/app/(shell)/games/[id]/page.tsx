"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { GameResult, PlayerGameLine, TeamGameLine } from "@basketball-sim/shared";
import { ScrollableTable } from "@/components/ScrollableTable";

function shooting(made: number, attempted: number): string {
  if (attempted === 0) return "—";
  return `${((made / attempted) * 100).toFixed(0)}%`;
}

function BoxTable({ line }: { line: TeamGameLine }) {
  return (
    <section className="panel mobile-table-panel">
      <div className="panel-head">
        <h2>{line.teamName}</h2>
        <p className="panel-note">
          {line.pts} pts · {shooting(line.fgm, line.fga)} FG · {shooting(line.tpm, line.tpa)} 3P
        </p>
      </div>
      <ScrollableTable
        label={`${line.teamName} box score`}
        offscreenColumns="minutes, rebounds, assists, steals, blocks, turnovers, and shooting splits"
      >
        <table className="box-table">
          <thead>
            <tr>
              <th scope="col">Player</th>
              <th scope="col">MIN</th>
              <th scope="col">PTS</th>
              <th scope="col">REB</th>
              <th scope="col">AST</th>
              <th scope="col">STL</th>
              <th scope="col">BLK</th>
              <th scope="col">TOV</th>
              <th scope="col">FG</th>
              <th scope="col">3P</th>
              <th scope="col">FT</th>
            </tr>
          </thead>
          <tbody>
            {line.players.map((p: PlayerGameLine) => (
              <tr key={p.playerId}>
                <td>
                  <Link className="cell-link" href={`/players/${p.playerId}`}>
                    {p.playerName}
                  </Link>
                </td>
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
            <tr className="row-total">
              <td>Team</td>
              <td />
              <td>{line.pts}</td>
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
      </ScrollableTable>
    </section>
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
      <main>
        <p className="error" role="alert">
          {error}
        </p>
        <Link className="btn btn-secondary btn-sm" href="/league">
          Back to franchise
        </Link>
      </main>
    );
  }

  if (!game) {
    return (
      <main>
        <div className="skeleton-stack" aria-busy="true" aria-live="polite">
          <span className="sr-only">Loading box score…</span>
          <div className="skeleton" style={{ height: "8rem" }} />
          <div className="skeleton" style={{ height: "16rem" }} />
        </div>
      </main>
    );
  }

  const homeWon = game.home.pts > game.away.pts;

  return (
    <main className="rise">
      <div className="page-head">
        <div>
          <p className="eyebrow">{game.isPlayoff ? "Playoffs" : "Regular season"} · final</p>
          <h1 className="page-title">Box score</h1>
        </div>
        <p className="panel-note">{new Date(game.playedAt).toLocaleString()}</p>
      </div>

      <div className="scoreboard">
        <div className={`side${homeWon ? " side-winner" : ""}`}>
          <div className="name">{game.home.teamName}</div>
          <div className="pts">{game.home.pts}</div>
        </div>
        <div className="vs">FINAL</div>
        <div className={`side${homeWon ? "" : " side-winner"}`}>
          <div className="name">{game.away.teamName}</div>
          <div className="pts">{game.away.pts}</div>
        </div>
      </div>

      <BoxTable line={game.home} />
      <BoxTable line={game.away} />
    </main>
  );
}
