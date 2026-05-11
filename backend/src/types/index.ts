// ─── Domain enums ────────────────────────────────────────────────────────────

export type MatchState = 'live' | 'upcoming' | 'result' | 'stumps' | 'rain_delay' | 'abandoned' | 'unknown';
export type MatchFormat = 'T20' | 'T10' | 'ODI' | 'Test' | 'Other';
export type PlayerRole = 'batter' | 'bowler' | 'all-rounder' | 'wicket-keeper' | 'unknown';
export type InningsNumber = 1 | 2 | 3 | 4;

// ─── Shared primitives ────────────────────────────────────────────────────────

export interface TeamScore {
  name: string;
  shortName: string;
  /** e.g. "149-3" or null when yet to bat */
  score: string | null;
  /** e.g. "12.5" or null */
  overs: string | null;
}

export interface MatchLinks {
  live: string;
  scorecard: string;
  commentary: string;
  squads: string;
  highlights: string;
}

export interface CacheMeta {
  cachedAt: string | null;
  cacheAgeMs: number | null;
  fromCache: boolean;
}

// ─── Live match list ──────────────────────────────────────────────────────────

export interface LiveMatchSummary {
  matchId: string;
  slug: string;
  title: string;
  series: string;
  venue: string;
  statusText: string;
  state: MatchState;
  format: MatchFormat;
  startTimeText: string | null;
  teams: [TeamScore, TeamScore];
  latestCommentary: CommentaryBlock | null;
  links: MatchLinks;
}

export interface LiveMatchListResponse {
  ok: boolean;
  source: 'cricbuzz_scrape' | 'cricbuzz_api';
  updatedAt: string;
  parserVersion: string;
  seriesFilter: string | null;
  teamFilter: string | null;
  statusFilter: string | null;
  total: number;
  matches: LiveMatchSummary[];
  _cache: CacheMeta;
}

// ─── Match live detail ────────────────────────────────────────────────────────

export interface BatterEntry {
  name: string;
  dismissal: string | null;
  runs: number | null;
  balls: number | null;
  fours: number | null;
  sixes: number | null;
  strikeRate: number | null;
}

export interface BowlerEntry {
  name: string;
  overs: string | null;
  maidens: number | null;
  runs: number | null;
  wickets: number | null;
  economy: number | null;
  wides: number | null;
  noBalls: number | null;
}

export interface KeyStats {
  partnership: string | null;
  lastWicket: string | null;
  last5Overs: string | null;
}

export interface RecentBall {
  value: string; // "0", "1", "4", "6", "W", "Wd", "Nb"
  isWicket: boolean;
  isBoundary: boolean;
  isExtra: boolean;
}

export interface LiveMatchDetail {
  matchId: string;
  slug: string;
  title: string;
  series: string;
  venue: string;
  toss: string | null;
  statusText: string;
  state: MatchState;
  format: MatchFormat;
  inningsSummary: string | null;
  currentRR: number | null;
  requiredRR: number | null;
  winProbability: { home: number; away: number } | null;
  currentBatters: BatterEntry[];
  currentBowler: BowlerEntry | null;
  keyStats: KeyStats;
  recentBalls: RecentBall[];
  latestCommentary: CommentaryBlock | null;
  tabsAvailable: string[];
  /** Derived fields for frontend widgets */
  derived: DerivedMatchFields;
}

export interface DerivedMatchFields {
  isChase: boolean;
  runsRequired: number | null;
  ballsRemaining: number | null;
  currentRunRate: number | null;
  requiredRunRate: number | null;
  wicketsInHand: number | null;
  lastUpdatedAgeSec: number;
}

export interface LiveMatchDetailResponse {
  ok: boolean;
  source: 'cricbuzz_scrape' | 'cricbuzz_api';
  updatedAt: string;
  parserVersion: string;
  data: LiveMatchDetail | null;
  error: ParseError | null;
  _cache: CacheMeta;
}

// ─── Scorecard ────────────────────────────────────────────────────────────────

export interface FallOfWicket {
  wicket: number;
  score: string;
  over: string;
  batter: string;
}

