import { AppNav } from "@/components/AppNav";

export default function LeagueShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <AppNav />
      {children}
    </div>
  );
}
