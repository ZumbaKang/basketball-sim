"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Payload = {
  champions: { seasonYear: number; teamName: string }[];
  awards: { seasonYear: number; kind: string; playerName: string }[];
  leaders: { playerName: string; ppg: number; rpg: number; apg: number; games: number }[];
};

export default function HistoryPage() {
  const router = useRouter();
  const [data, setData] = useState<Payload | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/history");
      if (res.status === 401) {
        router.replace("/");
        return;
      }
      setData(await res.json());
    })();
  }, [router]);

  if (!data) {
    return (
      <main className="shell">
        <p className="muted">Loading history…</p>
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
          Franchise
        </a>
      </div>
      <h1 className="brand" style={{ fontSize: "clamp(2rem, 5vw, 3rem)" }}>
        History
      </h1>
      <p className="tagline">Champions, awards, and scoring leaders.</p>

      <section className="panel">
        <h2>Champions</h2>
        {data.champions.length === 0 ? (
          <p className="muted">No cups yet — finish a playoff.</p>
        ) : (
          <ul className="game-list">
            {data.champions.map((c) => (
              <li key={`${c.seasonYear}-${c.teamName}`}>
                <a href="#champ">
                  <span>{c.teamName}</span>
                  <span className="muted">{c.seasonYear}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2>Awards</h2>
        {data.awards.length === 0 ? (
          <p className="muted">Awards post when a season crowns a champion.</p>
        ) : (
          <ul className="game-list">
            {data.awards.map((a, i) => (
              <li key={`${a.seasonYear}-${a.kind}-${i}`}>
                <a href="#award">
                  <span>
                    {a.kind}: {a.playerName}
                  </span>
                  <span className="muted">{a.seasonYear}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2>Scoring leaders</h2>
        <table className="box-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>GP</th>
              <th>PPG</th>
              <th>RPG</th>
              <th>APG</th>
            </tr>
          </thead>
          <tbody>
            {data.leaders.map((l) => (
              <tr key={l.playerName}>
                <td>{l.playerName}</td>
                <td>{l.games}</td>
                <td>{l.ppg.toFixed(1)}</td>
                <td>{l.rpg.toFixed(1)}</td>
                <td>{l.apg.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