export interface InningsScorecard {
  inningsNumber: InningsNumber;
  battingTeam: string;
  total: string;
  overs: string;
  extras: string;
  batting: BatterEntry[];
  bowling: BowlerEntry[];
  yetToBat: string[];
  fallOfWickets: FallOfWicket[];
  powerplay: string | null;
  partnerships: string[];
}

export interface ScorecardResponse {
  ok: boolean;
  source: 'cricbuzz_scrape' | 'cricbuzz_api';
  updatedAt: string;
  parserVersion: string;
  matchId: string;
  title: string | null;
  innings: InningsScorecard[];
  error: ParseError | null;
  _cache: CacheMeta;
}


// ─── Commentary ───────────────────────────────────────────────────────────────

export interface CommentaryBlock {
  over: string;
  ball: string;
  event: 'wicket' | 'boundary_4' | 'boundary_6' | 'dot' | 'run' | 'extra' | 'over_end' | 'other';
  text: string;
  score: string | null;
}

export interface OverSummary {
  over: number;
  runs: number;
  wickets: number;
  balls: string[];
  text: string;
}

export interface CommentaryResponse {
  ok: boolean;
  source: 'cricbuzz_scrape' | 'cricbuzz_api';
  updatedAt: string;
  parserVersion: string;
  matchId: string;
  inningsTab: string;
  totalBlocks: number;
  latest: CommentaryBlock[];
  overSummaries: OverSummary[];
  previewText: string | null;
  error: ParseError | null;
  _cache: CacheMeta;
}


// ─── Squads ───────────────────────────────────────────────────────────────────

export interface PlayerEntry {
  name: string;
  role: PlayerRole;
  isCaptain: boolean;
  isWicketKeeper: boolean;
  isOverseas: boolean;
}

export interface TeamSquad {
  name: string;
  shortName: string;
  playingXI: PlayerEntry[];
  bench: PlayerEntry[];
}

export interface SquadsResponse {
  ok: boolean;
  source: 'cricbuzz_scrape' | 'cricbuzz_api';
  updatedAt: string;
  parserVersion: string;
  matchId: string;
  teams: TeamSquad[];
  error: ParseError | null;
  _cache: CacheMeta;
}

// ─── Series points table ──────────────────────────────────────────────────────

export interface StandingsRow {
  rank: number;
  team: string;
  played: number;
  wins: number;
  losses: number;
  ties: number;
  noResult: number;
  points: number;
  nrr: string;
  form: string[];
}

export interface SeriesTableResponse {
  ok: boolean;
  source: 'cricbuzz_scrape' | 'cricbuzz_api';
  updatedAt: string;
  parserVersion: string;
  seriesId: string;
  seriesName: string | null;
  rows: StandingsRow[];
  error: ParseError | null;
  _cache: CacheMeta;
}

// ─── Series squads ────────────────────────────────────────────────────────────

export interface SeriesTeamSquad {
  name: string;
  players: PlayerEntry[];
}

export interface SeriesSquadsResponse {
  ok: boolean;
  source: 'cricbuzz_scrape' | 'cricbuzz_api';
  updatedAt: string;
  parserVersion: string;
  seriesId: string;
  seriesName: string | null;
  teams: SeriesTeamSquad[];
  error: ParseError | null;
  _cache: CacheMeta;
}

// ─── Highlights ───────────────────────────────────────────────────────────────

export interface HighlightCard {
  title: string;
  url: string;
  thumbnail: string | null;
  category: string | null;
  teamTag: string | null;
  durationText: string | null;
}

export interface HighlightsResponse {
  ok: boolean;
  source: 'cricbuzz_scrape' | 'cricbuzz_api';
  updatedAt: string;
  parserVersion: string;
  matchId: string;
  total: number;
  cards: HighlightCard[];
  note: string;
  error: ParseError | null;
  _cache: CacheMeta;
}

// ─── Health ───────────────────────────────────────────────────────────────────

export interface SectionHealth {
  lastSuccess: string | null;
  lastError: string | null;
  totalRequests: number;
  totalErrors: number;
}

export interface HealthResponse {
  ok: boolean;
  uptime: number;
  memoryMB: number;
  cacheStats: {
    keys: number;
    hits: number;
    misses: number;
  };
  sections: Record<string, SectionHealth>;
  providerMode: 'fetch-cheerio' | 'playwright-fallback';
  parserVersion: string;
}

