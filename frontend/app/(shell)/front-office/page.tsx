"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { FranchiseHome, Player, Team } from "@basketball-sim/shared";
import {
  type AssetKind,
  type ProtectionMode,
  buildProtection,
  buildTradeAsset,
  filterPicksByRound,
  formatPayrollDelta,
  formatPickLabel,
  payrollDelta,
  picksForTeam,
  summarizeSelectedAsset,
} from "@/components/trade";
import { millions } from "@/lib/format";

type RoundFilter = 0 | 1 | 2;

export default function FrontOfficePage() {
  const router = useRouter();
  const [home, setHome] = useState<FranchiseHome | null>(null);
  const [giveKind, setGiveKind] = useState<AssetKind>("player");
  const [getKind, setGetKind] = useState<AssetKind>("player");
  const [giveId, setGiveId] = useState("");
  const [getId, setGetId] = useState("");
  const [givePickId, setGivePickId] = useState("");
  const [getPickId, setGetPickId] = useState("");
  const [giveRound, setGiveRound] = useState<RoundFilter>(0);
  const [getRound, setGetRound] = useState<RoundFilter>(0);
  const [giveProtectMode, setGiveProtectMode] = useState<ProtectionMode>("unprotected");
  const [getProtectMode, setGetProtectMode] = useState<ProtectionMode>("unprotected");
  const [giveTopN, setGiveTopN] = useState(5);
  const [getTopN, setGetTopN] = useState(5);
  const [toTeamId, setToTeamId] = useState("");
  const [faId, setFaId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"propose" | "finder" | "offer" | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/league");
      if (res.status === 401) {
        router.replace("/");
        return;
      }
      const json = await res.json();
      if (json.needsFranchise) {
        router.replace("/league");
        return;
      }
      const nextHome = json.home as FranchiseHome;
      setHome(nextHome);
      const roster: Player[] = nextHome.roster;
      const others: Team[] = nextHome.snapshot.teams.filter(
        (t) => t.id !== nextHome.snapshot.userTeamId,
      );
      if (roster[0]) setGiveId(roster[0].id);
      if (others[0]) {
        setToTeamId(others[0].id);
        const firstPartnerPlayer = nextHome.snapshot.players.find((p) => p.teamId === others[0]!.id);
        setGetId(firstPartnerPlayer?.id ?? "");
        const partnerPicks = picksForTeam(nextHome.draftPicks ?? [], others[0].id);
        if (partnerPicks[0]) setGetPickId(partnerPicks[0].id);
      }
      const userPicks = picksForTeam(nextHome.draftPicks ?? [], nextHome.snapshot.userTeamId ?? "");
      if (userPicks[0]) setGivePickId(userPicks[0].id);
      const fa = nextHome.snapshot.players.filter((p) => p.isFreeAgent);
      if (fa[0]) setFaId(fa[0].id);
    })();
  }, [router]);

  const teamsById = useMemo(() => {
    const map = new Map<string, Pick<Team, "abbreviation" | "name">>();
    if (!home) return map;
    for (const team of home.snapshot.teams) {
      map.set(team.id, { abbreviation: team.abbreviation, name: team.name });
    }
    return map;
  }, [home]);

  if (!home) {
    return (
      <main>
        <div className="skeleton-stack" aria-busy="true" aria-live="polite">
          <span className="sr-only">Loading front office…</span>
          <div className="skeleton" style={{ height: "2.5rem", width: "35%" }} />
          <div className="skeleton" style={{ height: "16rem" }} />
        </div>
      </main>
    );
  }

  const franchise = home;
  const userTeamId = franchise.snapshot.userTeamId ?? "";
  const otherTeams = franchise.snapshot.teams.filter((t) => t.id !== userTeamId);
  const theirPlayers = franchise.snapshot.players.filter((p) => p.teamId === toTeamId);
  const freeAgents = franchise.snapshot.players.filter((p) => p.isFreeAgent).slice(0, 40);
  const userTeam = franchise.snapshot.teams.find((t) => t.id === userTeamId);
  const selectedPartner = otherTeams.find((t) => t.id === toTeamId);

  const givePicks = filterPicksByRound(picksForTeam(franchise.draftPicks ?? [], userTeamId), giveRound);
  const getPicks = filterPicksByRound(picksForTeam(franchise.draftPicks ?? [], toTeamId), getRound);

  const selectedGivePlayer = franchise.roster.find((p) => p.id === giveId);
  const selectedReceivePlayer = theirPlayers.find((p) => p.id === getId);
  const selectedGivePick = givePicks.find((p) => p.id === givePickId) ??
    picksForTeam(franchise.draftPicks ?? [], userTeamId).find((p) => p.id === givePickId);
  const selectedReceivePick = getPicks.find((p) => p.id === getPickId) ??
    picksForTeam(franchise.draftPicks ?? [], toTeamId).find((p) => p.id === getPickId);

  const giveProtection = buildProtection(giveProtectMode, giveTopN);
  const getProtection = buildProtection(getProtectMode, getTopN);

  const outgoing = summarizeSelectedAsset({
    kind: giveKind,
    player: selectedGivePlayer,
    contract: franchise.snapshot.contracts.find((c) => c.playerId === giveId),
    pick: selectedGivePick,
    teamsById,
    protection: giveProtection,
  });
  const incoming = summarizeSelectedAsset({
    kind: getKind,
    player: selectedReceivePlayer,
    contract: franchise.snapshot.contracts.find((c) => c.playerId === getId),
    pick: selectedReceivePick,
    teamsById,
    protection: getProtection,
  });

  const busy = pending !== null;
  const fromAsset = buildTradeAsset({
    kind: giveKind,
    playerId: giveId,
    draftPickId: givePickId,
    protection: giveProtection,
  });
  const toAsset = buildTradeAsset({
    kind: getKind,
    playerId: getId,
    draftPickId: getPickId,
    protection: getProtection,
  });
  const canPropose = Boolean(fromAsset && toAsset && toTeamId);

  async function propose() {
    if (busy || !fromAsset || !toAsset) return;
    setError(null);
    setMsg(null);
    setPending("propose");
    try {
      const res = await fetch("/api/gm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "propose",
          proposal: {
            leagueId: franchise.snapshot.league.id,
            fromTeamId: userTeamId,
            toTeamId,
            fromAssets: [fromAsset],
            toAssets: [toAsset],
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed");
        return;
      }
      setMsg(json.decision.reason);
    } catch {
      setError("Proposal failed");
    } finally {
      setPending(null);
    }
  }

  async function finder() {
    if (busy || giveKind !== "player" || !giveId) return;
    setError(null);
    setMsg(null);
    setPending("finder");
    try {
      const res = await fetch("/api/gm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "finder",
          leagueId: franchise.snapshot.league.id,
          playerId: giveId,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed");
        return;
      }
      if (!json.packages?.length) {
        setMsg("No AI teams liked packages for that asset.");
        return;
      }
      const top = json.packages[0];
      setMsg(`${top.teamName}: ${top.decision.reason}`);
      setToTeamId(top.teamId);
      setGiveKind("player");
      setGetKind("player");
      setGetId(top.proposal.toAssets[0]?.playerId ?? "");
      // The finder rewrites both sides of the deal, so send the reader to the
      // summary rather than leaving focus on a button whose context just moved.
      summaryRef.current?.focus();
    } catch {
      setError("Trade finder failed");
    } finally {
      setPending(null);
    }
  }

  async function offer() {
    if (busy) return;
    setError(null);
    setMsg(null);
    setPending("offer");
    try {
      const res = await fetch("/api/gm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "offer",
          offer: {
            leagueId: franchise.snapshot.league.id,
            teamId: userTeamId,
            playerId: faId,
            salary: 8_000_000,
            years: 2,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed");
        return;
      }
      setMsg(json.result.reason);
    } catch {
      setError("Offer failed");
    } finally {
      setPending(null);
    }
  }

  function renderAssetControls(side: "give" | "get") {
    const isGive = side === "give";
    const kind = isGive ? giveKind : getKind;
    const setKind = isGive ? setGiveKind : setGetKind;
    const round = isGive ? giveRound : getRound;
    const setRound = isGive ? setGiveRound : setGetRound;
    const pickId = isGive ? givePickId : getPickId;
    const setPickId = isGive ? setGivePickId : setGetPickId;
    const playerId = isGive ? giveId : getId;
    const setPlayerId = isGive ? setGiveId : setGetId;
    const players = isGive ? franchise.roster : theirPlayers;
    const picks = isGive ? givePicks : getPicks;
    const protectMode = isGive ? giveProtectMode : getProtectMode;
    const setProtectMode = isGive ? setGiveProtectMode : setGetProtectMode;
    const topN = isGive ? giveTopN : getTopN;
    const setTopN = isGive ? setGiveTopN : setGetTopN;
    const label = isGive ? "You send" : "You receive";

    return (
      <fieldset className="trade-side" disabled={busy}>
        <legend>{label}</legend>
        <div className="asset-kind-toggle" role="group" aria-label={`${label} asset type`}>
          <button
            type="button"
            className={`chip${kind === "player" ? " chip-active" : ""}`}
            aria-pressed={kind === "player"}
            onClick={() => setKind("player")}
          >
            Player
          </button>
          <button
            type="button"
            className={`chip${kind === "pick" ? " chip-active" : ""}`}
            aria-pressed={kind === "pick"}
            onClick={() => setKind("pick")}
          >
            Draft pick
          </button>
        </div>

        {kind === "player" ? (
          <label>
            Player
            <select value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
              {players.length === 0 && <option value="">No players</option>}
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.ratings.overall})
                </option>
              ))}
            </select>
          </label>
        ) : (
          <>
            <label>
              Round
              <select
                value={String(round)}
                onChange={(e) => {
                  const next = Number(e.target.value) as RoundFilter;
                  setRound(next);
                  const list = filterPicksByRound(
                    picksForTeam(franchise.draftPicks ?? [], isGive ? userTeamId : toTeamId),
                    next,
                  );
                  if (list[0]) setPickId(list[0].id);
                  else setPickId("");
                }}
              >
                <option value="0">All rounds</option>
                <option value="1">First round</option>
                <option value="2">Second round</option>
              </select>
            </label>
            <label>
              Pick
              <select value={pickId} onChange={(e) => setPickId(e.target.value)}>
                {picks.length === 0 && <option value="">No tradable picks</option>}
                {picks.map((p) => (
                  <option key={p.id} value={p.id}>
                    {formatPickLabel(p, teamsById)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Protection
              <select
                value={protectMode}
                onChange={(e) => setProtectMode(e.target.value as ProtectionMode)}
              >
                <option value="unprotected">Unprotected</option>
                <option value="top">Top-N protected</option>
              </select>
            </label>
            {protectMode === "top" && (
              <label>
                Protect through
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={topN}
                  onChange={(e) => setTopN(Number(e.target.value))}
                />
              </label>
            )}
          </>
        )}
      </fieldset>
    );
  }

  return (
    <main className="rise front-office">
      <div className="page-head">
        <div>
          <p className="eyebrow">
            {franchise.snapshot.league.seasonYear} · payroll {millions(franchise.payroll)}
          </p>
          <h1 className="page-title">Front office</h1>
          <p className="page-sub">Trades, free agents, and AI owners with motives.</p>
        </div>
      </div>

      {msg && (
        <p className="muted" role="status">
          {msg}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <section className="panel trade-builder">
        <div className="panel-head">
          <h2>Propose a trade</h2>
          {selectedPartner && <p className="panel-note">{selectedPartner.gmDirection} front office</p>}
        </div>

        <div className="form trade-form">
          {renderAssetControls("give")}

          <label className="trade-partner">
            Partner
            <select
              value={toTeamId}
              disabled={busy}
              onChange={(e) => {
                const nextTeam = e.target.value;
                setToTeamId(nextTeam);
                const first = franchise.snapshot.players.find((p) => p.teamId === nextTeam);
                setGetId(first?.id ?? "");
                const partnerPicks = filterPicksByRound(
                  picksForTeam(franchise.draftPicks ?? [], nextTeam),
                  getRound,
                );
                setGetPickId(partnerPicks[0]?.id ?? "");
              }}
            >
              {otherTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.gmDirection})
                </option>
              ))}
            </select>
          </label>

          {renderAssetControls("get")}
        </div>

        <div
          className="trade-summary"
          aria-label="Selected trade assets"
          aria-live="polite"
          ref={summaryRef}
          tabIndex={-1}
        >
          <div className="trade-summary-side">
            <span className="trade-summary-label">You send</span>
            <strong className="trade-summary-name">{outgoing.assetName}</strong>
            <span className="trade-summary-team">{userTeam?.name ?? "Your team"}</span>
            <span className="trade-summary-detail">{outgoing.detail}</span>
          </div>
          <span className="trade-summary-divider" aria-hidden="true">
            for
          </span>
          <div className="trade-summary-side">
            <span className="trade-summary-label">You receive</span>
            <strong className="trade-summary-name">{incoming.assetName}</strong>
            <span className="trade-summary-team">{selectedPartner?.name ?? "Trade partner"}</span>
            <span className="trade-summary-detail">{incoming.detail}</span>
          </div>
          <span className="trade-summary-delta">{formatPayrollDelta(payrollDelta(outgoing, incoming))}</span>
        </div>

        <div className="cta-row trade-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !canPropose}
            onClick={() => void propose()}
          >
            {pending === "propose" ? "Sending…" : "Send proposal"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy || giveKind !== "player" || !giveId}
            onClick={() => void finder()}
            title={giveKind !== "player" ? "Trade finder starts from a player you send" : undefined}
          >
            {pending === "finder" ? "Searching…" : "Trade finder"}
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Free agency</h2>
          <p className="panel-note">{freeAgents.length} available</p>
        </div>
        {freeAgents.length === 0 ? (
          <p className="muted">No free agents right now — check back in the offseason.</p>
        ) : (
          <>
            <label className="form free-agent-form">
              Target
              <select value={faId} disabled={busy} onChange={(e) => setFaId(e.target.value)}>
                {freeAgents.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.position} · {p.ratings.overall} ovr
                  </option>
                ))}
              </select>
            </label>
            <div className="cta-row free-agent-actions" style={{ marginTop: "1rem" }}>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void offer()}>
                {pending === "offer" ? "Offering…" : "Offer $8M / 2 yrs"}
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
