import { config } from '../config';
import { cache } from '../utils/cache';
import { logger } from '../utils/logger';
import { smartFetch, fetchPage, fetchJson } from '../scrapers/cricbuzzFetcher';
import { findJsonValue } from '../utils/rsc';
import { parseLiveScoresPage, filterMatches } from '../parsers/cricbuzzParserLive';
import { parseScorecardPage, parseScorecardApi } from '../parsers/cricbuzzParserScorecard';
import { parseCommentaryPage, parseCommentaryApi } from '../parsers/cricbuzzParserCommentary';
import { parseSquadsPage } from '../parsers/cricbuzzParserSquads';
import { parseSeriesTablePage } from '../parsers/cricbuzzParserSeriesTable';
import { parseSeriesSquadsPage } from '../parsers/cricbuzzParserSeriesSquads';
import { parseHighlightsPage } from '../parsers/cricbuzzParserHighlights';
import { parseMatchLivePage, parseMatchLiveApi } from '../parsers/cricbuzzParserMatchLive';
import {
  LiveMatchSummary, LiveMatchListResponse, LiveMatchDetailResponse,
  ScorecardResponse, CommentaryResponse, SquadsResponse,
  SeriesTableResponse, SeriesSquadsResponse, HighlightsResponse,
  SeriesStatsResponse, SeriesStatType,
  BallMapResponse, PartnershipResponse, WormResponse, OversResponse,
  RunRateResponse, WinProbabilityResponse,
  GraphBallEntry, InningsOverData, OverDataPoint,
  InningsHighlightsResponse, HighlightEntry,
  ParseError, CricbuzzApiLiveScore
} from '../types';

// ─── Section health tracker ───────────────────────────────────────────────────
// ... rest of imports and health tracker ...

interface SectionStats {
  lastSuccess: string | null;
  lastError: string | null;
  totalRequests: number;
  totalErrors: number;
}

const _stats = new Map<string, SectionStats>();

function trackSuccess(section: string): void {
  const s = _stats.get(section) ?? { lastSuccess: null, lastError: null, totalRequests: 0, totalErrors: 0 };
  s.lastSuccess = new Date().toISOString();
  s.totalRequests++;
  _stats.set(section, s);
}

function trackError(section: string): void {
  const s = _stats.get(section) ?? { lastSuccess: null, lastError: null, totalRequests: 0, totalErrors: 0 };
  s.lastError = new Date().toISOString();
  s.totalRequests++;
  s.totalErrors++;
  _stats.set(section, s);
}

