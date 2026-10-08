import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  ArrowRight,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Crosshair,
  ExternalLink,
  Flame,
  LayoutDashboard,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Swords,
  Target,
  Trophy,
  Zap,
} from "lucide-react";
import type { Dashboard, Match, Participant } from "./types";
import { aggregate, filterMatches, insights, summary } from "./analytics";
import "./style.css";
const APP_NAME = "RiftScope";
const format = (n: number) =>
  new Intl.NumberFormat("en", {
    notation: n >= 10000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(n);
const timeAgo = (t: number) => {
  const m = Math.max(0, Math.floor((Date.now() - t) / 60000));
  return m < 60
    ? `${m}m ago`
    : m < 1440
      ? `${Math.floor(m / 60)}h ago`
      : `${Math.floor(m / 1440)}d ago`;
};
function Icon({
  src,
  name,
  className = "",
}: {
  src: string;
  name: string;
  className?: string;
}) {
  return src ? (
    <img
      className={className}
      src={src}
      alt={name}
      title={name}
      loading="lazy"
      onError={(e) => {
        e.currentTarget.style.visibility = "hidden";
      }}
    />
  ) : (
    <span className={`empty-icon ${className}`} title={name} />
  );
}
function Items({ p }: { p: Participant }) {
  return (
    <div className="items">
      {p.items.map((i, n) => (
        <Icon
          key={n}
          src={i.icon}
          name={i.name}
          className={n === 6 ? "trinket" : ""}
        />
      ))}
    </div>
  );
}
function MatchRow({ match }: { match: Match }) {
  const [open, setOpen] = useState(false);
  const p = match.player;
  return (
    <article
      className={`match ${match.remake ? "remake" : p.win ? "win" : "loss"}`}
    >
      <button
        className="match-main"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <div className="result">
          <strong>
            {match.remake ? "Remake" : p.win ? "Victory" : "Defeat"}
          </strong>
          <span>{match.queue}</span>
          <small>
            {timeAgo(match.timestamp)} · {Math.floor(match.duration / 60)}:
            {String(Math.floor(match.duration % 60)).padStart(2, "0")}
          </small>
        </div>
        <div className="champion">
          <div className="portrait">
            <Icon src={p.icon} name={p.champion} />
            <small>{p.level}</small>
          </div>
          <div className="spell-stack">
            {p.spells.map((s) => (
              <Icon key={s.name} src={s.icon} name={s.name} />
            ))}
          </div>
          <div className="runes">
            {p.runes.map((r) => (
              <Icon key={r.name} src={r.icon} name={r.name} />
            ))}
          </div>
          <div>
            <b>{p.champion}</b>
            <small>{p.role}</small>
          </div>
        </div>
        <div className="match-kda">
          <strong>
            {p.kills} <i>/ {p.deaths} /</i> {p.assists}
          </strong>
          <small>
            <b>{p.deaths === 0 ? "Perfect" : p.kda.toFixed(2)}</b> KDA
          </small>
        </div>
        <div className="match-stats">
          <span>
            {p.cs} CS <small>({p.csMin.toFixed(1)}/min)</small>
          </span>
          <span>
            {(p.kp * 100).toFixed(0)}% KP · {p.vision ?? "—"} vision
          </span>
        </div>
        <Items p={p} />
        <div className="score">
          <b>{p.score}</b>
          <small>Custom score</small>
        </div>
        <ChevronDown className={open ? "rotate" : ""} size={16} />
      </button>
      {open && (
        <div className="match-detail">
          <div className="detail-caption">
            <span>Match breakdown · {match.id}</span>
            <span>
              Score:{" "}
              {p.score >= 80
                ? "Excellent"
                : p.score >= 60
                  ? "Good"
                  : p.score >= 40
                    ? "Average"
                    : "Poor"}{" "}
              · Personal metric, not a Riot rating or MMR
            </span>
          </div>
          {match.teams.map((t) => (
            <div key={t.id} className="team">
              <div className="team-title">
                <b>
                  {t.id === 100 ? "Blue" : "Red"} team ·{" "}
                  {t.win ? "Victory" : "Defeat"}
                </b>
                <span>
                  {t.kills} kills · {format(t.gold)} gold ·{" "}
                  {Object.entries(t.objectives)
                    .map(([k, v]) => `${v} ${k}`)
                    .join(" · ")}
                </span>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Player / champion</th>
                      <th>Role</th>
                      <th>K / D / A</th>
                      <th>CS</th>
                      <th>Damage</th>
                      <th>Vision</th>
                      <th>Build</th>
                    </tr>
                  </thead>
                  <tbody>
                    {match.participants
                      .filter((a) => a.teamId === t.id)
                      .map((a) => (
                        <tr
                          className={a.puuid === p.puuid ? "own" : ""}
                          key={a.puuid}
                        >
                          <td>
                            <div className="player-cell">
                              <Icon src={a.icon} name={a.champion} />
                              <div>
                                <b>{a.name}</b>
                                <small>
                                  {a.champion}
                                  {a.puuid === p.puuid ? " · You" : ""}
                                </small>
                              </div>
                            </div>
                          </td>
                          <td>{a.role}</td>
                          <td>
                            {a.kills} / {a.deaths} / {a.assists}
                          </td>
                          <td>{a.cs}</td>
                          <td>{a.damage === null ? "—" : format(a.damage)}</td>
                          <td>{a.vision ?? "—"}</td>
                          <td>
                            <Items p={a} />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
function ChampionTable({
  matches,
  roles = false,
}: {
  matches: Match[];
  roles?: boolean;
}) {
  const [sort, setSort] = useState("games");
  const rows = aggregate(matches, roles ? "role" : "champion").sort((a, b) =>
    sort === "games"
      ? b.games - a.games
      : sort === "winRate"
        ? b.winRate - a.winRate
        : b.kda - a.kda,
  );
  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <h2>{roles ? "Role performance" : "Champion performance"}</h2>
          <p>Calculated from {matches.length} loaded games</p>
        </div>
        <select
          aria-label="Sort statistics"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="games">Most played</option>
          <option value="winRate">Win rate</option>
          <option value="kda">KDA</option>
        </select>
      </div>
      {!rows.length ? (
        <Empty text="Your statistics will appear after matches load." />
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{roles ? "Role" : "Champion"}</th>
                <th>Games</th>
                <th>W / L</th>
                <th>Win rate</th>
                <th>KDA</th>
                <th>CS/min</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name}>
                  <td>
                    <div className="player-cell">
                      {!roles && <Icon src={r.icon} name={r.name} />}
                      <b>{r.name}</b>
                    </div>
                  </td>
                  <td>{r.games}</td>
                  <td>
                    {r.wins} / {r.games - r.wins}
                  </td>
                  <td className={r.winRate >= 50 ? "mint" : ""}>
                    {r.winRate.toFixed(1)}%
                  </td>
                  <td>{r.kda.toFixed(2)}</td>
                  <td>{r.csMin.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <Crosshair size={25} />
      <p>{text}</p>
    </div>
  );
}
function Trend({
  matches,
  metric,
  title,
  unit,
}: {
  matches: Match[];
  metric: (m: Match) => number | null;
  title: string;
  unit: string;
}) {
  const points = [...matches].reverse().filter((m) => metric(m) !== null);
  const values = points.map((m) => metric(m)!);
  const max = Math.max(1, ...values);
  const avg = values.reduce((s, v) => s + v, 0) / Math.max(1, values.length);
  return (
    <section className="panel trend">
      <div className="section-head">
        <h2>{title}</h2>
        <span className="mint">
          {avg.toFixed(1)} {unit} avg.
        </span>
      </div>
      {!points.length ? (
        <Empty text="Play a few games to see your trend." />
      ) : (
        <>
          <svg
            viewBox="0 0 600 180"
            role="img"
            aria-label={`${title}, oldest to newest. Average ${avg.toFixed(1)}`}
          >
            <line x1="20" y1="155" x2="580" y2="155" stroke="#293544" />
            <line
              x1="20"
              y1="85"
              x2="580"
              y2="85"
              stroke="#293544"
              strokeDasharray="4 6"
            />
            <polyline
              fill="none"
              stroke="#62e8bd"
              strokeWidth="3"
              points={values
                .map(
                  (v, i) =>
                    `${20 + (i * 560) / Math.max(1, values.length - 1)},${155 - (v / max) * 130}`,
                )
                .join(" ")}
            />
            {values.map((v, i) => (
              <circle
                key={points[i].id}
                cx={20 + (i * 560) / Math.max(1, values.length - 1)}
                cy={155 - (v / max) * 130}
                r="4"
                fill={points[i].player.win ? "#62e8bd" : "#ec7f91"}
              >
                <title>
                  {points[i].player.champion}: {v.toFixed(2)} {unit} ·{" "}
                  {new Date(points[i].timestamp).toLocaleDateString()}
                </title>
              </circle>
            ))}
          </svg>
          <div className="chart-axis">
            <span>Oldest match</span>
            <span>Most recent</span>
          </div>
        </>
      )}
    </section>
  );
}
function Focus({ matches }: { matches: Match[] }) {
  const champs = aggregate(matches, "champion").slice(0, 3);
  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <h2>Your champion focus</h2>
          <p>Progress measured against your own games</p>
        </div>
        <Target size={20} />
      </div>
      {!champs.length ? (
        <Empty text="Load matches to find your champion focus." />
      ) : (
        champs.map((c) => {
          const games = matches.filter(
            (m) => m.player.champion === c.name && !m.remake,
          );
          const recent = summary(games.slice(0, 10)),
            previous = summary(games.slice(10, 20));
          const diff = recent.csMin - previous.csMin;
          return (
            <div className="focus" key={c.name}>
              <Icon src={c.icon} name={c.name} />
              <div>
                <h3>{c.name}</h3>
                <p>
                  Last {recent.games} games · {recent.wins}W /{" "}
                  {recent.games - recent.wins}L · {recent.winRate.toFixed(0)}%
                  WR
                </p>
                <p>
                  {recent.kills.toFixed(1)} / {recent.deaths.toFixed(1)} /{" "}
                  {recent.assists.toFixed(1)} · {recent.csMin.toFixed(1)} CS/min
                </p>
                <small>
                  {recent.games === 10 && previous.games === 10
                    ? `Your CS/min is ${diff >= 0 ? "+" : ""}${diff.toFixed(1)} compared with your previous 10 ${c.name} games.`
                    : `${Math.max(0, 20 - games.length)} more ${c.name} games needed for a 10-game comparison. Load older matches to extend your sample.`}
                </small>
              </div>
            </div>
          );
        })
      )}
    </section>
  );
}
function App() {
  const [page, setPage] = useState("Overview");
  const [data, setData] = useState<Dashboard | null>(null);
  const [id, setId] = useState(localStorage.getItem("rift-id") ?? "");
  const [platform, setPlatform] = useState(
    localStorage.getItem("rift-platform") ?? "euw1",
  );
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [platformList, setPlatformList] = useState(["euw1"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retryUntil, setRetryUntil] = useState(0);
  const [clock, setClock] = useState(Date.now());
  const [more, setMore] = useState(false);
  const [offset, setOffset] = useState(20);
  const [filters, setFilters] = useState({
    queue: "All",
    champion: "All",
    role: "All",
    result: "All",
  });
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    fetch("/api/config")
      .then(async (r) => {
        if (!r.ok) throw Error("Backend unavailable");
        return r.json();
      })
      .then((c) => {
        setConfigured(c.configured);
        setPlatformList(c.platforms);
        if (!localStorage.getItem("rift-id")) setId(c.riotId);
        if (!localStorage.getItem("rift-platform")) setPlatform(c.platform);
      })
      .catch(() =>
        setError("The backend is unavailable. Start the app with npm run dev."),
      );
    return () => clearInterval(timer);
  }, []);
  const request = async (
    path: string,
    selectedId = id,
    selectedPlatform = platform,
  ) => {
    const response = await fetch(
      `${path}${path.includes("?") ? "&" : "?"}riotId=${encodeURIComponent(selectedId)}&platform=${encodeURIComponent(selectedPlatform)}`,
    );
    const body = await response.json();
    if (!response.ok) {
      if (body.retryAfter) setRetryUntil(Date.now() + body.retryAfter * 1000);
      throw Error(body.message ?? "Unable to load your account.");
    }
    return body;
  };
  const load = async (refresh = false) => {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const result = await request(
        `/api/dashboard${refresh ? "?refresh=1" : ""}`,
      );
      setData(result);
      setOffset(20);
      setMore(result.hasMore);
      setFilters({ queue: "All", champion: "All", role: "All", result: "All" });
      localStorage.setItem("rift-id", id);
      localStorage.setItem("rift-platform", platform);
      setConfigured(true);
      setPage("Overview");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  const loadOlder = async () => {
    if (!data) return;
    setLoading(true);
    setError("");
    try {
      const result = await request(
        `/api/player/matches?start=${offset}`,
        `${data.profile.gameName}#${data.profile.tagLine}`,
        data.profile.platform,
      );
      setData({
        ...data,
        matches: [
          ...data.matches,
          ...result.matches.filter(
            (m: Match) => !data.matches.some((a) => a.id === m.id),
          ),
        ],
        warnings: [...data.warnings, ...result.warnings],
      });
      setOffset(offset + 20);
      setMore(result.hasMore);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  const recent = data?.matches.slice(0, 20).filter((m) => !m.remake) ?? [];
  const s = summary(recent);
  const all = data?.matches ?? [];
  const filtered = filterMatches(all, filters);
  const top = aggregate(recent, "champion")[0];
  const role = aggregate(recent, "role")[0];
  const notes = insights(all);
  const cooldown = Math.max(0, Math.ceil((retryUntil - clock) / 1000));
  const nav = [
    { name: "Overview", icon: LayoutDashboard },
    { name: "Match history", icon: Swords },
    { name: "Champions", icon: Shield },
    { name: "Performance", icon: BarChart3 },
    { name: "Settings", icon: Settings },
  ];
  return (
    <div className="app">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("Overview");
          }}
        >
          <span className="brand-icon">
            <Crosshair />
          </span>
          {APP_NAME}
          <span className="brand-dot">.</span>
        </a>
        <span className="eyebrow side-label">YOUR PERSONAL EDGE</span>
        <nav>
          {nav.map((n) => (
            <button
              key={n.name}
              className={page === n.name ? "active" : ""}
              onClick={() => setPage(n.name)}
            >
              <n.icon size={19} />
              {n.name}
              {page === n.name && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="private">
            <Shield size={18} />
            <div>
              <b>Made for your climb</b>
              <small>Personal account analytics</small>
            </div>
          </div>
          <div className="connection">
            <span
              className={configured ? "status-dot" : "status-dot offline"}
            />
            {configured ? "Riot key configured" : "Setup required"}
            <small>v1.0</small>
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div className="breadcrumb">
            Your workspace <ChevronRight size={14} />
            <b>{page}</b>
          </div>
          <span className="private-tag">
            <span className="status-dot" /> PRIVATE DASHBOARD
          </span>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <span className="eyebrow mint">
                LEAGUE OF LEGENDS · PERSONAL ANALYTICS
              </span>
              <h1>
                {page === "Overview" ? "Every game. A clearer picture." : page}
              </h1>
              <p>
                {page === "Overview"
                  ? "Know your strengths. Track your progress. Own your climb."
                  : "A closer look at the games that shape your climb."}
              </p>
            </div>
            <div className="season-tag">
              <Activity size={15} /> YOUR RIFT, IN FOCUS
            </div>
          </div>
          {(page === "Settings" || !data) && (
            <section className="connect-panel panel">
              <div className="connect-title">
                <div className="connect-icon">
                  <Crosshair size={28} />
                </div>
                <div>
                  <h2>
                    {data ? "Account settings" : "Your climb starts here"}
                  </h2>
                  <p>
                    Connect your Riot ID to bring your personal dashboard to
                    life.
                  </p>
                </div>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void load();
                }}
              >
                <label>
                  Riot ID
                  <div className="input-wrap">
                    <Search size={17} />
                    <input
                      required
                      value={id}
                      onChange={(e) => setId(e.target.value)}
                      placeholder="Rukyomi#EUW"
                      autoComplete="off"
                    />
                  </div>
                </label>
                <label>
                  Region
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                  >
                    {platformList.map((p) => (
                      <option key={p} value={p}>
                        {p.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="primary"
                  disabled={loading || cooldown > 0}
                  type="submit"
                >
                  {loading ? "Connecting…" : "Connect account"}
                  <ArrowRight size={17} />
                </button>
              </form>
              {configured === false && (
                <div className="setup-note">
                  <Shield size={18} />
                  <p>
                    Add <code>RIOT_API_KEY</code> to <code>RiftScope/.env</code>{" "}
                    and restart the backend. Get your key from the{" "}
                    <a
                      href="https://developer.riotgames.com"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Riot Developer Portal <ExternalLink size={12} />
                    </a>
                    . Your key stays on your machine, server-side.
                  </p>
                </div>
              )}
            </section>
          )}
          {error && (
            <div className="error" role="alert">
              {error}
              {cooldown > 0 && ` You can retry in ${cooldown}s.`}
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                ×
              </button>
            </div>
          )}
          {data &&
            data.warnings.map((w, i) => (
              <div className="warning" key={i}>
                {w}
              </div>
            ))}
          {loading && !data ? (
            <div
              className="skeletons"
              role="status"
              aria-label="Loading player statistics"
            >
              <div />
              <div />
              <div />
              <div />
            </div>
          ) : data && page !== "Settings" ? (
            <>
              <section className="player-header">
                <div className="avatar">
                  <Icon src={data.profile.icon} name="Profile icon" />
                  <span>{data.profile.level}</span>
                </div>
                <div className="identity">
                  <span className="eyebrow">SUMMONER PROFILE</span>
                  <h2>
                    {data.profile.gameName}
                    <span>#{data.profile.tagLine}</span>
                  </h2>
                  <p>
                    <span className="region-badge">
                      {data.profile.platform.toUpperCase()}
                    </span>{" "}
                    Level {data.profile.level}{" "}
                    <span className="separator">/</span> {all.length} matches
                    loaded
                  </p>
                </div>
                <div className="refresh">
                  <small>
                    Last updated{" "}
                    {new Date(data.updatedAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </small>
                  <button
                    className="secondary"
                    disabled={loading || cooldown > 0}
                    onClick={() => void load(true)}
                  >
                    <RefreshCw size={15} className={loading ? "spin" : ""} />
                    {loading
                      ? "Refreshing…"
                      : cooldown
                        ? `Wait ${cooldown}s`
                        : "Refresh data"}
                  </button>
                </div>
              </section>
              {page === "Overview" && (
                <>
                  <div className="overview-grid">
                    <div className="rank-cards">
                      {["RANKED_SOLO_5x5", "RANKED_FLEX_SR"].map((q, i) => {
                        const r = data.ranks.find((r) => r.queue === q);
                        return (
                          <section className="panel rank-card" key={q}>
                            <div className="rank-heading">
                              <span className="eyebrow">
                                {i ? "RANKED FLEX" : "RANKED SOLO / DUO"}
                              </span>
                              <span className="tag">
                                {r ? "Ranked" : "Unranked"}
                              </span>
                            </div>
                            <div className="rank-body">
                              <div
                                className={`rank-emblem ${r?.tier.toLowerCase() ?? ""}`}
                              >
                                <Trophy size={38} />
                              </div>
                              <div>
                                <h2>
                                  {r
                                    ? `${r.tier.toLowerCase()} ${r.division}`
                                    : "Unranked"}
                                </h2>
                                <p>
                                  <b className="mint">
                                    {r ? `${r.lp} LP` : "No current rank"}
                                  </b>
                                  {r && (
                                    <span>
                                      {" "}
                                      · {r.wins}W / {r.losses}L
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                            {r ? (
                              <>
                                <div className="rank-progress">
                                  <span style={{ width: `${r.winRate}%` }} />
                                </div>
                                <div className="rank-foot">
                                  <span>{r.wins + r.losses} games played</span>
                                  <b>{r.winRate.toFixed(1)}% win rate</b>
                                </div>
                              </>
                            ) : (
                              <p className="muted">
                                Ranked data may be unavailable or placements
                                incomplete.
                              </p>
                            )}
                          </section>
                        );
                      })}
                    </div>
                    <section className="panel recent-summary">
                      <div className="section-head">
                        <h2>Recent form</h2>
                        <span className="tag">LAST {s.games} GAMES</span>
                      </div>
                      <div className="summary-row">
                        <div
                          className="win-ring"
                          style={{
                            background: `conic-gradient(#66e4b9 ${s.winRate}%,#263141 0)`,
                          }}
                        >
                          <span>
                            <b>
                              {s.winRate.toFixed(0)}
                              <small>%</small>
                            </b>
                            <small>WIN RATE</small>
                          </span>
                        </div>
                        <div className="form-stats">
                          <strong>
                            {s.kda.toFixed(2)} <small>KDA</small>
                          </strong>
                          <span>
                            {s.kills.toFixed(1)} / {s.deaths.toFixed(1)} /{" "}
                            {s.assists.toFixed(1)}
                          </span>
                          <div className="form-results">
                            {recent
                              .slice(0, 12)
                              .reverse()
                              .map((m) => (
                                <span
                                  title={`${m.player.champion} · ${m.player.win ? "Win" : "Loss"}`}
                                  key={m.id}
                                  className={m.player.win ? "w" : "l"}
                                >
                                  {m.player.win ? "W" : "L"}
                                </span>
                              ))}
                          </div>
                        </div>
                      </div>
                      <div className="mini-stats">
                        <div>
                          <b>{s.csMin.toFixed(1)}</b>
                          <small>CS / MIN</small>
                        </div>
                        <div>
                          <b>{s.vision?.toFixed(1) ?? "—"}</b>
                          <small>AVG. VISION</small>
                        </div>
                        <div>
                          <b>{s.score.toFixed(0)}</b>
                          <small>CUSTOM SCORE</small>
                        </div>
                      </div>
                    </section>
                  </div>
                  <div className="section-title">
                    <h2>Your recent performance</h2>
                    <span>
                      Last {s.games} completed games · remakes excluded
                    </span>
                  </div>
                  <div className="stat-grid">
                    {[
                      {
                        label: "MOST PLAYED",
                        value: top?.name ?? "—",
                        sub: top
                          ? `${top.games} games · ${top.winRate.toFixed(0)}% win rate`
                          : "No recent matches",
                        icon: Shield,
                      },
                      {
                        label: "PRIMARY ROLE",
                        value: role?.name ?? "—",
                        sub: role
                          ? `${role.games} games · ${role.kda.toFixed(2)} KDA`
                          : "No role data",
                        icon: Crosshair,
                      },
                      {
                        label: "AVERAGE DEATHS",
                        value: s.deaths.toFixed(1),
                        sub: `${s.kills.toFixed(1)} kills · ${s.assists.toFixed(1)} assists`,
                        icon: Activity,
                      },
                      {
                        label: "RECENT RECORD",
                        value: `${s.wins}W – ${s.games - s.wins}L`,
                        sub: `Across ${s.games} recent games`,
                        icon: Flame,
                      },
                    ].map((c) => (
                      <section className="panel stat-card" key={c.label}>
                        <div>
                          <span className="eyebrow">{c.label}</span>
                          <c.icon size={17} />
                        </div>
                        <h3>{c.value}</h3>
                        <p>{c.sub}</p>
                      </section>
                    ))}
                  </div>
                </>
              )}
              {(page === "Overview" || page === "Match history") && (
                <div className="history-layout">
                  <section className="history">
                    <div className="section-head">
                      <div>
                        <h2>
                          Match history{" "}
                          <span className="count">{filtered.length}</span>
                        </h2>
                        <p>Your latest games, with the details that matter.</p>
                      </div>
                      <span className="live-label">
                        <span className="status-dot" /> RIOT API
                      </span>
                    </div>
                    <div className="queue-tabs">
                      {["All", "Ranked Solo", "Ranked Flex", "Normal"].map(
                        (q) => (
                          <button
                            className={filters.queue === q ? "selected" : ""}
                            key={q}
                            onClick={() => setFilters({ ...filters, queue: q })}
                          >
                            {q === "All" ? "All matches" : q}
                          </button>
                        ),
                      )}
                    </div>
                    <div className="filters">
                      {(["champion", "role", "result"] as const).map((k) => (
                        <select
                          key={k}
                          aria-label={`Filter by ${k}`}
                          value={filters[k]}
                          onChange={(e) =>
                            setFilters({ ...filters, [k]: e.target.value })
                          }
                        >
                          <option value="All">
                            All{" "}
                            {k === "champion"
                              ? "champions"
                              : k === "role"
                                ? "roles"
                                : "results"}
                          </option>
                          {(k === "champion"
                            ? aggregate(all, "champion").map((c) => c.name)
                            : k === "role"
                              ? [
                                  "Top",
                                  "Jungle",
                                  "Mid",
                                  "ADC",
                                  "Support",
                                  "Other",
                                ]
                              : ["Win", "Loss"]
                          ).map((v) => (
                            <option key={v}>{v}</option>
                          ))}
                        </select>
                      ))}
                      <span>{filtered.length} games</span>
                    </div>
                    <div className="match-list">
                      {filtered.map((m) => (
                        <MatchRow key={m.id} match={m} />
                      ))}
                      {!filtered.length && (
                        <Empty
                          text={
                            all.length
                              ? "No games match these filters."
                              : "No recent matches were returned by Riot."
                          }
                        />
                      )}
                    </div>
                    {more && (
                      <button
                        className="load-more"
                        disabled={loading || cooldown > 0}
                        onClick={() => void loadOlder()}
                      >
                        {loading ? "Loading…" : "Load 20 older matches"}
                        <ChevronDown size={16} />
                      </button>
                    )}
                  </section>
                  {page === "Overview" && (
                    <aside className="right-column">
                      <section className="panel mastery-panel">
                        <div className="section-head">
                          <h2>Champion mastery</h2>
                          <Shield size={18} />
                        </div>
                        {data.mastery.length ? (
                          <>
                            <div
                              className="mastery-hero"
                              style={{
                                backgroundImage: `linear-gradient(0deg,#101925 0%,transparent 100%),url("${data.mastery[0].art}")`,
                              }}
                            >
                              <span className="tag">
                                YOUR SIGNATURE CHAMPION
                              </span>
                              <div>
                                <h3>{data.mastery[0].champion}</h3>
                                <p>
                                  Mastery {data.mastery[0].level}{" "}
                                  <span>
                                    · {format(data.mastery[0].points)} pts
                                  </span>
                                </p>
                              </div>
                            </div>
                            {data.mastery.slice(1, 5).map((m, i) => (
                              <div className="mastery-row" key={m.champion}>
                                <span className="mastery-place">0{i + 2}</span>
                                <Icon src={m.icon} name={m.champion} />
                                <div>
                                  <b>{m.champion}</b>
                                  <small>Mastery {m.level}</small>
                                </div>
                                <strong>
                                  {format(m.points)}
                                  <small>POINTS</small>
                                </strong>
                              </div>
                            ))}
                          </>
                        ) : (
                          <Empty text="No mastery data available." />
                        )}
                      </section>
                      <section className="panel insights-panel">
                        <div className="section-head">
                          <h2>
                            <Zap size={17} /> Personal insights
                          </h2>
                        </div>
                        {notes.length ? (
                          notes.map((n, i) => (
                            <div className="insight" key={i}>
                              <span>0{i + 1}</span>
                              <p>{n}</p>
                            </div>
                          ))
                        ) : (
                          <p className="muted">
                            Insights appear once you have enough completed
                            games. Every insight is calculated from your match
                            data.
                          </p>
                        )}
                        <small className="insight-foot">
                          YOUR DATA. NO GUESSWORK.
                        </small>
                      </section>
                    </aside>
                  )}
                </div>
              )}
              {page === "Champions" && (
                <>
                  <ChampionTable matches={all.filter((m) => !m.remake)} />
                  <Focus matches={all} />
                  <ChampionTable matches={all.filter((m) => !m.remake)} roles />
                  <section className="panel">
                    <div className="section-head">
                      <h2>Mastery collection</h2>
                      <span>Top {data.mastery.length}</span>
                    </div>
                    <div className="mastery-grid">
                      {data.mastery.map((m) => (
                        <div className="mastery-tile" key={m.champion}>
                          <Icon src={m.icon} name={m.champion} />
                          <h3>{m.champion}</h3>
                          <p>
                            Level {m.level} · {format(m.points)} points
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                </>
              )}
              {page === "Performance" && (
                <>
                  <div className="trends-grid">
                    <Trend
                      matches={all}
                      title="KDA over time"
                      metric={(m) => m.player.kda}
                      unit="KDA"
                    />
                    <Trend
                      matches={all}
                      title="Farming consistency"
                      metric={(m) => m.player.csMin}
                      unit="CS/min"
                    />
                    <Trend
                      matches={all}
                      title="Deaths per game"
                      metric={(m) => m.player.deaths}
                      unit="deaths"
                    />
                    <Trend
                      matches={all}
                      title="Vision contribution"
                      metric={(m) => m.player.vision}
                      unit="vision"
                    />
                    <Trend
                      matches={all}
                      title="Personal performance"
                      metric={(m) => m.player.score}
                      unit="score"
                    />
                  </div>
                  <section className="panel">
                    <div className="section-head">
                      <h2>Win / loss timeline</h2>
                      <span>Oldest → newest</span>
                    </div>
                    <div className="timeline">
                      {[...all].reverse().map((m) => (
                        <span
                          key={m.id}
                          className={m.player.win ? "w" : "l"}
                          title={`${m.player.champion}, ${timeAgo(m.timestamp)}`}
                        >
                          {m.remake ? "R" : m.player.win ? "W" : "L"}
                        </span>
                      ))}
                    </div>
                    <p className="muted">
                      Performance score is a custom 0–100 metric combining KDA,
                      participation, farming, damage share, vision, and deaths.
                      It is not an official Riot rating or an MMR estimate.
                      Missing vision is treated as zero in the score.
                    </p>
                  </section>
                  <Focus matches={all} />
                  <ChampionTable matches={all.filter((m) => !m.remake)} roles />
                </>
              )}
            </>
          ) : !loading && page !== "Settings" && !data ? (
            <div className="welcome-grid">
              {[
                {
                  icon: Swords,
                  title: "Every match, unpacked",
                  text: "Full builds, team breakdowns, and the numbers behind your result.",
                },
                {
                  icon: BarChart3,
                  title: "See your progress",
                  text: "Track farming, KDA, vision, and performance across your games.",
                },
                {
                  icon: Target,
                  title: "Focus your climb",
                  text: "Find your strongest champions and compare against your own history.",
                },
              ].map((c) => (
                <section className="panel welcome-card" key={c.title}>
                  <c.icon />
                  <h3>{c.title}</h3>
                  <p>{c.text}</p>
                </section>
              ))}
            </div>
          ) : null}
          <footer>
            <div className="footer-brand">
              <Crosshair size={15} />
              {APP_NAME}
              <span>Built for the next good game.</span>
            </div>
            <p>
              {APP_NAME} isn't endorsed by Riot Games and doesn't reflect the
              views or opinions of Riot Games or anyone officially involved in
              producing or managing Riot Games properties. Riot Games, and all
              associated properties are trademarks or registered trademarks of
              Riot Games, Inc.
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
