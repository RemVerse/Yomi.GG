export interface Participant {
  puuid: string;
  name: string;
  champion: string;
  championId: number;
  icon: string;
  level: number;
  role: string;
  teamId: number;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  kda: number;
  cs: number;
  csMin: number;
  vision: number | null;
  damage: number | null;
  gold: number | null;
  kp: number;
  damageShare: number;
  items: { id: number; icon: string; name: string }[];
  spells: { icon: string; name: string }[];
  runes: { icon: string; name: string }[];
  score: number;
}
export interface Match {
  id: string;
  duration: number;
  timestamp: number;
  queue: string;
  queueId: number;
  remake: boolean;
  participants: Participant[];
  teams: {
    id: number;
    win: boolean;
    kills: number;
    gold: number;
    objectives: Record<string, number>;
  }[];
  player: Participant;
}
export interface Rank {
  queue: string;
  tier: string;
  division: string;
  lp: number;
  wins: number;
  losses: number;
  winRate: number;
}
export interface Profile {
  puuid: string;
  gameName: string;
  tagLine: string;
  level: number;
  icon: string;
  platform: string;
}
export interface Mastery {
  champion: string;
  icon: string;
  art: string;
  level: number;
  points: number;
}
export interface Dashboard {
  profile: Profile;
  ranks: Rank[];
  mastery: Mastery[];
  matches: Match[];
  warnings: string[];
  updatedAt: number;
}