export function getSectionStats(): Record<string, SectionStats> {
  return Object.fromEntries(_stats.entries());
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function makeError(code: string, message: string, section: string): ParseError {
  return { code, message, section };
}

function nowIso(): string { return new Date().toISOString(); }

// ─── RSC score extractor — reads Cricbuzz match page RSC payload ──────────────

interface RscInningsScore {
  inningsId: number;
  batTeamName?: string;   // short name e.g. "MI", "RCB"
  score?: number;         // runs
  runs?: number;          // runs (alternative key)
  wickets: number;
  overs: number;
  isDeclared?: boolean;
}

interface RscMatchData {
  inningsScoreList?: RscInningsScore[];
  matchScore?: {
    team1Score?: { inngs1?: RscInningsScore; inngs2?: RscInningsScore };
    team2Score?: { inngs1?: RscInningsScore; inngs2?: RscInningsScore };
  };
  team1?: { name: string; shortName: string; teamSName?: string };
  team2?: { name: string; shortName: string; teamSName?: string };
  seriesName?: string;
  status?: string;
  matchState?: string; // "In Progress", "Preview", "Complete", etc.
}

/** Extract score data embedded in a Cricbuzz match page RSC payload */
function extractRscMatchData(html: string): RscMatchData | null {
  const inningsList = findJsonValue(html, 'inningsScoreList') as RscInningsScore[] | null;
  const matchScore = findJsonValue(html, 'matchScore') as RscMatchData['matchScore'] | null;
  const header = (findJsonValue(html, 'matchHeader') || findJsonValue(html, 'matchInfo')) as Record<string, any> | null;

  if (!inningsList && !matchScore && !header) return null;

  return {
    inningsScoreList: inningsList || undefined,
    matchScore: matchScore || undefined,
    team1: (header?.team1 || header?.batTeam) as RscMatchData['team1'],
    team2: (header?.team2 || header?.bowTeam) as RscMatchData['team2'],
    seriesName: (header?.seriesName ?? header?.seriesDesc ?? header?.series) as string | undefined,
    status: (header?.status as string | undefined) || undefined,
    matchState: (header?.state as string | undefined) || undefined,
  };
}

/** Map Cricbuzz RSC state string → our MatchState enum */
function rscStateToMatchState(rscState: string | undefined): import('../types').MatchState {
  const s = (rscState || '').toLowerCase();
  if (s.includes('progress') || s === 'in progress') return 'live';
  if (s === 'stumps') return 'stumps';
  if (s === 'complete') return 'result';
  if (s === 'preview') return 'upcoming';
  if (s.includes('rain') || s.includes('delay')) return 'rain_delay';
  if (s === 'abandoned') return 'abandoned';
  return 'unknown';
}

/** Apply RSC-extracted data to a LiveMatchSummary */
function applyRscData(match: LiveMatchSummary, data: RscMatchData): LiveMatchSummary {
  const teams: [typeof match.teams[0], typeof match.teams[1]] = [
    { ...match.teams[0] },
    { ...match.teams[1] },
  ];

  const t1Name = data.team1?.name || data.team1?.shortName || data.team1?.teamSName;
  const t2Name = data.team2?.name || data.team2?.shortName || data.team2?.teamSName;

  if (t1Name && (teams[0].name === 'TBD' || teams[0].name === 'Team A')) {
    teams[0] = { ...teams[0], name: data.team1!.name, shortName: data.team1!.shortName || data.team1!.teamSName || teams[0].shortName };
  }
  if (t2Name && (teams[1].name === 'TBD' || teams[1].name === 'Team B')) {
    teams[1] = { ...teams[1], name: data.team2!.name, shortName: data.team2!.shortName || data.team2!.teamSName || teams[1].shortName };
  }

  const fmt = (i: RscInningsScore | undefined) => {
    if (!i) return null;
    const runs = i.runs ?? i.score ?? 0;
    return {
      score: `${runs}-${i.wickets}${i.isDeclared ? 'd' : ''}`,
      overs: i.overs != null ? String(i.overs) : null
    };
  };

  if (data.matchScore) {
    const s1 = fmt(data.matchScore.team1Score?.inngs2 || data.matchScore.team1Score?.inngs1);
    const s2 = fmt(data.matchScore.team2Score?.inngs2 || data.matchScore.team2Score?.inngs1);
    if (s1) { teams[0].score = s1.score; teams[0].overs = s1.overs; }
    if (s2) { teams[1].score = s2.score; teams[1].overs = s2.overs; }
  } else if (data.inningsScoreList) {
    const latestByTeam = new Map<string, RscInningsScore>();
    for (const inn of data.inningsScoreList) {
      const key = inn.batTeamName || String(inn.inningsId % 2);
      const existing = latestByTeam.get(key);
      if (!existing || inn.inningsId > existing.inningsId) latestByTeam.set(key, inn);
    }
    for (const [, inn] of latestByTeam) {
      const s = fmt(inn);
      if (!s) continue;
      const sn = inn.batTeamName;
      const t1Match = sn && (teams[0].shortName === sn || teams[0].name === sn);
      const t2Match = sn && (teams[1].shortName === sn || teams[1].name === sn);
      if (t1Match) { teams[0].score = s.score; teams[0].overs = s.overs; }
      else if (t2Match) { teams[1].score = s.score; teams[1].overs = s.overs; }
      else {
        const idx = inn.inningsId % 2 === 1 ? 0 : 1;
        if (!teams[idx].score) { teams[idx].score = s.score; teams[idx].overs = s.overs; }
      }
    }
  }

  const series = data.seriesName || match.series;
  const statusText = data.status || match.statusText;
  const rscState = rscStateToMatchState(data.matchState);
  const state = (rscState !== 'unknown') ? rscState : match.state;

  return { ...match, teams: teams as [typeof match.teams[0], typeof match.teams[1]], series, statusText, state, latestCommentary: match.latestCommentary };
}

/** Apply API-extracted data to a LiveMatchSummary */
function applyApiData(match: LiveMatchSummary, data: CricbuzzApiLiveScore): LiveMatchSummary {
  const mini = data.miniscore;
  const det = mini.matchScoreDetails;

  const teams: [typeof match.teams[0], typeof match.teams[1]] = [
    { ...match.teams[0] },
    { ...match.teams[1] },
  ];

  for (const inn of det.inningsScoreList) {
    const sn = inn.batTeamName;
    const scoreStr = `${inn.score}-${inn.wickets}${inn.isDeclared ? 'd' : ''}`;
    const oversStr = String(inn.overs);

    const t1Match = teams[0].shortName === sn || teams[0].name === sn;
    const t2Match = teams[1].shortName === sn || teams[1].name === sn;

    if (t1Match) {
      teams[0] = { ...teams[0], score: scoreStr, overs: oversStr };
    } else if (t2Match) {
      teams[1] = { ...teams[1], score: scoreStr, overs: oversStr };
    }
  }

  const statusText = mini.status || det.customStatus || match.statusText;
  const state = (det.state.toLowerCase().includes('progress') || det.state === 'In Progress') ? 'live' as import('../types').MatchState
    : det.state.toLowerCase() === 'complete' ? 'result' as import('../types').MatchState
    : det.state.toLowerCase() === 'stumps' ? 'stumps' as import('../types').MatchState
    : det.state.toLowerCase() === 'preview' ? 'upcoming' as import('../types').MatchState
    : match.state;

  // Latest Commentary
  const latestComm = data.commentaryList && data.commentaryList.length > 0 ? data.commentaryList[0] : null;
  const latestCommentary: import('../types').CommentaryBlock | null = latestComm ? {
    over: String(Math.floor(latestComm.overNumber)),
    ball: String(Math.round((latestComm.overNumber % 1) * 10)),
    event: (latestComm.event || 'other').toLowerCase() as any,
    text: latestComm.commText,
    score: null,
  } : match.latestCommentary;

  return { ...match, teams: teams as [typeof match.teams[0], typeof match.teams[1]], statusText, state, latestCommentary };
}

/** Fetch each live/stumps match JSON and extract real scores */
async function enrichMatchesWithScores(matches: LiveMatchSummary[]): Promise<LiveMatchSummary[]> {
  const statePriority: Record<string, number> = { live: 0, stumps: 1, result: 2, unknown: 3 };
  const enrichable = matches
    .filter(m => (m.state === 'live' || m.state === 'stumps' || m.state === 'result' || m.state === 'unknown'))
    .sort((a, b) => (statePriority[a.state] ?? 9) - (statePriority[b.state] ?? 9))
    .slice(0, 15);

  if (enrichable.length === 0) return matches;

  logger.debug('Enriching matches with combined data sources', { count: enrichable.length });

  const results = await Promise.allSettled(
    enrichable.map(async m => {
      const cacheKey = `enriched_scores_${m.matchId}`;
      const cached = cache.get<{ type: 'api' | 'rsc'; data: any }>(cacheKey);
      if (cached) return { matchId: m.matchId, ...cached.data };

      // 1. Try JSON API first
      try {
        const data = await fetchJson<CricbuzzApiLiveScore>(`/api/mcenter/livescore/${m.matchId}`);
        if (data && data.miniscore) {
          cache.set(cacheKey, { type: 'api', data }, config.cache.matchLive);
          return { matchId: m.matchId, type: 'api', data };
        }
      } catch (e) { /* next */ }

      // 2. Try RSC /mini-scorecard API
      try {
        const { html } = await fetchPage(`/api/cricket-match/${m.matchId}/mini-scorecard`);
        const data = extractRscMatchData(html);
        if (data && (data.matchScore || data.inningsScoreList)) {
          cache.set(cacheKey, { type: 'rsc', data }, config.cache.matchLive);
          return { matchId: m.matchId, type: 'rsc', data };
        }
      } catch (e) { /* next */ }

      return { matchId: m.matchId, type: 'none', data: null };
    })
  );

  const resultMap = new Map<string, { type: 'api' | 'rsc'; data: any }>();
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.data) {
      resultMap.set(r.value.matchId, { type: r.value.type as any, data: r.value.data });
    }
  }

  return matches.map(m => {
    const res = resultMap.get(m.matchId);
    if (!res) return m;
    return res.type === 'api' ? applyApiData(m, res.data) : applyRscData(m, res.data);
  });
}