// ─── Error ────────────────────────────────────────────────────────────────────

export interface ParseError {
  code: string;
  message: string;
  section: string;
}

// ─── Internal Cricbuzz API Types ──────────────────────────────────────────────

export interface CricbuzzApiLiveScore {
  commentaryList: {
    commText: string;
    timestamp: number;
    ballNbr: number;
    overNumber: number;
    inningsId: number;
    event: string;
    batTeamName: string;
  }[];
  miniscore: {
    inningsId: number;
    batsmanStriker?: CricbuzzApiBatter;
    batsmanNonStriker?: CricbuzzApiBatter;
    batTeam: {
      teamId: number;
      teamScore: number;
      teamWkts: number;
    };
    bowlerStriker?: CricbuzzApiBowler;
    bowlerNonStriker?: CricbuzzApiBowler;
    overs: number;
    recentOvsStats: string;
    partnerShip: {
      balls: number;
      runs: number;
    };
    currentRunRate: number;
    requiredRunRate: number;
    lastWicket: string;
    matchScoreDetails: {
      matchId: number;
      inningsScoreList: {
        inningsId: number;
        batTeamId: number;
        batTeamName: string;
        score: number;
        wickets: number;
        overs: number;
        isDeclared: boolean;
        isFollowOn: boolean;
        ballNbr: number;
      }[];
      tossResults?: {
        tossWinnerId: number;
        tossWinnerName: string;
        decision: string;
      };
      matchTeamInfo: {
        battingTeamId: number;
        battingTeamShortName: string;
        bowlingTeamId: number;
        bowlingTeamShortName: string;
      }[];
      isMatchNotCovered: boolean;
      matchFormat: string;
      state: string;
      customStatus: string;
      highlightedTeamId: number;
    };
    latestPerformance: {
      runs: number;
      wkts: number;
      label: string;
    }[];
    ppData: Record<string, {
      ppId: number;
      ppOversFrom: number;
      ppOversTo: number;
      ppType: string;
      runsScored: number;
    }>;
    status: string;
    lastWicketScore: number;
    remRunsToWin: number;
    responseLastUpdated: number;
    event: string;
    timestamp: number;
  };
}

export interface CricbuzzApiCommentary {
  matchCommentary: Record<string, {
    matchId?: number;
    commType: string;
    commText?: string;
    timestamp: number;
    inningsId: number;
    overNumber?: number;
    overSeparator?: {
      overNum: number;
      runs: number;
      wickets: number;
      batTeamName: string;
      score: number;
      wicketsFallen: number;
      recentOvsStats: string;
    } | null;
    event?: string[];
    teamName?: string;
    headline?: string;
  }>;
}

export interface CricbuzzApiScorecard {
  scoreCard: {
    matchId: number;
    inningsId: number;
    batTeamDetails: {
      batTeamId: number;
      batTeamName: string;
      batTeamShortName: string;
      batsmenData: Record<string, {
        batId: number;
        batName: string;
        runs: number;
        balls: number;
        dots: number;
        fours: number;
        sixes: number;
        strikeRate: number;
        outDesc: string;
        bowlerId: number;
      }>;
    };
    bowlTeamDetails: {
      bowlTeamId: number;
      bowlTeamName: string;
      bowlTeamShortName: string;
      bowlersData: Record<string, {
        bowlId: number;
        bowlName: string;
        overs: number;
        maidens: number;
        runs: number;
        wickets: number;
        economy: number;
        wides: number;
        noBalls: number;
      }>;
    };
    scoreDetails: {
      runs: number;
      wickets: number;
      overs: number;
      isDeclared: boolean;
    };
    extrasData: {
      total: number;
      wides: number;
      noBalls: number;
      byes: number;
      legByes: number;
      penalty: number;
    };
    wicketsData: Record<string, {
      batId: number;
      batName: string;
      wktNbr: number;
      wktOver: number;
      wktRuns: number;
    }>;
    partnershipsData: Record<string, {
      bat1Id: number;
      bat1Name: string;
      bat1Runs: number;
      bat1Balls: number;
      bat2Id: number;
      bat2Name: string;
      bat2Runs: number;
      bat2Balls: number;
      totalRuns: number;
      totalBalls: number;
    }>;
  }[];
  matchHeader?: {
    seriesName: string;
    team1: { name: string; shortName: string };
    team2: { name: string; shortName: string };
    venue: { name: string; city: string };
    status: string;
  };
}

