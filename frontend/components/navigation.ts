export const NAV_ITEMS = [
  { href: "/league", label: "Franchise" },
  { href: "/standings", label: "Standings" },
  { href: "/front-office", label: "Front office" },
  { href: "/history", label: "History" },
] as const;

export function getActiveNavHref(pathname: string): string | null {
  if (pathname === "/league" || pathname.startsWith("/games/")) {
    return "/league";
  }

  return NAV_ITEMS.find(({ href }) => pathname === href)?.href ?? null;
}
