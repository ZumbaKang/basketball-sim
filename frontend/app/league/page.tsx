"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { GameResult, LeagueSnapshot, User } from "@basketball-sim/shared";

type LeaguePayload = {
  user: User;
  snapshot: LeagueSnapshot;
  games: GameResult[];
};

export default function LeaguePage() {
  const router = useRouter();
  const [data, setData] = useState<LeaguePayload | null>(null);
  const [homeTeamId, setHomeTeamId] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/league");
      if (res.status === 401) {
        router.replace("/");
        return;
      }
      const json = (await res.json()) as LeaguePayload;
      setData(json);
      if (json.snapshot.teams[0]) setHomeTeamId(json.snapshot.teams[0].id);
      if (json.snapshot.teams[1]) setAwayTeamId(json.snapshot.teams[1].id);
    })();
  }, [router]);

  const teamOptions = useMemo(() => data?.snapshot.teams ?? [], [data]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
  }

  async function play() {
    if (!data) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/games/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId: data.snapshot.league.id,
          homeTeamId,
          awayTeamId,
        }),
      });
      const json = (await res.json()) as { game?: GameResult; error?: string };
      if (!res.ok || !json.game) throw new Error(json.error ?? "Play failed");
      router.push(`/games/${json.game.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Play failed");
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <main className="shell">
        <p className="muted">Loading your league…</p>
      </main>
    );
  }

  return (
    <main className="shell">
      <div className="topbar">
        <div className="mark">TIPOFF</div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <span className="muted">{data.user.displayName}</span>
          <button type="button" className="btn btn-secondary" onClick={() => void logout()}>
            Log out
          </button>
        </div>
      </div>

      <h1 className="brand" style={{ fontSize: "clamp(2rem, 6vw, 3.4rem)" }}>
        {data.snapshot.league.name}
      </h1>
      <p className="tagline">Season {data.snapshot.league.seasonYear}. Pick two clubs and tip it off.</p>

      <section className="panel">
        <h2>Teams</h2>
        <div className="grid-teams">
          {data.snapshot.teams.map((team) => {
            const count = data.snapshot.players.filter((p) => p.teamId === team.id).length;
            return (
              <article key={team.id} className="team">
                <h3>
                  {team.abbreviation} · {team.name}
                </h3>
                <p>
                  {team.conference ?? "Independent"} · {count} players
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <h2>Play a game</h2>
        <div className="form" style={{ gridTemplateColumns: "1fr 1fr", alignItems: "end" }}>
          <label>
            Home
            <select value={homeTeamId} onChange={(e) => setHomeTeamId(e.target.value)}>
              {teamOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Away
            <select value={awayTeamId} onChange={(e) => setAwayTeamId(e.target.value)}>
              {teamOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error && <p className="error" style={{ marginTop: "0.75rem" }}>{error}</p>}
        <div className="cta-row">
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void play()}>
            {busy ? "Simulating…" : "Tip it off"}
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>Recent box scores</h2>
        {data.games.length === 0 ? (
          <p className="muted">No games yet. Play one above.</p>
        ) : (
          <ul className="game-list">
            {data.games.map((game) => (
              <li key={game.id}>
                <a href={`/games/${game.id}`}>
                  <span>
                    {game.home.teamName} {game.home.pts} — {game.away.pts} {game.away.teamName}
                  </span>
                  <span className="muted">{new Date(game.playedAt).toLocaleString()}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