export interface CricbuzzApiBatter {
  batBalls: number;
  batDots: number;
  batFours: number;
  batId: number;
  batName: string;
  batMins: number;
  batRuns: number;
  batSixes: number;
  batStrikeRate: number;
}

export interface CricbuzzApiBowler {
  bowlId: number;
  bowlName: string;
  bowlMaidens: number;
  bowlNoballs: number;
  bowlOvs: number;
  bowlRuns: number;
  bowlWides: number;
  bowlWkts: number;
  bowlEcon: number;
}

// ─── Compact widget shape ─────────────────────────────────────────────────────

export interface MatchWidget {
  matchId: string;
  title: string;
  statusText: string;
  state: MatchState;
  team1: { name: string; shortName: string; score: string | null; overs: string | null };
  team2: { name: string; shortName: string; score: string | null; overs: string | null };
  derived: DerivedMatchFields;
  links: MatchLinks;
}

// ─── Series stats ─────────────────────────────────────────────────────────────

export const BATTING_STAT_TYPES = [
  'mostRuns', 'highestScore', 'highestAvg', 'highestSr',
  'mostHundreds', 'mostFifties', 'mostFours', 'mostSixes', 'mostNineties',
] as const;

export const BOWLING_STAT_TYPES = [
  'mostWickets', 'lowestAvg', 'bestBowlingInnings', 'mostFiveWickets',
  'lowestEcon', 'lowestSr',
] as const;

export type BattingStatType = typeof BATTING_STAT_TYPES[number];
export type BowlingStatType = typeof BOWLING_STAT_TYPES[number];
export type SeriesStatType = BattingStatType | BowlingStatType;

export interface SeriesStatsRow {
  playerId: string;
  [key: string]: string;
}

export interface SeriesStatsResponse {
  ok: boolean;
  source: 'cricbuzz_api';
  updatedAt: string;
  parserVersion: string;
  seriesId: string;
  statType: SeriesStatType;
  headers: string[];
  rows: SeriesStatsRow[];
  error: ParseError | null;
  _cache: CacheMeta;
}

// ─── Graphs ───────────────────────────────────────────────────────────────────

export interface GraphBallEntry {
  timestamp: number;
  ballNbr: number;
  overNum: number;
  inningsId: number;
  event: string;
  totalRuns: number;
  batsmanStrikerId: number;
  bowlerStrikerId: number;
  ballLabel: string;
}

export interface GraphBatterSummary {
  batId: number;
  batName: string;
  runs: number;
  balls: number;
  dots: number;
  fours: number;
  sixes: number;
  strikeRate: number;
}

export interface GraphBowlerSummary {
  bowlerId: number;
  bowlName: string;
  overs: number;
  maidens: number;
  runs: number;
  wickets: number;
  economy: number;
  no_balls: number;
  wides: number;
}

export interface GraphScoreDetails {
  ballNbr: number;
  overs: number;
  revisedOvers: number;
  runRate: number;
  runs: number;
  wickets: number;
  runsPerBall: number;
  isDeclared: boolean;
  isFollowOn: boolean;
}

export interface BallMapResponse {
  ok: boolean;
  source: 'cricbuzz_api';
  updatedAt: string;
  parserVersion: string;
  matchId: string;
  inningsId: number;
  balls: GraphBallEntry[];
  batters: GraphBatterSummary[];
  bowlers: GraphBowlerSummary[];
  scoreDetails: GraphScoreDetails;
  error: ParseError | null;
  _cache: CacheMeta;
}

export interface PartnershipEntry {
  bat1Id: number;
  bat1Name: string;
  bat1Runs: number;
  bat1Balls: number;
  bat2Id: number;
  bat2Name: string;
  bat2Runs: number;
  bat2Balls: number;
  totalRuns: number;
  totalBalls: number;
}

