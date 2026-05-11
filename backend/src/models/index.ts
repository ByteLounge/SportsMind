import { z } from 'zod';

// ─── Primitives ───────────────────────────────────────────────────────────────

export const MatchStateSchema = z.enum(['live', 'upcoming', 'result', 'stumps', 'rain_delay', 'abandoned', 'unknown']);
export const MatchFormatSchema = z.enum(['T20', 'T10', 'ODI', 'Test', 'Other']);
export const PlayerRoleSchema = z.enum(['batter', 'bowler', 'all-rounder', 'wicket-keeper', 'unknown']);

export const TeamScoreSchema = z.object({
  name: z.string(),
  shortName: z.string(),
  score: z.string().nullable(),
  overs: z.string().nullable(),
});

export const MatchLinksSchema = z.object({
  live: z.string().url(),
  scorecard: z.string().url(),
  commentary: z.string().url(),
  squads: z.string().url(),
  highlights: z.string().url(),
});

export const CacheMetaSchema = z.object({
  fromCache: z.boolean(),
  cachedAt: z.string().nullable(),
  cacheAgeMs: z.number().nullable(),
});

// ─── Live match summary ───────────────────────────────────────────────────────

export const LiveMatchSummarySchema = z.object({
  matchId: z.string().min(1),
  slug: z.string().min(1),
  title: z.string(),
  series: z.string(),
  venue: z.string(),
  statusText: z.string(),
  state: MatchStateSchema,
  format: MatchFormatSchema,
  startTimeText: z.string().nullable(),
  teams: z.tuple([TeamScoreSchema, TeamScoreSchema]),
  links: MatchLinksSchema,
});

// ─── Batter / Bowler ──────────────────────────────────────────────────────────

export const BatterEntrySchema = z.object({
  name: z.string(),
  dismissal: z.string().nullable(),
  runs: z.number().nullable(),
  balls: z.number().nullable(),
  fours: z.number().nullable(),
  sixes: z.number().nullable(),
  strikeRate: z.number().nullable(),
});

export const BowlerEntrySchema = z.object({
  name: z.string(),
  overs: z.string().nullable(),
  maidens: z.number().nullable(),
  runs: z.number().nullable(),
  wickets: z.number().nullable(),
  economy: z.number().nullable(),
  wides: z.number().nullable(),
  noBalls: z.number().nullable(),
});

// ─── Standings row ────────────────────────────────────────────────────────────

export const StandingsRowSchema = z.object({
  rank: z.number().int().positive(),
  team: z.string(),
  played: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  ties: z.number().int().nonnegative(),
  noResult: z.number().int().nonnegative(),
  points: z.number().nonnegative(),
  nrr: z.string(),
  form: z.array(z.string()),
});

// ─── Player entry ─────────────────────────────────────────────────────────────

export const PlayerEntrySchema = z.object({
  name: z.string().min(1),
  role: PlayerRoleSchema,
  isCaptain: z.boolean(),
  isWicketKeeper: z.boolean(),
  isOverseas: z.boolean(),
});

// ─── Highlight card ───────────────────────────────────────────────────────────

export const HighlightCardSchema = z.object({
  title: z.string(),
  url: z.string(),
  thumbnail: z.string().nullable(),
  category: z.string().nullable(),
  teamTag: z.string().nullable(),
  durationText: z.string().nullable(),
});

// ─── Validate helpers ─────────────────────────────────────────────────────────

export function validateLiveMatchSummary(data: unknown) {
  return LiveMatchSummarySchema.safeParse(data);
}

export function validateStandingsRow(data: unknown) {
  return StandingsRowSchema.safeParse(data);
}
