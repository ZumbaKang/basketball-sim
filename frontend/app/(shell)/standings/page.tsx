"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { League, StandingsRow } from "@basketball-sim/shared";

export default function StandingsPage() {
  const router = useRouter();
  const [standings, setStandings] = useState<StandingsRow[]>([]);
  const [league, setLeague] = useState<League | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/standings");
      if (res.status === 401) {
        router.replace("/");
        return;
      }
      const json = await res.json();
      setStandings(json.standings);
      setLeague(json.league);
    })();
  }, [router]);

  const east = standings.filter((s) => s.conference === "East");
  const west = standings.filter((s) => s.conference === "West");

  function table(rows: StandingsRow[], title: string) {
    return (
      <section className="panel">
        <h2>{title}</h2>
        <table className="box-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Team</th>
              <th>W</th>
              <th>L</th>
              <th>PCT</th>
              <th>DIFF</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.teamId}>
                <td>{r.rank}</td>
                <td>
                  {r.abbreviation} {r.teamName}
                </td>
                <td>{r.wins}</td>
                <td>{r.losses}</td>
                <td>{r.winPct.toFixed(3)}</td>
                <td>{r.pointDiff > 0 ? `+${r.pointDiff}` : r.pointDiff}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    );
  }

  return (
    <main>
      <h1 className="brand" style={{ fontSize: "clamp(2rem, 5vw, 3rem)" }}>
        Standings
      </h1>
      <p className="tagline">
        {league ? `${league.seasonYear} · Day ${league.day} · ${league.phase}` : "Loading…"}
      </p>
      {table(east, "Eastern Conference")}
      {table(west, "Western Conference")}
    </main>
  );
}
