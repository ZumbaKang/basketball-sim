"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ScrollableTable } from "@/components/ScrollableTable";

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
      <main>
        <div className="skeleton-stack" aria-busy="true" aria-live="polite">
          <span className="sr-only">Loading history…</span>
          <div className="skeleton" style={{ height: "2.5rem", width: "35%" }} />
          <div className="skeleton" style={{ height: "9rem" }} />
          <div className="skeleton" style={{ height: "9rem" }} />
        </div>
      </main>
    );
  }

  return (
    <main className="rise">
      <div className="page-head">
        <div>
          <p className="eyebrow">Record book</p>
          <h1 className="page-title">History</h1>
          <p className="page-sub">Champions, awards, and the current scoring race.</p>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>Champions</h2>
          <p className="panel-note">{data.champions.length} titles</p>
        </div>
        {data.champions.length === 0 ? (
          <p className="muted">No banners yet — finish a playoff run.</p>
        ) : (
          <ul className="feed">
            {data.champions.map((c) => (
              <li key={`${c.seasonYear}-${c.teamName}`} className="feed-item">
                <span>
                  <span className="tag tag-accent" style={{ marginRight: "0.6rem" }}>
                    Champion
                  </span>
                  {c.teamName}
                </span>
                <span className="feed-meta">{c.seasonYear}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Awards</h2>
        </div>
        {data.awards.length === 0 ? (
          <p className="muted">Awards post when a season crowns a champion.</p>
        ) : (
          <ul className="feed">
            {data.awards.map((a, i) => (
              <li key={`${a.seasonYear}-${a.kind}-${i}`} className="feed-item">
                <span>
                  <span className="tag" style={{ marginRight: "0.6rem" }}>
                    {a.kind}
                  </span>
                  {a.playerName}
                </span>
                <span className="feed-meta">{a.seasonYear}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel mobile-table-panel">
        <div className="panel-head">
          <h2>Scoring leaders</h2>
        </div>
        <ScrollableTable
          label="Scoring leaders"
          offscreenColumns="games played, points, rebounds, and assists per game"
        >
          <table className="box-table">
            <thead>
              <tr>
                <th scope="col">Player</th>
                <th scope="col">GP</th>
                <th scope="col">PPG</th>
                <th scope="col">RPG</th>
                <th scope="col">APG</th>
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
        </ScrollableTable>
      </section>
    </main>
  );
}