// ─── Service methods ──────────────────────────────────────────────────────────

async function getMatchesByPath(
  path: string,
  cacheKey: string,
  cacheTTL: number,
  opts: { series?: string; team?: string; status?: string }
): Promise<LiveMatchListResponse> {
  const cached = cache.get<LiveMatchSummary[]>(cacheKey);

  if (cached) {
    const filtered = filterMatches(cached.data, opts);
    return {
      ok: true,
      source: 'cricbuzz_scrape',
      updatedAt: nowIso(),
      parserVersion: config.parserVersion,
      seriesFilter: opts.series ?? null,
      teamFilter: opts.team ?? null,
      statusFilter: opts.status ?? null,
      total: filtered.length,
      matches: filtered,
      _cache: cached.meta,
    };
  }

  try {
    const { $, url } = await smartFetch(path, 'title');
    const rawMatches = parseLiveScoresPage($, url);
    // Try to enrich with scores; if API fails, raw matches (with null scores) are used
    const allMatches = await enrichMatchesWithScores(rawMatches).catch(() => rawMatches);
    cache.set(cacheKey, allMatches, cacheTTL);
    trackSuccess(cacheKey);

    const filtered = filterMatches(allMatches, opts);
    return {
      ok: true,
      source: 'cricbuzz_scrape',
      updatedAt: nowIso(),
      parserVersion: config.parserVersion,
      seriesFilter: opts.series ?? null,
      teamFilter: opts.team ?? null,
      statusFilter: opts.status ?? null,
      total: filtered.length,
      matches: filtered,
      _cache: cache.freshMeta(),
    };
  } catch (err) {
    trackError(cacheKey);
    logger.error(`getMatchesByPath failed for ${path}`, { error: (err as Error).message });
    return {
      ok: false,
      source: 'cricbuzz_scrape',
      updatedAt: nowIso(),
      parserVersion: config.parserVersion,
      seriesFilter: opts.series ?? null,
      teamFilter: opts.team ?? null,
      statusFilter: opts.status ?? null,
      total: 0,
      matches: [],
      _cache: cache.freshMeta(),
    };
  }
}

export async function getLiveMatches(opts: {
  series?: string;
  team?: string;
  status?: string;
}): Promise<LiveMatchListResponse> {
  return getMatchesByPath(config.cricbuzz.liveScoresPath, 'live_list', config.cache.liveList, opts);
}

export async function getUpcomingMatches(opts: {
  series?: string;
  team?: string;
  status?: string;
}): Promise<LiveMatchListResponse> {
  return getMatchesByPath(config.cricbuzz.upcomingMatchesPath, 'upcoming_list', config.cache.liveList, { ...opts, status: opts.status || 'upcoming' });
}

export async function getRecentMatches(opts: {
  series?: string;
  team?: string;
  status?: string;
}): Promise<LiveMatchListResponse> {
  return getMatchesByPath(config.cricbuzz.recentMatchesPath, 'recent_list', config.cache.liveList, { ...opts, status: opts.status || 'recent' });
}

/** Format RSC innings list into a display string like "MI 74-3 (8.5 ov) • RCB 201-4 (20 ov)" */
function buildInningsSummary(innings: RscInningsScore[]): string {
  return innings
    .sort((a, b) => a.inningsId - b.inningsId)
    .map(i => `${i.batTeamName} ${i.score}-${i.wickets}${i.isDeclared ? 'd' : ''} (${i.overs} ov)`)
    .join(' • ');
}

export async function getMatchLive(matchId: string, slug: string): Promise<LiveMatchDetailResponse> {
  const cacheKey = `match_live_${matchId}`;
  const cached = cache.get<import('../types').LiveMatchDetail>(cacheKey);

  if (cached) {
    return { ok: true, source: 'cricbuzz_scrape', updatedAt: nowIso(), parserVersion: config.parserVersion, data: cached.data, error: null, _cache: cached.meta };
  }

  try {
    // 1. Try JSON API first — it's fast and rich
    logger.debug('Fetching match live data from JSON API', { matchId });
    const apiData = await fetchJson<CricbuzzApiLiveScore>(`/api/mcenter/livescore/${matchId}`);
    
    if (apiData && apiData.miniscore) {
      const data = parseMatchLiveApi(apiData, matchId, slug);
      
      // 2. Fetch HTML page in background or if critical fields are missing (like series/venue)
      // For now, let's just use the API data and maybe fallback to HTML if needed.
      // The API data from /api/mcenter/livescore is usually sufficient for "real-time" updates.
      
      // Optionally enrich with HTML for venue/series if they are missing
      if (!data.series || !data.venue) {
        try {
          const { $, html } = await fetchPage(`/live-cricket-scores/${matchId}/${slug}`);
          const htmlData = parseMatchLivePage($, `/live-cricket-scores/${matchId}/${slug}`, matchId);
          data.series = htmlData.series || data.series;
          data.venue = htmlData.venue || data.venue;
          data.tabsAvailable = htmlData.tabsAvailable;
          
          // Also try RSC from HTML as fallback/verification
          const rsc = extractRscMatchData(html);
          if (rsc && rsc.inningsScoreList && rsc.inningsScoreList.length > 0) {
            if (!data.inningsSummary) {
              data.inningsSummary = buildInningsSummary(rsc.inningsScoreList);
            }
            if (rsc.seriesName && !data.series) data.series = rsc.seriesName;
            if (rsc.status && !data.statusText) data.statusText = rsc.status;
          }
        } catch (e) {
          logger.debug('HTML fallback enrichment failed', { matchId, error: (e as Error).message });
        }
      }

      cache.set(cacheKey, data, config.cache.matchLive);
      trackSuccess('match_live');
      return { ok: true, source: 'cricbuzz_api', updatedAt: nowIso(), parserVersion: config.parserVersion, data, error: null, _cache: cache.freshMeta() };
    }

    // 3. Fallback to full HTML scraping if JSON API fails
    const { $, html, url } = await smartFetch(`/live-cricket-scores/${matchId}/${slug}`, '.cb-min-bat-rw, .cb-scr-wll-hdr');
    const data = parseMatchLivePage($, url, matchId);

    const rsc = extractRscMatchData(html);
    if (rsc && rsc.inningsScoreList && rsc.inningsScoreList.length > 0) {
      if (!data.inningsSummary) {
        data.inningsSummary = buildInningsSummary(rsc.inningsScoreList);
      }
      if (rsc.seriesName && !data.series) data.series = rsc.seriesName;
      if (rsc.status && !data.statusText) data.statusText = rsc.status;
      if (data.state === 'unknown' && rsc.matchState) {
        const rs = rscStateToMatchState(rsc.matchState);
        if (rs !== 'unknown') data.state = rs;
      }
    }

    cache.set(cacheKey, data, config.cache.matchLive);
    trackSuccess('match_live');
    return { ok: true, source: 'cricbuzz_scrape', updatedAt: nowIso(), parserVersion: config.parserVersion, data, error: null, _cache: cache.freshMeta() };
  } catch (err) {
    trackError('match_live');
    logger.error('getMatchLive failed', { matchId, error: (err as Error).message });
    return { ok: false, source: 'cricbuzz_scrape', updatedAt: nowIso(), parserVersion: config.parserVersion, data: null, error: makeError('FETCH_FAILED', (err as Error).message, 'match_live'), _cache: cache.freshMeta() };
  }
}

