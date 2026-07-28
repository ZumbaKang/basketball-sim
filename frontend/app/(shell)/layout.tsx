import { AppNav } from "@/components/AppNav";

export default function LeagueShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <AppNav />
      <div id="main-content">{children}</div>
    </div>
  );
}
