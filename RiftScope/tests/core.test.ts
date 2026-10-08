import test from "node:test";
import assert from "node:assert/strict";
import { RiotService, ApiError, platforms } from "../server/riot";
import { normalizeMatch, type RawMatch } from "../server/normalize";
import {
  aggregate,
  filterMatches,
  summary,
  performanceScore,
  insights,
} from "../src/analytics";
import { createApp } from "../server/app";
import type { StaticData } from "../server/static";
const staticFixture: StaticData = {
  version: "test",
  champions: {
    "39": {
      id: "Irelia",
      key: "39",
      name: "Irelia",
      image: { full: "Irelia.png" },
    },
  },
  items: { "1001": { id: "1001", key: "1001", name: "Boots" } },
  spells: {
    "4": {
      id: "SummonerFlash",
      key: "4",
      name: "Flash",
      image: { full: "SummonerFlash.png" },
    },
  },
  runes: {
    "8005": {
      id: "8005",
      key: "8005",
      name: "Press the Attack",
      icon: "perk-images/Styles/Precision/PressTheAttack/PressTheAttack.png",
    },
  },
};
const raw: RawMatch = {
  metadata: { matchId: "EUW1_123" },
  info: {
    gameDuration: 1800,
    gameCreation: 1700000000000,
    queueId: 420,
    gameMode: "CLASSIC",
    participants: [
      {
        puuid: "me",
        riotIdGameName: "Test",
        riotIdTagline: "EUW",
        championId: 39,
        championName: "Irelia",
        champLevel: 18,
        teamPosition: "MIDDLE",
        teamId: 100,
        win: true,
        kills: 10,
        deaths: 2,
        assists: 8,
        totalMinionsKilled: 210,
        neutralMinionsKilled: 30,
        visionScore: 30,
        totalDamageDealtToChampions: 24000,
        goldEarned: 14000,
        item0: 1001,
        summoner1Id: 4,
        perks: { styles: [{ style: 8000, selections: [{ perk: 8005 }] }] },
      },
      {
        puuid: "ally",
        championId: 39,
        championName: "Irelia",
        champLevel: 16,
        teamId: 100,
        win: true,
        kills: 10,
        deaths: 4,
        assists: 5,
        totalDamageDealtToChampions: 16000,
      },
      {
        puuid: "enemy",
        championId: 39,
        championName: "Irelia",
        champLevel: 16,
        teamPosition: "TOP",
        teamId: 200,
        win: false,
        kills: 6,
        deaths: 10,
        assists: 4,
        totalDamageDealtToChampions: 12000,
      },
    ],
    teams: [
      {
        teamId: 100,
        win: true,
        objectives: { dragon: { kills: 3 }, tower: { kills: 8 } },
      },
      { teamId: 200, win: false },
    ],
  },
};
const match = normalizeMatch(raw, "me", staticFixture);
test("normalization: KDA, farming, participation, damage, items, runes and team totals", () => {
  assert.equal(match.player.kda, 9);
  assert.equal(match.player.cs, 240);
  assert.equal(match.player.csMin, 8);
  assert.equal(match.player.kp, 0.9);
  assert.equal(match.player.damageShare, 0.6);
  assert.equal(match.player.role, "Mid");
  assert.equal(match.player.items[0].name, "Boots");
  assert.equal(match.player.items.length, 7);
  assert.equal(match.player.spells[0].name, "Flash");
  assert.equal(match.player.runes[0].name, "Press the Attack");
  assert.equal(match.teams[0].kills, 20);
  assert.equal(match.teams[0].objectives.dragon, 3);
  assert.equal(match.participants[1].vision, null);
});
test("aggregations, filters, perfect KDA, insufficient insights and score bounds", () => {
  const loss = {
    ...match,
    id: "EUW1_124",
    queue: "Ranked Flex",
    queueId: 440,
    player: { ...match.player, win: false, deaths: 0, role: "Top" },
  };
  assert.equal(summary([match, loss]).winRate, 50);
  assert.equal(summary([match, loss]).kda, 18);
  assert.equal(aggregate([match, loss], "champion")[0].games, 2);
  assert.equal(aggregate([match, loss], "role").length, 2);
  assert.equal(
    filterMatches([match, loss], {
      queue: "Ranked Solo",
      champion: "Irelia",
      role: "Mid",
      result: "Win",
    }).length,
    1,
  );
  assert.equal(
    filterMatches([match, loss], {
      queue: "All",
      champion: "All",
      role: "All",
      result: "Loss",
    }).length,
    1,
  );
  assert.equal(insights([match]).length, 0);
  assert.ok(performanceScore(match.player, 30) <= 100);
  assert.ok(performanceScore(match.player, 30) >= 0);
});
test("cache, request deduplication, refresh and expiry", async () => {
  let calls = 0;
  let now = 1000;
  const riot = new RiotService(
    () => "test",
    async () => {
      calls++;
      return Response.json({ ok: true });
    },
    () => now,
  );
  await Promise.all([
    riot.get("europe", "/test", 1000),
    riot.get("europe", "/test", 1000),
  ]);
  assert.equal(calls, 1);
  await riot.get("europe", "/test", 1000);
  assert.equal(calls, 1);
  await riot.get("europe", "/test", 1000, true);
  assert.equal(calls, 2);
  now += 2000;
  await riot.get("europe", "/test", 1000);
  assert.equal(calls, 3);
});
test("429 Retry-After suppresses upstream requests until cooldown ends", async () => {
  let calls = 0,
    now = 1000;
  const riot = new RiotService(
    () => "test",
    async () => {
      calls++;
      return new Response(null, {
        status: 429,
        headers: { "Retry-After": "12" },
      });
    },
    () => now,
  );
  await assert.rejects(
    riot.get("europe", "/first", 1000),
    (e: ApiError) => e.status === 429 && e.retryAfter === 12,
  );
  await assert.rejects(
    riot.get("europe", "/second", 1000),
    (e: ApiError) => e.retryAfter === 12,
  );
  assert.equal(calls, 1);
  now += 13000;
  await assert.rejects(riot.get("europe", "/second", 1000));
  assert.equal(calls, 2);
});
test("expired keys and missing keys produce safe errors", async () => {
  const missing = new RiotService(() => undefined);
  await assert.rejects(
    missing.get("europe", "/test", 1),
    (e: ApiError) => e.status === 503,
  );
  const expired = new RiotService(
    () => "SECRET",
    async () => new Response("SECRET", { status: 403 }),
  );
  await assert.rejects(
    expired.get("europe", "/test", 1),
    (e: ApiError) => e.status === 403 && !e.message.includes("SECRET"),
  );
});
test("full HTTP account flow, routes, rank arithmetic, match details and immutable refresh", async () => {
  const urls: string[] = [];
  const riot = new RiotService(
    () => "PRIVATE_TEST_TOKEN",
    async (input, init) => {
      const url = String(input);
      urls.push(url);
      assert.equal(
        (init?.headers as Record<string, string>)["X-Riot-Token"],
        "PRIVATE_TEST_TOKEN",
      );
      if (url.includes("by-riot-id"))
        return Response.json({ puuid: "me", gameName: "Test", tagLine: "EUW" });
      if (url.includes("/summoner/"))
        return Response.json({ summonerLevel: 420, profileIconId: 1 });
      if (url.includes("/league/"))
        return Response.json([
          {
            queueType: "RANKED_SOLO_5x5",
            tier: "PLATINUM",
            rank: "IV",
            leaguePoints: 42,
            wins: 48,
            losses: 45,
          },
        ]);
      if (url.includes("/champion-mastery/"))
        return Response.json([
          { championId: 39, championLevel: 12, championPoints: 234567 },
        ]);
      if (url.includes("/ids?")) return Response.json(["EUW1_123"]);
      if (url.includes("/matches/EUW1_123")) return Response.json(raw);
      throw Error(url);
    },
  );
  const app = createApp(riot, async () => staticFixture);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const query = "riotId=Test%23EUW&platform=euw1";
  try {
    const response = await fetch(`${base}/api/dashboard?${query}`);
    assert.equal(response.status, 200);
    const d = await response.json();
    assert.equal(d.profile.puuid, "me");
    assert.equal(d.profile.level, 420);
    assert.equal(d.ranks[0].winRate, (48 / 93) * 100);
    assert.equal(d.mastery[0].champion, "Irelia");
    assert.equal(d.matches.length, 1);
    assert.ok(!JSON.stringify(d).includes("PRIVATE_TEST_TOKEN"));
    assert.ok(
      urls.some(
        (u) =>
          u.startsWith("https://europe.") && u.includes("by-riot-id/Test/EUW"),
      ),
    );
    assert.ok(
      urls.some(
        (u) =>
          u.startsWith("https://euw1.") &&
          u.includes("/league/v4/entries/by-puuid/me"),
      ),
    );
    await fetch(`${base}/api/dashboard?${query}&refresh=1`);
    assert.equal(urls.filter((u) => u.includes("/matches/EUW1_123")).length, 1);
    for (const endpoint of [
      "/api/player",
      "/api/player/ranked",
      "/api/player/mastery",
      "/api/player/matches",
      "/api/matches/EUW1_123",
    ]) {
      assert.equal((await fetch(`${base}${endpoint}?${query}`)).status, 200);
    }
    assert.equal((await fetch(`${base}/api/player?riotId=bad`)).status, 400);
    assert.equal(
      (await fetch(`${base}/api/player?${query}&platform=bad`)).status,
      400,
    );
    assert.equal(
      (await fetch(`${base}/api/matches/NA1_123?${query}`)).status,
      400,
    );
    assert.equal(platforms.euw1, "europe");
  } finally {
    server.close();
  }
});