export async function getScorecard(matchId: string, slug: string): Promise<ScorecardResponse> {
  const cacheKey = `scorecard_${matchId}`;
  const cached = cache.get<import('../types').InningsScorecard[]>(cacheKey);

  if (cached) {
    return { ok: true, source: 'cricbuzz_api', updatedAt: nowIso(), parserVersion: config.parserVersion, matchId, title: null, innings: cached.data, error: null, _cache: cached.meta };
  }

  try {
    // 1. Try JSON API first
    logger.debug('Fetching scorecard from JSON API', { matchId });
    const apiData = await fetchJson<import('../types').CricbuzzApiScorecard>(`/api/mcenter/scorecard/${matchId}`);
    if (apiData && apiData.scoreCard) {
      const innings = parseScorecardApi(apiData, matchId);
      
      // Use matchHeader for the title if available
      let title: string | null = null;
      if (apiData.matchHeader) {
        const h = apiData.matchHeader;
        title = `${h.team1.name} vs ${h.team2.name}, ${h.seriesName}`;
      }

      // Fallback to HTML title if needed
      if (!title) {
        try {
          const { $ } = await fetchPage(`/live-cricket-scorecard/${matchId}/${slug}`);
          title = $('h1').first().text().trim() || null;
        } catch (e) { /* ignore */ }
      }

      cache.set(cacheKey, innings, config.cache.scorecard);
      trackSuccess('scorecard');
      return { ok: true, source: 'cricbuzz_api', updatedAt: nowIso(), parserVersion: config.parserVersion, matchId, title, innings, error: null, _cache: cache.freshMeta() };
    }

    // 2. Fallback to HTML
    const path = `/live-cricket-scorecard/${matchId}/${slug}`;
    const { $, url } = await smartFetch(path, '.cb-scrd-hdr-rw, .cb-bat-itm, table');
    const innings = parseScorecardPage($, url, matchId);
    const title = $('h1').first().text().trim() || null;
    cache.set(cacheKey, innings, config.cache.scorecard);
    trackSuccess('scorecard');
    return { ok: true, source: 'cricbuzz_scrape', updatedAt: nowIso(), parserVersion: config.parserVersion, matchId, title, innings, error: null, _cache: cache.freshMeta() };
  } catch (err) {
    trackError('scorecard');
    logger.error('getScorecard failed', { matchId, error: (err as Error).message });
    return { ok: false, source: 'cricbuzz_scrape', updatedAt: nowIso(), parserVersion: config.parserVersion, matchId, title: null, innings: [], error: makeError('FETCH_FAILED', (err as Error).message, 'scorecard'), _cache: cache.freshMeta() };
  }
}

export async function getCommentary(matchId: string, slug: string, forceFull = false): Promise<CommentaryResponse> {
  const cacheKey = `commentary_${matchId}${forceFull ? '_full' : ''}`;
  const cached = cache.get<{ blocks: import('../types').CommentaryBlock[]; overSummaries: import('../types').OverSummary[]; inningsTab: string; previewText: string | null }>(cacheKey);

  if (cached) {
    const { blocks, overSummaries, inningsTab, previewText } = cached.data;
    return { ok: true, source: 'cricbuzz_api', updatedAt: nowIso(), parserVersion: config.parserVersion, matchId, inningsTab, totalBlocks: blocks.length, latest: blocks, overSummaries, previewText, error: null, _cache: cached.meta };
  }

  try {
    // 1. Try JSON API first (unless full requested)
    if (!forceFull) {
      logger.debug('Fetching commentary from JSON API', { matchId });
      const apiData = await fetchJson<import('../types').CricbuzzApiCommentary>(`/api/mcenter/comm/${matchId}`);
      if (apiData && apiData.matchCommentary) {
        const result = parseCommentaryApi(apiData, matchId);
        
        // Optionally enrich with previewText from HTML if missing
        if (!result.previewText) {
          try {
            const { $ } = await fetchPage(`/live-cricket-full-commentary/${matchId}/${slug}`);
            const htmlResult = parseCommentaryPage($, `/live-cricket-full-commentary/${matchId}/${slug}`, matchId);
            result.previewText = htmlResult.previewText;
          } catch (e) { /* ignore */ }
        }

        cache.set(cacheKey, result, config.cache.commentary);
        trackSuccess('commentary');
        return { ok: true, source: 'cricbuzz_api', updatedAt: nowIso(), parserVersion: config.parserVersion, matchId, inningsTab: result.inningsTab, totalBlocks: result.blocks.length, latest: result.blocks, overSummaries: result.overSummaries, previewText: result.previewText, error: null, _cache: cache.freshMeta() };
      }
    }

    // 2. Fallback to HTML
    const path = `/live-cricket-full-commentary/${matchId}/${slug}`;
    const { $, url } = await smartFetch(path, '.cb-com-ln, .cb-commentary-lv');
    const result = parseCommentaryPage($, url, matchId);
    cache.set(cacheKey, result, config.cache.commentary);
    trackSuccess('commentary');
    return { ok: true, source: 'cricbuzz_scrape', updatedAt: nowIso(), parserVersion: config.parserVersion, matchId, inningsTab: result.inningsTab, totalBlocks: result.blocks.length, latest: result.blocks, overSummaries: result.overSummaries, previewText: result.previewText, error: null, _cache: cache.freshMeta() };
  } catch (err) {
    trackError('commentary');
    return { ok: false, source: 'cricbuzz_scrape', updatedAt: nowIso(), parserVersion: config.parserVersion, matchId, inningsTab: '1st Innings', totalBlocks: 0, latest: [], overSummaries: [], previewText: null, error: makeError('FETCH_FAILED', (err as Error).message, 'commentary'), _cache: cache.freshMeta() };
  }
}

