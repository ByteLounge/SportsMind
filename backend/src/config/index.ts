import dotenv from 'dotenv';
dotenv.config();

function env(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function envInt(key: string, fallback: number): number {
  const v = process.env[key];
  const n = v ? parseInt(v, 10) : NaN;
  return isNaN(n) ? fallback : n;
}

function envBool(key: string, fallback: boolean): boolean {
  const v = process.env[key];
  if (!v) return fallback;
  return v.toLowerCase() === 'true';
}

export const config = {
  port: envInt('PORT', 3001),
  nodeEnv: env('NODE_ENV', 'development'),
  isDev: env('NODE_ENV', 'development') === 'development',

  fetch: {
    timeoutMs: envInt('FETCH_TIMEOUT_MS', 12000),
    retries: envInt('FETCH_RETRIES', 2),
    retryDelayMs: envInt('FETCH_RETRY_DELAY_MS', 800),
    concurrencyCap: envInt('CONCURRENCY_CAP', 2),
  },

  cache: {
    liveList: envInt('CACHE_TTL_LIVE_LIST', 20),
    matchLive: envInt('CACHE_TTL_MATCH_LIVE', 15),
    scorecard: envInt('CACHE_TTL_SCORECARD', 15),
    commentary: envInt('CACHE_TTL_COMMENTARY', 12),
    squads: envInt('CACHE_TTL_SQUADS', 3600),
    pointsTable: envInt('CACHE_TTL_POINTS_TABLE', 3600),
    highlights: envInt('CACHE_TTL_HIGHLIGHTS', 600),
  },

  playwright: {
    enabled: envBool('USE_PLAYWRIGHT_FALLBACK', false),
  },

  log: {
    level: env('LOG_LEVEL', 'info'),
    selectorMisses: envBool('LOG_SELECTOR_MISSES', false),
  },

  cors: {
    origin: env('CORS_ORIGIN', 'https://sports-mind.vercel.app,http://localhost:5173').split(','),
  },

  parserVersion: env('PARSER_VERSION', '1.0.0'),

  cricbuzz: {
    baseUrl: env('CRICBUZZ_BASE_URL', 'https://www.cricbuzz.com'),
    liveScoresPath: '/cricket-match/live-scores',
    upcomingMatchesPath: '/cricket-match/live-scores/upcoming-matches',
    recentMatchesPath: '/cricket-match/live-scores/recent-matches',
    userAgents: [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    ],
  },
} as const;
