"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ThemeToggle } from "./ThemeToggle";

type Mode = "login" | "register";

export function AuthPanel() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("register");
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
    <section className="auth-card rise" aria-labelledby="auth-heading">
      <div className="panel-head">
        <h2 id="auth-heading">{mode === "register" ? "Join the circuit" : "Welcome back"}</h2>
        <ThemeToggle />
      </div>

      <div className="auth-tabs" role="tablist" aria-label="Account access">
        {(["register", "login"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            className={`auth-tab${mode === value ? " auth-tab-active" : ""}`}
            onClick={() => setMode(value)}
          >
            {value === "register" ? "Create account" : "Log in"}
          </button>
        ))}
      </div>

      <form className="form" onSubmit={onSubmit}>
        {mode === "register" && (
          <label>
            Display name
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Commissioner"
              autoComplete="nickname"
            />
          </label>
        )}
        <label>
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@arena.com"
            autoComplete="email"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="8+ characters"
            autoComplete={mode === "register" ? "new-password" : "current-password"}
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn-primary" disabled={busy} type="submit">
          {busy ? "Working…" : mode === "register" ? "Start my league" : "Enter league"}
        </button>
      </form>
    </section>
  );
}