export async function getSquads(matchId: string, slug: string): Promise<SquadsResponse> {
  const cacheKey = `squads_${matchId}`;
  const cached = cache.get<import('../types').TeamSquad[]>(cacheKey);

  if (cached) {
    return { ok: true, source: 'cricbuzz_scrape', updatedAt: nowIso(), parserVersion: config.parserVersion, matchId, teams: cached.data, error: null, _cache: cached.meta };
  }

  const path = `/cricket-match-squads/${matchId}/${slug}`;
  try {
    const { $, url } = await smartFetch(path, '.cb-sq-tm, a[href*="/profiles/"]');
    const teams = parseSquadsPage($, url, matchId);
    cache.set(cacheKey, teams, config.cache.squads);
    trackSuccess('squads');
    return { ok: true, source: 'cricbuzz_scrape', updatedAt: nowIso(), parserVersion: config.parserVersion, matchId, teams, error: null, _cache: cache.freshMeta() };
  } catch (err) {
    trackError('squads');
    return { ok: false, source: 'cricbuzz_scrape', updatedAt: nowIso(), parserVersion: config.parserVersion, matchId, teams: [], error: makeError('FETCH_FAILED', (err as Error).message, 'squads'), _cache: cache.freshMeta() };
  }
}

export async function getSeriesTable(seriesId: string, slug: string): Promise<SeriesTableResponse> {
  const cacheKey = `series_table_${seriesId}`;
  const cached = cache.get<{ seriesName: string | null; rows: import('../types').StandingsRow[] }>(cacheKey);

  if (cached) {
    return { ok: true, source: 'cricbuzz_scrape', updatedAt: nowIso(), parserVersion: config.parserVersion, seriesId, seriesName: cached.data.seriesName, rows: cached.data.rows, error: null, _cache: cached.meta };
  }

  const path = `/cricket-series/${seriesId}/${slug}/points-table`;
  try {
    // Using 'title' as checkSelector because Next.js pages have it in static HTML, 
    // and we prefer parsing RSC payload from static HTML over full Playwright render.
    const { $, url } = await smartFetch(path, 'title');
    const result = parseSeriesTablePage($, url, seriesId);
    cache.set(cacheKey, result, config.cache.pointsTable);
    trackSuccess('series_table');
    return { ok: true, source: 'cricbuzz_scrape', updatedAt: nowIso(), parserVersion: config.parserVersion, seriesId, seriesName: result.seriesName, rows: result.rows, error: null, _cache: cache.freshMeta() };
  } catch (err) {
    trackError('series_table');
    return { ok: false, source: 'cricbuzz_scrape', updatedAt: nowIso(), parserVersion: config.parserVersion, seriesId, seriesName: null, rows: [], error: makeError('FETCH_FAILED', (err as Error).message, 'series_table'), _cache: cache.freshMeta() };
  }
}

export async function getSeriesSquads(seriesId: string, slug: string): Promise<SeriesSquadsResponse> {
  const cacheKey = `series_squads_${seriesId}`;
  const cached = cache.get<{ seriesName: string | null; teams: import('../types').SeriesTeamSquad[] }>(cacheKey);

  if (cached) {
    return { ok: true, source: 'cricbuzz_scrape', updatedAt: nowIso(), parserVersion: config.parserVersion, seriesId, seriesName: cached.data.seriesName, teams: cached.data.teams, error: null, _cache: cached.meta };
  }

  const path = `/cricket-series/${seriesId}/${slug}/squads`;
  try {
    const { $, url } = await smartFetch(path, 'a[href*="/profiles/"], .cb-sq-team-wpr');
    const result = parseSeriesSquadsPage($, url, seriesId);
    cache.set(cacheKey, result, config.cache.squads);
    trackSuccess('series_squads');
    return { ok: true, source: 'cricbuzz_scrape', updatedAt: nowIso(), parserVersion: config.parserVersion, seriesId, seriesName: result.seriesName, teams: result.teams, error: null, _cache: cache.freshMeta() };
  } catch (err) {
    trackError('series_squads');
    return { ok: false, source: 'cricbuzz_scrape', updatedAt: nowIso(), parserVersion: config.parserVersion, seriesId, seriesName: null, teams: [], error: makeError('FETCH_FAILED', (err as Error).message, 'series_squads'), _cache: cache.freshMeta() };
  }
}

export async function getSeriesStats(seriesId: string, statType: SeriesStatType): Promise<SeriesStatsResponse> {
  const cacheKey = `series_stats_${seriesId}_${statType}`;
  const cached = cache.get<{ headers: string[]; rows: import('../types').SeriesStatsRow[] }>(cacheKey);

  if (cached) {
    return { ok: true, source: 'cricbuzz_api', updatedAt: nowIso(), parserVersion: config.parserVersion, seriesId, statType, headers: cached.data.headers, rows: cached.data.rows, error: null, _cache: cached.meta };
  }

  try {
    const data = await fetchJson<{ t20StatsList: { headers: string[]; values: { values: string[] }[] } }>(
      `/api/cricket-series/series-stats/${seriesId}/${statType}`
    );

    const raw = data.t20StatsList;
    const headers = raw.headers;
    const rows = raw.values.map(entry => {
      const vals = entry.values;
      const row: import('../types').SeriesStatsRow = { playerId: vals[0] };
      headers.forEach((h, i) => { row[h] = vals[i + 1] ?? ''; });
      return row;
    });

    const payload = { headers, rows };
    cache.set(cacheKey, payload, config.cache.highlights);
    trackSuccess('series_stats');
    return { ok: true, source: 'cricbuzz_api', updatedAt: nowIso(), parserVersion: config.parserVersion, seriesId, statType, headers, rows, error: null, _cache: cache.freshMeta() };
  } catch (err) {
    trackError('series_stats');
    logger.error('getSeriesStats failed', { seriesId, statType, error: (err as Error).message });
    return { ok: false, source: 'cricbuzz_api', updatedAt: nowIso(), parserVersion: config.parserVersion, seriesId, statType, headers: [], rows: [], error: makeError('FETCH_FAILED', (err as Error).message, 'series_stats'), _cache: cache.freshMeta() };
  }
}

