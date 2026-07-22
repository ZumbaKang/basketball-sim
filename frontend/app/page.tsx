"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, displayName }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      router.push("/league");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <p className="muted" style={{ marginBottom: "0.75rem", letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>
        Basketball league sim
      </p>
      <h1 className="brand">TIPOFF</h1>
      <p className="tagline">Your league waits exactly where you left it. Play a game. Read the box score like the real thing.</p>

      <div className="cta-row">
        <button type="button" className={`btn ${mode === "register" ? "btn-primary" : "btn-secondary"}`} onClick={() => setMode("register")}>
          Create account
        </button>
        <button type="button" className={`btn ${mode === "login" ? "btn-primary" : "btn-secondary"}`} onClick={() => setMode("login")}>
          Log in
        </button>
      </div>

      <section className="panel">
        <h2>{mode === "register" ? "Join the circuit" : "Welcome back"}</h2>
        <form className="form" onSubmit={onSubmit}>
          {mode === "register" && (
            <label>
              Display name
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Commissioner" />
            </label>
          )}
          <label>
            Email
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@arena.com" />
          </label>
          <label>
            Password
            <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8+ characters" />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="btn btn-primary" disabled={busy} type="submit">
            {busy ? "Working…" : mode === "register" ? "Start my league" : "Enter league"}
          </button>
        </form>
      </section>
    </main>
  );
}