export interface InningsPartnership {
  inningsId: number;
  batTeamId: number;
  batTeamName: string;
  batTeamShortName: string;
  partnerships: PartnershipEntry[];
}

export interface PartnershipResponse {
  ok: boolean;
  source: 'cricbuzz_api';
  updatedAt: string;
  parserVersion: string;
  matchId: string;
  innings: InningsPartnership[];
  error: ParseError | null;
  _cache: CacheMeta;
}

export interface OverDataPoint {
  over: number;
  runs: number;
  wickets: number;
  runRate: number;
  cumulative: number;
}

export interface InningsOverData {
  inningsId: number;
  batTeamName: string | null;
  overs: OverDataPoint[];
  totalRuns: number;
  totalWickets: number;
}

export interface WormResponse {
  ok: boolean;
  source: 'cricbuzz_api';
  updatedAt: string;
  parserVersion: string;
  matchId: string;
  innings: InningsOverData[];
  error: ParseError | null;
  _cache: CacheMeta;
}

export interface OversResponse {
  ok: boolean;
  source: 'cricbuzz_api';
  updatedAt: string;
  parserVersion: string;
  matchId: string;
  innings: InningsOverData[];
  error: ParseError | null;
  _cache: CacheMeta;
}

export interface RunRateResponse {
  ok: boolean;
  source: 'cricbuzz_api';
  updatedAt: string;
  parserVersion: string;
  matchId: string;
  innings: InningsOverData[];
  error: ParseError | null;
  _cache: CacheMeta;
}

export interface WinProbabilityPoint {
  ballNbr: number;
  overNum: number;
  team1WinPct: number;
  team2WinPct: number;
}

export interface WinProbabilityResponse {
  ok: boolean;
  source: 'cricbuzz_api';
  updatedAt: string;
  parserVersion: string;
  matchId: string;
  team1Name: string | null;
  team2Name: string | null;
  points: WinProbabilityPoint[];
  error: ParseError | null;
  _cache: CacheMeta;
}

// ─── Innings highlights ───────────────────────────────────────────────────────

export interface HighlightBatsman {
  batId: number; batName: string; batBalls: number; batDots: number;
  batFours: number; batSixes: number; batMins: number; batRuns: number; batStrikeRate: number;
}

export interface HighlightBowler {
  bowlId: number; bowlName: string; bowlMaidens: number; bowlNoballs: number;
  bowlOvs: number; bowlRuns: number; bowlWides: number; bowlWkts: number; bowlEcon: number;
}

export interface HighlightOverSeparator {
  score: number; wickets: number; inningsId: number; overSummary: string;
  runs: number; overNum: number; batTeamName: string; timestamp: number;
  batStrikerIds: number[]; batStrikerNames: string[]; batStrikerRuns: number; batStrikerBalls: number;
  batNonStrikerIds: number[]; batNonStrikerNames: string[]; batNonStrikerRuns: number; batNonStrikerBalls: number;
  bowlIds: number[]; bowlNames: string[]; bowlOvers: number; bowlMaidens: number; bowlRuns: number; bowlWickets: number;
}

export interface HighlightEntry {
  commText: string; timestamp: number; ballNbr: number; overNumber: number;
  inningsId: number; events: string[]; batTeamName: string;
  commentaryFormats: Record<string, { formatId: string[]; formatValue: string[] }>;
  overSeparator: HighlightOverSeparator | null;
  batsmanStriker: HighlightBatsman; bowlerStriker: HighlightBowler;
  legalRuns: number; totalRuns: number; batTeamScore: number;
}

export interface InningsHighlightsResponse {
  ok: boolean; source: 'cricbuzz_api'; updatedAt: string; parserVersion: string;
  matchId: string; inningsId: number; total: number; highlights: HighlightEntry[];
  error: ParseError | null; _cache: CacheMeta;
}

// ─── Delta helper ─────────────────────────────────────────────────────────────

export interface MatchDelta {
  matchId: string;
  timestamp: string;
  hasChanged: boolean;
  changes: {
    field: string;
    prev: unknown;
    curr: unknown;
  }[];
  runsAddedSinceLast: number | null;
  wicketsFallenSinceLast: number | null;
  newBalls: RecentBall[];
}