// ─── Graph helpers ────────────────────────────────────────────────────────────

function buildOverData(balls: GraphBallEntry[]): OverDataPoint[] {
  const sorted = [...balls].reverse(); // API is newest-first; oldest-first for processing
  const overMap = new Map<number, { runs: number; wickets: number }>();

  for (const ball of sorted) {
    const over = Math.floor(ball.overNum);
    const slot = overMap.get(over) ?? { runs: 0, wickets: 0 };
    slot.runs += ball.totalRuns;
    if (ball.event.includes('WICKET')) slot.wickets++;
    overMap.set(over, slot);
  }

  const points: OverDataPoint[] = [];
  let cumulative = 0;
  for (const [over, { runs, wickets }] of [...overMap.entries()].sort((a, b) => a[0] - b[0])) {
    cumulative += runs;
    const overNumber = over + 1;
    points.push({
      over: overNumber,
      runs,
      wickets,
      runRate: +(runs).toFixed(2),
      cumulative,
    });
  }
  return points;
}

// Fetch raw ball-map from Cricbuzz and cache it — shared by all derived graph endpoints
async function fetchBallMapRaw(matchId: string, inningsId: number): Promise<{
  balls: GraphBallEntry[];
  batters: import('../types').GraphBatterSummary[];
  bowlers: import('../types').GraphBowlerSummary[];
  scoreDetails: import('../types').GraphScoreDetails;
}> {
  const cacheKey = `ball_map_raw_${matchId}_${inningsId}`;
  const cached = cache.get<{
    balls: GraphBallEntry[];
    batters: import('../types').GraphBatterSummary[];
    bowlers: import('../types').GraphBowlerSummary[];
    scoreDetails: import('../types').GraphScoreDetails;
  }>(cacheKey);
  if (cached) return cached.data;

  const data = await fetchJson<{
    balls: GraphBallEntry[];
    batters: import('../types').GraphBatterSummary[];
    bowlers: import('../types').GraphBowlerSummary[];
    scoreDetails: import('../types').GraphScoreDetails;
  }>(`/api/mcenter/balls-map/${matchId}/${inningsId}`);

  cache.set(cacheKey, data, config.cache.matchLive);
  return data;
}

// ─── Graph service methods ─────────────────────────────────────────────────────

export async function getBallMap(matchId: string, inningsId: number): Promise<BallMapResponse> {
  const cacheKey = `ball_map_${matchId}_${inningsId}`;
  const cached = cache.get<Omit<BallMapResponse, 'ok' | 'source' | 'updatedAt' | 'parserVersion' | 'error' | '_cache'>>(cacheKey);
  if (cached) {
    return { ok: true, source: 'cricbuzz_api', updatedAt: nowIso(), parserVersion: config.parserVersion, ...cached.data, error: null, _cache: cached.meta };
  }

  try {
    const data = await fetchBallMapRaw(matchId, inningsId);
    const payload = { matchId, inningsId, ...data };
    cache.set(cacheKey, payload, config.cache.matchLive);
    trackSuccess('ball_map');
    return { ok: true, source: 'cricbuzz_api', updatedAt: nowIso(), parserVersion: config.parserVersion, ...payload, error: null, _cache: cache.freshMeta() };
  } catch (err) {
    trackError('ball_map');
    logger.error('getBallMap failed', { matchId, inningsId, error: (err as Error).message });
    return { ok: false, source: 'cricbuzz_api', updatedAt: nowIso(), parserVersion: config.parserVersion, matchId, inningsId, balls: [], batters: [], bowlers: [], scoreDetails: {} as import('../types').GraphScoreDetails, error: makeError('FETCH_FAILED', (err as Error).message, 'ball_map'), _cache: cache.freshMeta() };
  }
}

export async function getPartnershipGraph(matchId: string): Promise<PartnershipResponse> {
  const cacheKey = `partnership_graph_${matchId}`;
  const cached = cache.get<import('../types').InningsPartnership[]>(cacheKey);
  if (cached) {
    return { ok: true, source: 'cricbuzz_api', updatedAt: nowIso(), parserVersion: config.parserVersion, matchId, innings: cached.data, error: null, _cache: cached.meta };
  }

  try {
    const raw = await fetchJson<{
      inningsID: number;
      batTeamId: number;
      batTeamName: string;
      batTeamShortName: string;
      partnershipDataDTO: {
        bat1Id: number; bat1Name: string; bat1Runs: number; bat1balls: number;
        bat2Id: number; bat2Name: string; bat2Runs: number; bat2balls: number;
        totalRuns: number; totalBalls: number;
      }[];
    }[]>(`/api/mcenter/partnership-graph/${matchId}`);

    const innings: import('../types').InningsPartnership[] = raw.map(inn => ({
      inningsId: inn.inningsID,
      batTeamId: inn.batTeamId,
      batTeamName: inn.batTeamName,
      batTeamShortName: inn.batTeamShortName,
      partnerships: inn.partnershipDataDTO.map(p => ({
        bat1Id: p.bat1Id, bat1Name: p.bat1Name, bat1Runs: p.bat1Runs, bat1Balls: p.bat1balls,
        bat2Id: p.bat2Id, bat2Name: p.bat2Name, bat2Runs: p.bat2Runs, bat2Balls: p.bat2balls,
        totalRuns: p.totalRuns, totalBalls: p.totalBalls,
      })),
    }));

    cache.set(cacheKey, innings, config.cache.matchLive);
    trackSuccess('partnership_graph');
    return { ok: true, source: 'cricbuzz_api', updatedAt: nowIso(), parserVersion: config.parserVersion, matchId, innings, error: null, _cache: cache.freshMeta() };
  } catch (err) {
    trackError('partnership_graph');
    logger.error('getPartnershipGraph failed', { matchId, error: (err as Error).message });
    return { ok: false, source: 'cricbuzz_api', updatedAt: nowIso(), parserVersion: config.parserVersion, matchId, innings: [], error: makeError('FETCH_FAILED', (err as Error).message, 'partnership_graph'), _cache: cache.freshMeta() };
  }
}

