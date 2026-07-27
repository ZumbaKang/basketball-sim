export const NAV_ITEMS = [
  { href: "/league", label: "Franchise" },
  { href: "/standings", label: "Standings" },
  { href: "/front-office", label: "Front office" },
  { href: "/history", label: "History" },
] as const;

/** Box scores and player pages are drilldowns from the franchise hub, not their own tabs. */
export function getActiveNavHref(pathname: string): string | null {
  if (pathname === "/league" || pathname.startsWith("/games/") || pathname.startsWith("/players/")) {
    return "/league";
  }

  return NAV_ITEMS.find(({ href }) => pathname === href)?.href ?? null;
}
