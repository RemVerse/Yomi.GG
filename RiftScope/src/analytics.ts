import type { Match, Participant } from "./types";
export const divide = (n: number, d: number) => (d ? n / d : 0);
// Personal descriptive metric, never a Riot rating or MMR. Role-aware farming/vision targets.
export function performanceScore(
  p: Pick<
    Participant,
    | "kills"
    | "deaths"
    | "assists"
    | "kp"
    | "csMin"
    | "damageShare"
    | "vision"
    | "role"
  >,
  minutes: number,
) {
  const support = p.role === "Support";
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  return Math.round(
    100 *
      (0.25 * clamp((p.kills + p.assists) / Math.max(1, p.deaths) / 5) +
        0.2 * clamp(p.kp / 0.7) +
        0.15 * clamp(p.csMin / (support ? 2 : 8)) +
        0.15 * clamp(p.damageShare / (support ? 0.12 : 0.3)) +
        0.15 *
          clamp((p.vision ?? 0) / Math.max(1, minutes) / (support ? 2 : 1)) +
        0.1 * clamp(1 - p.deaths / 12)),
  );
}
export function summary(matches: Match[]) {
  const ps = matches.map((m) => m.player);
  const avg = (fn: (p: Participant) => number) =>
    divide(
      ps.reduce((s, p) => s + fn(p), 0),
      ps.length,
    );
  return {
    games: ps.length,
    wins: ps.filter((p) => p.win).length,
    winRate: avg((p) => Number(p.win)) * 100,
    kda: divide(
      ps.reduce((s, p) => s + p.kills + p.assists, 0),
      Math.max(
        1,
        ps.reduce((s, p) => s + p.deaths, 0),
      ),
    ),
    kills: avg((p) => p.kills),
    deaths: avg((p) => p.deaths),
    assists: avg((p) => p.assists),
    csMin: avg((p) => p.csMin),
    vision: ps.some((p) => p.vision !== null)
      ? divide(
          ps.reduce((n, p) => n + (p.vision ?? 0), 0),
          ps.filter((p) => p.vision !== null).length,
        )
      : null,
    score: avg((p) => p.score),
  };
}
export function aggregate(matches: Match[], key: "champion" | "role") {
  return [...new Set(matches.map((m) => m.player[key]))]
    .map((name) => ({
      name,
      icon: matches.find((m) => m.player[key] === name)!.player.icon,
      ...summary(matches.filter((m) => m.player[key] === name)),
    }))
    .sort((a, b) => b.games - a.games);
}
export function filterMatches(
  matches: Match[],
  f: { queue: string; champion: string; role: string; result: string },
) {
  return matches.filter(
    (m) =>
      (f.queue === "All" ||
        (f.queue === "Normal"
          ? [400, 430, 490].includes(m.queueId)
          : m.queue === f.queue)) &&
      (f.champion === "All" || m.player.champion === f.champion) &&
      (f.role === "All" || m.player.role === f.role) &&
      (f.result === "All" || m.player.win === (f.result === "Win")),
  );
}
export function insights(matches: Match[]) {
  const eligible = matches.filter((m) => !m.remake);
  if (eligible.length < 5) return [];
  const out: string[] = [];
  const low = eligible.filter((m) => m.player.deaths < 6);
  if (low.length >= 5)
    out.push(
      `You win ${summary(low).winRate.toFixed(0)}% of your ${low.length} games with fewer than 6 deaths.`,
    );
  const wins = eligible.filter((m) => m.player.win),
    losses = eligible.filter((m) => !m.player.win);
  if (wins.length >= 3 && losses.length >= 3) {
    const diff = summary(losses).deaths - summary(wins).deaths;
    out.push(
      `You average ${Math.abs(diff).toFixed(1)} ${diff >= 0 ? "more" : "fewer"} deaths in losses than wins.`,
    );
  }
  const top = aggregate(eligible, "champion")[0];
  if (top?.games >= 5)
    out.push(
      `Your average CS/min on ${top.name} is ${top.csMin.toFixed(1)} across ${top.games} games.`,
    );
  return out;
}