async function buildInningsGraphData(matchId: string): Promise<InningsOverData[]> {
  const results: InningsOverData[] = [];
  for (const inningsId of [1, 2]) {
    try {
      const data = await fetchBallMapRaw(matchId, inningsId);
      if (!data.balls || data.balls.length === 0) break;
      const overs = buildOverData(data.balls);
      results.push({
        inningsId,
        batTeamName: null,
        overs,
        totalRuns: data.scoreDetails?.runs ?? overs.reduce((s, o) => s + o.runs, 0),
        totalWickets: data.scoreDetails?.wickets ?? overs.reduce((s, o) => s + o.wickets, 0),
      });
    } catch {
      break; // 2nd innings not started yet — stop gracefully
    }
  }
  return results;
}

export async function getWormGraph(matchId: string): Promise<WormResponse> {
  const cacheKey = `worm_graph_${matchId}`;
  const cached = cache.get<InningsOverData[]>(cacheKey);
  if (cached) {
    return { ok: true, source: 'cricbuzz_api', updatedAt: nowIso(), parserVersion: config.parserVersion, matchId, innings: cached.data, error: null, _cache: cached.meta };
  }
  try {
    const innings = await buildInningsGraphData(matchId);
    cache.set(cacheKey, innings, config.cache.matchLive);
    trackSuccess('worm_graph');
    return { ok: true, source: 'cricbuzz_api', updatedAt: nowIso(), parserVersion: config.parserVersion, matchId, innings, error: null, _cache: cache.freshMeta() };
  } catch (err) {
    trackError('worm_graph');
    return { ok: false, source: 'cricbuzz_api', updatedAt: nowIso(), parserVersion: config.parserVersion, matchId, innings: [], error: makeError('FETCH_FAILED', (err as Error).message, 'worm_graph'), _cache: cache.freshMeta() };
  }
}

export async function getOversGraph(matchId: string): Promise<OversResponse> {
  const cacheKey = `overs_graph_${matchId}`;
  const cached = cache.get<InningsOverData[]>(cacheKey);
  if (cached) {
    return { ok: true, source: 'cricbuzz_api', updatedAt: nowIso(), parserVersion: config.parserVersion, matchId, innings: cached.data, error: null, _cache: cached.meta };
  }
  try {
    const innings = await buildInningsGraphData(matchId);
    cache.set(cacheKey, innings, config.cache.matchLive);
    trackSuccess('overs_graph');
    return { ok: true, source: 'cricbuzz_api', updatedAt: nowIso(), parserVersion: config.parserVersion, matchId, innings, error: null, _cache: cache.freshMeta() };
  } catch (err) {
    trackError('overs_graph');
    return { ok: false, source: 'cricbuzz_api', updatedAt: nowIso(), parserVersion: config.parserVersion, matchId, innings: [], error: makeError('FETCH_FAILED', (err as Error).message, 'overs_graph'), _cache: cache.freshMeta() };
  }
}

export async function getRunRateGraph(matchId: string): Promise<RunRateResponse> {
  const cacheKey = `run_rate_graph_${matchId}`;
  const cached = cache.get<InningsOverData[]>(cacheKey);
  if (cached) {
    return { ok: true, source: 'cricbuzz_api', updatedAt: nowIso(), parserVersion: config.parserVersion, matchId, innings: cached.data, error: null, _cache: cached.meta };
  }
  try {
    const innings = await buildInningsGraphData(matchId);
    cache.set(cacheKey, innings, config.cache.matchLive);
    trackSuccess('run_rate_graph');
    return { ok: true, source: 'cricbuzz_api', updatedAt: nowIso(), parserVersion: config.parserVersion, matchId, innings, error: null, _cache: cache.freshMeta() };
  } catch (err) {
    trackError('run_rate_graph');
    return { ok: false, source: 'cricbuzz_api', updatedAt: nowIso(), parserVersion: config.parserVersion, matchId, innings: [], error: makeError('FETCH_FAILED', (err as Error).message, 'run_rate_graph'), _cache: cache.freshMeta() };
  }
}

export async function getWinProbability(matchId: string): Promise<WinProbabilityResponse> {
  const cacheKey = `win_prob_${matchId}`;
  const cached = cache.get<{ team1Name: string | null; team2Name: string | null; points: import('../types').WinProbabilityPoint[] }>(cacheKey);
  if (cached) {
    return { ok: true, source: 'cricbuzz_api', updatedAt: nowIso(), parserVersion: config.parserVersion, matchId, ...cached.data, error: null, _cache: cached.meta };
  }

  try {
    // Try candidate URLs — Cricbuzz has changed this endpoint name before
    type WinProbRaw = {
      predictionData?: { ballNbr: number; overNum: number; homeWinProb?: number; awayWinProb?: number; team1WinProb?: number; team2WinProb?: number }[];
      data?: { ballNbr: number; overNum: number; homeWinProb?: number; awayWinProb?: number; team1WinProb?: number; team2WinProb?: number }[];
      team1Name?: string; team2Name?: string; homeTeam?: string; awayTeam?: string;
    };
    const WIN_PROB_PATHS = [
      `/api/mcenter/prediction-graph/${matchId}`,
      `/api/mcenter/win-predictor/${matchId}`,
      `/api/mcenter/probability/${matchId}`,
    ];
    let raw: WinProbRaw | null = null;
    for (const path of WIN_PROB_PATHS) {
      try { raw = await fetchJson<WinProbRaw>(path); if (raw) break; } catch { /* next */ }
    }
    if (!raw) throw new Error('win_probability endpoint not found');

    const points: import('../types').WinProbabilityPoint[] = (raw.predictionData ?? raw.data ?? []).map(p => ({
      ballNbr: p.ballNbr,
      overNum: p.overNum,
      team1WinPct: p.team1WinProb ?? p.homeWinProb ?? 50,
      team2WinPct: p.team2WinProb ?? p.awayWinProb ?? 50,
    }));

    const payload = { team1Name: raw.team1Name ?? null, team2Name: raw.team2Name ?? null, points };
    cache.set(cacheKey, payload, config.cache.matchLive);
    trackSuccess('win_probability');
    return { ok: true, source: 'cricbuzz_api', updatedAt: nowIso(), parserVersion: config.parserVersion, matchId, ...payload, error: null, _cache: cache.freshMeta() };
  } catch (err) {
    trackError('win_probability');
    logger.error('getWinProbability failed', { matchId, error: (err as Error).message });
    return { ok: false, source: 'cricbuzz_api', updatedAt: nowIso(), parserVersion: config.parserVersion, matchId, team1Name: null, team2Name: null, points: [], error: makeError('FETCH_FAILED', (err as Error).message, 'win_probability'), _cache: cache.freshMeta() };
  }
}

