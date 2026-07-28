"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { League, StandingsRow } from "@basketball-sim/shared";
import { ScrollableTable } from "@/components/ScrollableTable";
import { pct, signed } from "@/lib/format";

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

  const userTeamId = league?.userTeamId ?? null;

  function table(rows: StandingsRow[], title: string) {
    return (
      <section className="panel mobile-table-panel">
        <div className="panel-head">
          <h2>{title}</h2>
          <p className="panel-note">{rows.length} teams</p>
        </div>
        <ScrollableTable
          label={`${title} standings`}
          offscreenColumns="wins, losses, winning percentage, and point differential"
        >
          <table className="box-table">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col" className="col-name">
                  Team
                </th>
                <th scope="col">W</th>
                <th scope="col">L</th>
                <th scope="col">PCT</th>
                <th scope="col">DIFF</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.teamId} className={r.teamId === userTeamId ? "row-highlight" : undefined}>
                  <td>{r.rank}</td>
                  <td className="col-name">
                    <span className="tag" style={{ marginRight: "0.5rem" }}>
                      {r.abbreviation}
                    </span>
                    {r.teamName}
                  </td>
                  <td>{r.wins}</td>
                  <td>{r.losses}</td>
                  <td>{pct(r.winPct)}</td>
                  <td style={{ color: r.pointDiff > 0 ? "var(--good)" : r.pointDiff < 0 ? "var(--danger)" : undefined }}>
                    {signed(r.pointDiff)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableTable>
      </section>
    );
  }

  return (
    <main className="rise">
      <div className="page-head">
        <div>
          <p className="eyebrow">
            {league ? `${league.seasonYear} · Day ${league.day} · ${league.phase}` : "Loading…"}
          </p>
          <h1 className="page-title">Standings</h1>
        </div>
      </div>
      {table(
        standings.filter((s) => s.conference === "East"),
        "Eastern Conference",
      )}
      {table(
        standings.filter((s) => s.conference === "West"),
        "Western Conference",
      )}
    </main>
  );
}
