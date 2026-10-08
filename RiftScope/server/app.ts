import express from "express";
import { RiotService, ApiError, platforms } from "./riot";
import { staticData, asset } from "./static";
import { normalizeMatch, type RawMatch } from "./normalize";
import type { Profile, Rank, Mastery } from "../src/types";
export function createApp(
  riot = new RiotService(() => process.env.RIOT_API_KEY),
  getStatic = staticData,
) {
  const app = express();
  app.disable("x-powered-by");
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.get("/api/config", (_req, res) =>
    res.json({
      configured:
        !!process.env.RIOT_API_KEY &&
        process.env.RIOT_API_KEY !== "your_key_here",
      riotId: process.env.RIOT_ID ?? "",
      platform: process.env.RIOT_PLATFORM ?? "euw1",
      platforms: Object.keys(platforms),
    }),
  );
  const context = (req: express.Request) => {
    const platform = String(
      req.query.platform ?? process.env.RIOT_PLATFORM ?? "euw1",
    ).toLowerCase();
    const region = platforms[platform];
    if (!region) throw new ApiError(400, "Select a supported platform.");
    const riotId = String(req.query.riotId ?? process.env.RIOT_ID ?? "");
    const split = riotId.lastIndexOf("#");
    const name = riotId.slice(0, split).trim(),
      tag = riotId.slice(split + 1).trim();
    if (split < 1 || !name || !tag || name.length > 32 || tag.length > 16)
      throw new ApiError(400, "Enter your Riot ID as Game Name#Tagline.");
    return { platform, region, name, tag, refresh: req.query.refresh === "1" };
  };
  const account = async (c: ReturnType<typeof context>) =>
    riot.get<{ puuid: string; gameName: string; tagLine: string }>(
      c.region,
      `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(c.name)}/${encodeURIComponent(c.tag)}`,
      300000,
      c.refresh,
    );
  const profile = async (
    c: ReturnType<typeof context>,
    a: Awaited<ReturnType<typeof account>>,
  ): Promise<Profile> => {
    const [p, s] = await Promise.all([
      riot.get<{ summonerLevel: number; profileIconId: number }>(
        c.platform,
        `/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(a.puuid)}`,
        300000,
        c.refresh,
      ),
      getStatic(),
    ]);
    return {
      ...a,
      platform: c.platform,
      level: p.summonerLevel,
      icon: asset(s, "profileicon", `${p.profileIconId}.png`),
    };
  };
  const ranks = async (
    c: ReturnType<typeof context>,
    puuid: string,
  ): Promise<Rank[]> => {
    const data = await riot.get<
      {
        queueType: string;
        tier: string;
        rank: string;
        leaguePoints: number;
        wins: number;
        losses: number;
      }[]
    >(
      c.platform,
      `/lol/league/v4/entries/by-puuid/${encodeURIComponent(puuid)}`,
      120000,
      c.refresh,
    );
    return data.map((r) => ({
      queue: r.queueType,
      tier: r.tier,
      division: r.rank,
      lp: r.leaguePoints,
      wins: r.wins,
      losses: r.losses,
      winRate: r.wins + r.losses ? (r.wins / (r.wins + r.losses)) * 100 : 0,
    }));
  };
  const mastery = async (
    c: ReturnType<typeof context>,
    puuid: string,
  ): Promise<Mastery[]> => {
    const [data, s] = await Promise.all([
      riot.get<
        { championId: number; championLevel: number; championPoints: number }[]
      >(
        c.platform,
        `/lol/champion-mastery/v4/champion-masteries/by-puuid/${encodeURIComponent(puuid)}/top?count=8`,
        300000,
        c.refresh,
      ),
      getStatic(),
    ]);
    return data.map((m) => {
      const champ = s.champions[m.championId];
      return {
        champion: champ?.name ?? `Champion ${m.championId}`,
        icon: champ ? asset(s, "champion", champ.image!.full) : "",
        art: champ
          ? `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${champ.id}_0.jpg`
          : "",
        level: m.championLevel,
        points: m.championPoints,
      };
    });
  };
  const matches = async (
    c: ReturnType<typeof context>,
    puuid: string,
    start = 0,
  ) => {
    const [ids, s] = await Promise.all([
      riot.get<string[]>(
        c.region,
        `/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?start=${start}&count=20`,
        120000,
        c.refresh,
      ),
      getStatic(),
    ]);
    const loaded = [];
    const warnings: string[] = [];
    for (const id of ids) {
      try {
        const raw = await riot.get<RawMatch>(
          c.region,
          `/lol/match/v5/matches/${encodeURIComponent(id)}`,
          86400000 * 7,
        );
        loaded.push(normalizeMatch(raw, puuid, s));
      } catch (e) {
        if (e instanceof ApiError && [429, 401, 403].includes(e.status)) {
          if (!loaded.length) throw e;
          warnings.push(
            `${e.message}${e.retryAfter ? ` Retry after ${e.retryAfter}s.` : ""}`,
          );
          break;
        }
        warnings.push(`Match ${id} could not be loaded.`);
      }
    }
    return { matches: loaded, warnings, hasMore: ids.length === 20 };
  };
  app.get("/api/player", async (req, res) => {
    const c = context(req);
    res.json(await profile(c, await account(c)));
  });
  app.get("/api/player/ranked", async (req, res) => {
    const c = context(req);
    res.json(await ranks(c, (await account(c)).puuid));
  });
  app.get("/api/player/mastery", async (req, res) => {
    const c = context(req);
    res.json(await mastery(c, (await account(c)).puuid));
  });
  app.get("/api/player/matches", async (req, res) => {
    const c = context(req);
    const start = Number(req.query.start ?? 0);
    if (!Number.isInteger(start) || start < 0 || start > 1000)
      throw new ApiError(400, "Invalid match offset.");
    res.json(await matches(c, (await account(c)).puuid, start));
  });
  app.get("/api/dashboard", async (req, res) => {
    const c = context(req);
    const a = await account(c);
    const p = await profile(c, a);
    const warnings: string[] = [];
    let r: Rank[] = [],
      m: Mastery[] = [];
    for (const kind of ["rank", "mastery"] as const) {
      try {
        if (kind === "rank") r = await ranks(c, a.puuid);
        else m = await mastery(c, a.puuid);
      } catch (e) {
        if (e instanceof ApiError && [401, 403, 429].includes(e.status))
          throw e;
        warnings.push(
          `${kind === "rank" ? "Ranked" : "Mastery"} data unavailable. Retry refresh to load it.`,
        );
      }
    }
    const history = await matches(c, a.puuid);
    res.json({
      profile: p,
      ranks: r,
      mastery: m,
      matches: history.matches,
      warnings: [...warnings, ...history.warnings],
      hasMore: history.hasMore,
      updatedAt: Date.now(),
    });
  });
  app.get("/api/matches/:matchId", async (req, res) => {
    const c = context(req);
    const id = req.params.matchId;
    if (
      !/^[A-Z0-9]+_\d+$/.test(id) ||
      id.split("_")[0] !== c.platform.toUpperCase()
    )
      throw new ApiError(400, "Invalid match ID for this platform.");
    const [a, s] = await Promise.all([account(c), getStatic()]);
    res.json(
      normalizeMatch(
        await riot.get<RawMatch>(
          c.region,
          `/lol/match/v5/matches/${id}`,
          86400000 * 7,
        ),
        a.puuid,
        s,
      ),
    );
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({ message: "API endpoint not found." }),
  );
  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const e =
        error instanceof ApiError
          ? error
          : new ApiError(502, "Unable to load League data. Please try again.");
      if (e.retryAfter) res.setHeader("Retry-After", e.retryAfter);
      res
        .status(e.status)
        .json({ message: e.message, retryAfter: e.retryAfter });
    },
  );
  return app;
}
