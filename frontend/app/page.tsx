import { AuthPanel } from "@/components/AuthPanel";

export default function HomePage() {
  return (
    <div className="shell">
      <main className="auth-layout">
        <section className="rise">
          <p className="eyebrow">Basketball league simulator</p>
          <h1 className="brand">TIPOFF</h1>
          <p className="tagline">
            Pick a franchise. Run the season. Trade with AI owners who have motives — and read every
            game like a real box score.
          </p>
          <ul className="marquee-list">
            <li>30 clubs, a full calendar, playoffs, awards, and franchise history.</li>
            <li>Rosters, contracts, the draft, and free agency under one front office.</li>
            <li>Box scores where the minutes, usage, and totals actually reconcile.</li>
          </ul>
        </section>

        <AuthPanel />
      </main>
    </div>
  );
}
