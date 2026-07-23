"use client";

import type { User } from "@basketball-sim/shared";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getActiveNavHref, NAV_ITEMS } from "./navigation";

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const activeHref = getActiveNavHref(pathname);

  useEffect(() => {
    const controller = new AbortController();

    void fetch("/api/auth/me", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const payload = (await response.json()) as { user: User };
        setUser(payload.user);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setUser(null);
        }
      });

    return () => controller.abort();
  }, []);

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <header className="app-nav">
      <Link className="mark" href="/league" aria-label="TIPOFF franchise home">
        TIPOFF
      </Link>
      <nav className="app-nav-links" aria-label="League">
        {NAV_ITEMS.map(({ href, label }) => {
          const active = activeHref === href;
          return (
            <Link
              key={href}
              className={`app-nav-link${active ? " app-nav-link-active" : ""}`}
              href={href}
              aria-current={active ? "page" : undefined}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="app-nav-account">
        {user && <span className="app-nav-user">{user.displayName}</span>}
        <button type="button" className="app-nav-logout" disabled={loggingOut} onClick={() => void logout()}>
          {loggingOut ? "Logging out…" : "Log out"}
        </button>
      </div>
    </header>
  );
}
