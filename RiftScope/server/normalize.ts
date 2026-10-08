import type { Match, Participant } from "../src/types";
import { performanceScore } from "../src/analytics";
import { asset, type StaticData } from "./static";
// Riot fields are optional across game modes; missing non-core metrics stay null.
export interface RawParticipant {
  puuid: string;
  riotIdGameName?: string;
  riotIdTagline?: string;
  summonerName?: string;
  championId: number;
  championName: string;
  champLevel: number;
  teamPosition?: string;
  individualPosition?: string;
  teamId: number;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  totalMinionsKilled?: number;
  neutralMinionsKilled?: number;
  visionScore?: number;
  totalDamageDealtToChampions?: number;
  goldEarned?: number;
  item0?: number;
  item1?: number;
  item2?: number;
  item3?: number;
  item4?: number;
  item5?: number;
  item6?: number;
  summoner1Id?: number;
  summoner2Id?: number;
  perks?: { styles?: { style: number; selections?: { perk: number }[] }[] };
  gameEndedInEarlySurrender?: boolean;
}
export interface RawMatch {
  metadata: { matchId: string };
  info: {
    gameDuration: number;
    gameCreation: number;
    gameEndTimestamp?: number;
    gameVersion?: string;
    queueId: number;
    gameMode: string;
    participants: RawParticipant[];
    teams: {
      teamId: number;
      win: boolean;
      objectives?: Record<string, { kills: number }>;
    }[];
  };
}
const roles: Record<string, string> = {
  TOP: "Top",
  JUNGLE: "Jungle",
  MIDDLE: "Mid",
  BOTTOM: "ADC",
  UTILITY: "Support",
};
const queues: Record<number, string> = {
  420: "Ranked Solo",
  440: "Ranked Flex",
  400: "Normal",
  430: "Normal",
  490: "Normal",
  450: "ARAM",
  1700: "Arena",
  900: "URF",
};
export function normalizeMatch(
  raw: RawMatch,
  puuid: string,
  s: StaticData,
): Match {
  const info = raw.info;
  const duration =
    info.gameVersion && Number(info.gameVersion.split(".")[0]) < 11
      ? info.gameDuration / 1000
      : info.gameDuration;
  const minutes = duration / 60;
  const participants: Participant[] = info.participants.map((p) => {
    const allies = info.participants.filter((a) => a.teamId === p.teamId);
    const kills = allies.reduce((n, a) => n + a.kills, 0);
    const teamDamage = allies.reduce(
      (n, a) => n + (a.totalDamageDealtToChampions ?? 0),
      0,
    );
    const champ = s.champions[p.championId];
    const cs = (p.totalMinionsKilled ?? 0) + (p.neutralMinionsKilled ?? 0);
    const runeIds = (p.perks?.styles ?? [])
      .flatMap((style, i) =>
        i === 0 ? [style.selections?.[0]?.perk] : [style.style],
      )
      .filter((x): x is number => !!x);
    const result: Participant = {
      puuid: p.puuid,
      name: p.riotIdGameName
        ? `${p.riotIdGameName}${p.riotIdTagline ? "#" + p.riotIdTagline : ""}`
        : (p.summonerName ?? "Anonymous"),
      champion: champ?.name ?? p.championName,
      championId: p.championId,
      icon: champ ? asset(s, "champion", champ.image!.full) : "",
      level: p.champLevel,
      role: roles[p.teamPosition ?? p.individualPosition ?? ""] ?? "Other",
      teamId: p.teamId,
      win: p.win,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      kda: (p.kills + p.assists) / Math.max(1, p.deaths),
      cs,
      csMin: minutes ? cs / minutes : 0,
      vision: p.visionScore ?? null,
      damage: p.totalDamageDealtToChampions ?? null,
      gold: p.goldEarned ?? null,
      kp: kills ? (p.kills + p.assists) / kills : 0,
      damageShare: teamDamage
        ? (p.totalDamageDealtToChampions ?? 0) / teamDamage
        : 0,
      items: Array.from({ length: 7 }, (_, i) => {
        const id = (p[`item${i}` as keyof RawParticipant] as number) || 0;
        return {
          id,
          icon: id ? asset(s, "item", `${id}.png`) : "",
          name: s.items[id]?.name ?? (id ? `Item ${id}` : "Empty slot"),
        };
      }),
      spells: [p.summoner1Id, p.summoner2Id].flatMap((id) => {
        const spell = s.spells[id ?? 0];
        return spell
          ? [{ icon: asset(s, "spell", spell.image!.full), name: spell.name }]
          : [];
      }),
      runes: runeIds.flatMap((id) => {
        const r = s.runes[id];
        return r
          ? [
              {
                icon: `https://ddragon.leagueoflegends.com/cdn/img/${r.icon}`,
                name: r.name,
              },
            ]
          : [];
      }),
      score: 0,
    };
    result.score = performanceScore(result, minutes);
    return result;
  });
  const player = participants.find((p) => p.puuid === puuid);
  if (!player) throw new Error("Player not present in match");
  return {
    id: raw.metadata.matchId,
    duration,
    timestamp: info.gameEndTimestamp ?? info.gameCreation + duration * 1000,
    queue: queues[info.queueId] ?? info.gameMode,
    queueId: info.queueId,
    remake: duration < 300,
    participants,
    player,
    teams: info.teams.map((t) => ({
      id: t.teamId,
      win: t.win,
      kills: participants
        .filter((p) => p.teamId === t.teamId)
        .reduce((n, p) => n + p.kills, 0),
      gold: participants
        .filter((p) => p.teamId === t.teamId)
        .reduce((n, p) => n + (p.gold ?? 0), 0),
      objectives: Object.fromEntries(
        Object.entries(t.objectives ?? {})
          .filter(([k]) => k !== "champion")
          .map(([k, v]) => [k, v.kills]),
      ),
    })),
  };
}
