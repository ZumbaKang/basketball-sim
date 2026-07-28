import { AuthPanel } from "@/components/AuthPanel";

export default function HomePage() {
  return (
    <div className="shell auth-shell">
      <main className="auth-layout">
        <section className="rise auth-hero">
          <p className="eyebrow">Basketball league simulator</p>
          <h1 className="brand">TIPOFF</h1>
          <p className="tagline">
            Pick a franchise. Run the season. Trade with AI owners who have motives — and read every
            game like a real box score.
          </p>
        </section>

        <AuthPanel />
      </main>
    </div>
  );
}
