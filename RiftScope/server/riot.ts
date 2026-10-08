export const platforms: Record<string, string> = {
  euw1: "europe",
  eun1: "europe",
  tr1: "europe",
  ru: "europe",
  na1: "americas",
  br1: "americas",
  la1: "americas",
  la2: "americas",
  kr: "asia",
  jp1: "asia",
  oc1: "sea",
  ph2: "sea",
  sg2: "sea",
  th2: "sea",
  tw2: "sea",
  vn2: "sea",
};
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfter?: number,
  ) {
    super(message);
  }
}
export class RiotService {
  private cache = new Map<string, { expires: number; value: unknown }>();
  private pending = new Map<string, Promise<unknown>>();
  private blocked = new Map<string, number>();
  private tail: Promise<unknown> = Promise.resolve();
  private recent: number[] = [];
  private lastRequest = 0;
  constructor(
    private key: () => string | undefined,
    private fetcher: typeof fetch = fetch,
    private now = () => Date.now(),
  ) {}
  async get<T>(
    host: string,
    path: string,
    ttl: number,
    refresh = false,
  ): Promise<T> {
    const url = `https://${host}.api.riotgames.com${path}`;
    const hit = this.cache.get(url);
    if (!refresh && hit && hit.expires > this.now()) return hit.value as T;
    if (this.pending.has(url)) return this.pending.get(url) as Promise<T>;
    if (!this.key() || this.key() === "your_key_here")
      throw new ApiError(
        503,
        "Add your Riot API key to RiftScope/.env, then restart the backend.",
      );
    const task = this.tail
      .catch(() => {})
      .then(async () => {
        const blocked = this.blocked.get(host) ?? 0;
        if (blocked > this.now())
          throw new ApiError(
            429,
            "Riot rate limit reached. Please wait before refreshing.",
            Math.ceil((blocked - this.now()) / 1000),
          );
        this.recent = this.recent.filter((t) => this.now() - t < 120000);
        if (this.recent.length >= 90) {
          const retry = Math.ceil(
            (120000 - (this.now() - this.recent[0])) / 1000,
          );
          throw new ApiError(
            429,
            "Local request budget reached. Please wait before refreshing.",
            retry,
          );
        }
        const delay = Math.max(0, 75 - (this.now() - this.lastRequest));
        if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
        this.lastRequest = this.now();
        this.recent.push(this.now());
        const res = await this.fetcher(url, {
          headers: { "X-Riot-Token": this.key()! },
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) {
          const raw = res.headers.get("retry-after");
          const seconds = raw
            ? Number.isFinite(Number(raw))
              ? Number(raw)
              : Math.ceil((Date.parse(raw) - this.now()) / 1000)
            : 60;
          const retry = Math.max(1, seconds || 60);
          if (res.status === 429)
            this.blocked.set(host, this.now() + retry * 1000);
          throw new ApiError(
            res.status,
            res.status === 404
              ? "Player or match not found. Check your Riot ID and region."
              : res.status === 401 || res.status === 403
                ? "Riot API key is invalid or expired. Update .env and restart."
                : res.status === 429
                  ? "Riot rate limit reached. Please wait before refreshing."
                  : "Riot is temporarily unavailable. Try again shortly.",
            res.status === 429 ? retry : undefined,
          );
        }
        const value = await res.json();
        if (this.cache.size > 2000)
          this.cache.delete(this.cache.keys().next().value!);
        this.cache.set(url, { value, expires: this.now() + ttl });
        return value;
      });
    this.tail = task;
    this.pending.set(url, task);
    try {
      return (await task) as T;
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError(
        502,
        "Could not reach Riot. Please try again shortly.",
      );
    } finally {
      this.pending.delete(url);
    }
  }
}