export async function getInningsHighlights(matchId: string, inningsId: number): Promise<InningsHighlightsResponse> {
  const cacheKey = `innings_highlights_${matchId}_${inningsId}`;
  const cached = cache.get<HighlightEntry[]>(cacheKey);
  if (cached) {
    return { ok: true, source: 'cricbuzz_api', updatedAt: nowIso(), parserVersion: config.parserVersion, matchId, inningsId, total: cached.data.length, highlights: cached.data, error: null, _cache: cached.meta };
  }

  try {
    const raw = await fetchJson<{ commentaryList: {
      commText: string; timestamp: number; ballNbr: number; overNumber: number; inningsId: number;
      event: string; batTeamName: string;
      commentaryFormats: Record<string, { formatId: string[]; formatValue: string[] }>;
      overSeparator?: {
        score: number; wickets: number; inningsId: number; o_summary: string; runs: number; overNum: number;
        batTeamName: string; timestamp: number; event: string;
        batStrikerIds: number[]; batStrikerNames: string[]; batStrikerRuns: number; batStrikerBalls: number;
        batNonStrikerIds: number[]; batNonStrikerNames: string[]; batNonStrikerRuns: number; batNonStrikerBalls: number;
        bowlIds: number[]; bowlNames: string[]; bowlOvers: number; bowlMaidens: number; bowlRuns: number; bowlWickets: number;
      };
      batsmanStriker: { batId: number; batName: string; batBalls: number; batDots: number; batFours: number; batSixes: number; batMins: number; batRuns: number; batStrikeRate: number };
      bowlerStriker: { bowlId: number; bowlName: string; bowlMaidens: number; bowlNoballs: number; bowlOvs: number; bowlRuns: number; bowlWides: number; bowlWkts: number; bowlEcon: number };
      legalRuns: number; totalRuns: number; batTeamScore: number;
    }[] }>(`/api/mcenter/highlights/${matchId}/${inningsId}`);

    const highlights: HighlightEntry[] = (raw.commentaryList ?? []).map(c => ({
      commText: c.commText,
      timestamp: c.timestamp,
      ballNbr: c.ballNbr,
      overNumber: c.overNumber,
      inningsId: c.inningsId,
      events: c.event ? c.event.split(',').map(e => e.trim()) : [],
      batTeamName: c.batTeamName,
      commentaryFormats: c.commentaryFormats ?? {},
      overSeparator: c.overSeparator ? {
        score: c.overSeparator.score, wickets: c.overSeparator.wickets, inningsId: c.overSeparator.inningsId,
        overSummary: c.overSeparator.o_summary, runs: c.overSeparator.runs, overNum: c.overSeparator.overNum,
        batTeamName: c.overSeparator.batTeamName, timestamp: c.overSeparator.timestamp,
        batStrikerIds: c.overSeparator.batStrikerIds, batStrikerNames: c.overSeparator.batStrikerNames,
        batStrikerRuns: c.overSeparator.batStrikerRuns, batStrikerBalls: c.overSeparator.batStrikerBalls,
        batNonStrikerIds: c.overSeparator.batNonStrikerIds, batNonStrikerNames: c.overSeparator.batNonStrikerNames,
        batNonStrikerRuns: c.overSeparator.batNonStrikerRuns, batNonStrikerBalls: c.overSeparator.batNonStrikerBalls,
        bowlIds: c.overSeparator.bowlIds, bowlNames: c.overSeparator.bowlNames,
        bowlOvers: c.overSeparator.bowlOvers, bowlMaidens: c.overSeparator.bowlMaidens,
        bowlRuns: c.overSeparator.bowlRuns, bowlWickets: c.overSeparator.bowlWickets,
      } : null,
      batsmanStriker: c.batsmanStriker,
      bowlerStriker: c.bowlerStriker,
      legalRuns: c.legalRuns,
      totalRuns: c.totalRuns,
      batTeamScore: c.batTeamScore,
    }));

    cache.set(cacheKey, highlights, config.cache.highlights);
    trackSuccess('innings_highlights');
    return { ok: true, source: 'cricbuzz_api', updatedAt: nowIso(), parserVersion: config.parserVersion, matchId, inningsId, total: highlights.length, highlights, error: null, _cache: cache.freshMeta() };
  } catch (err) {
    trackError('innings_highlights');
    logger.error('getInningsHighlights failed', { matchId, inningsId, error: (err as Error).message });
    return { ok: false, source: 'cricbuzz_api', updatedAt: nowIso(), parserVersion: config.parserVersion, matchId, inningsId, total: 0, highlights: [], error: makeError('FETCH_FAILED', (err as Error).message, 'innings_highlights'), _cache: cache.freshMeta() };
  }
}

export async function getHighlights(matchId: string, slug: string): Promise<HighlightsResponse> {
  const cacheKey = `highlights_${matchId}`;
  const cached = cache.get<import('../types').HighlightCard[]>(cacheKey);

  if (cached) {
    return { ok: true, source: 'cricbuzz_scrape', updatedAt: nowIso(), parserVersion: config.parserVersion, matchId, total: cached.data.length, cards: cached.data, note: 'Metadata only — video assets are not proxied or cached.', error: null, _cache: cached.meta };
  }

  const path = `/cricket-match-highlights/${matchId}/${slug}`;
  try {
    const { $, url } = await smartFetch(path, '.cb-hlt-itm, .cb-video-itm');
    const cards = parseHighlightsPage($, url, matchId);
    cache.set(cacheKey, cards, config.cache.highlights);
    trackSuccess('highlights');
    return { ok: true, source: 'cricbuzz_scrape', updatedAt: nowIso(), parserVersion: config.parserVersion, matchId, total: cards.length, cards, note: 'Metadata only — video assets are not proxied or cached.', error: null, _cache: cache.freshMeta() };
  } catch (err) {
    trackError('highlights');
    return { ok: false, source: 'cricbuzz_scrape', updatedAt: nowIso(), parserVersion: config.parserVersion, matchId, total: 0, cards: [], note: 'Metadata only.', error: makeError('FETCH_FAILED', (err as Error).message, 'highlights'), _cache: cache.freshMeta() };
  }
}
