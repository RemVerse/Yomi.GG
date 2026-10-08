import { ApiError } from "./riot";
type Entry = {
  id: string;
  key: string;
  name: string;
  image?: { full: string };
  icon?: string;
  slots?: { runes: Entry[] }[];
};
export interface StaticData {
  version: string;
  champions: Record<string, Entry>;
  items: Record<string, Entry>;
  spells: Record<string, Entry>;
  runes: Record<string, Entry>;
}
let cached: StaticData | undefined;
let expires = 0;
let pending: Promise<StaticData> | undefined;
export async function staticData(): Promise<StaticData> {
  if (cached && expires > Date.now()) return cached;
  if (pending) return pending;
  pending = (async () => {
    const get = async (url: string) => {
      const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error("Static data unavailable");
      return r.json();
    };
    const versions = await get(
      "https://ddragon.leagueoflegends.com/api/versions.json",
    );
    const version = versions[0];
    const base = `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US`;
    const [champions, items, spells, runes] = await Promise.all([
      get(`${base}/champion.json`),
      get(`${base}/item.json`),
      get(`${base}/summoner.json`),
      get(`${base}/runesReforged.json`),
    ]);
    const keyed = (data: Record<string, Entry>) =>
      Object.fromEntries(Object.values(data).map((x) => [x.key, x]));
    const flat = (runes as Entry[]).flatMap((r) => [
      r,
      ...(r.slots ?? []).flatMap((s) => s.runes),
    ]);
    cached = {
      version,
      champions: keyed(champions.data),
      items: items.data,
      spells: keyed(spells.data),
      runes: Object.fromEntries(flat.map((r) => [r.id, r])),
    };
    expires = Date.now() + 86400000;
    return cached;
  })();
  try {
    return await pending;
  } catch {
    if (cached) return cached;
    throw new ApiError(
      502,
      "League static assets are unavailable. Try again shortly.",
    );
  } finally {
    pending = undefined;
  }
}
export const asset = (s: StaticData, type: string, file: string) =>
  `https://ddragon.leagueoflegends.com/cdn/${s.version}/img/${type}/${file}`;
