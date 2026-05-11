import * as cheerio from 'cheerio';
import {
  LiveMatchDetail, BatterEntry, RecentBall, DerivedMatchFields, KeyStats,
  CricbuzzApiLiveScore, MatchState, MatchFormat
} from '../types';
import { cleanText, safeFloat, safeInt, inferState, inferFormat, parseMatchUrl } from '../utils/normalizer';
import { logSelectorMiss } from '../utils/logger';

// ─── Selectors ────────────────────────────────────────────────────────────────

const SCORE_HEADER_SELECTORS = ['.cb-scr-wll-hdr', '.cb-min-hdr', '.cb-scr-hdr'];
const STATUS_SELECTORS = ['.cb-text-live', '.cb-text-complete', '.cb-text-stumps', '.cb-text-status', '.cb-status'];
const BATTER_ROW_SELECTORS = ['.cb-min-bat-rw', '.cb-bat-rw-live', '.cb-bat-itm-rw'];
const BOWLER_ROW_SELECTORS = ['.cb-min-bowl-rw', '.cb-bowl-rw-live', '.cb-bowl-itm-rw'];
const RECENT_BALL_SELECTORS = ['.cb-col.cb-col-8.cb-ball-txt-srk', '.cb-ball-txt-srk', 'span[class*="ball-txt"]'];
const KEY_STATS_SELECTORS = ['.cb-min-stats-rw', '.cb-min-key-stats', '.cb-live-key-stats'];
const TITLE_SELECTORS = ['h1.cb-nav-hdr', 'h1', '.cb-lv-scrs-well h1'];
const VENUE_SELECTORS = ['.cb-lv-scrs-venue', '.cb-venue', '.cb-font-12.text-gray'];
const TOSS_SELECTORS = ['.cb-toss-sts', '.cb-toss', 'span:contains("Toss")'];
const TABS_SELECTORS = ['a.cb-nav-tab', '.cb-scrd-lnk', 'a[class*="tab"]'];

// ─── JSON Parser ──────────────────────────────────────────────────────────────

export function parseMatchLiveApi(
  json: CricbuzzApiLiveScore,
  matchId: string,
  slug: string
): LiveMatchDetail {
  const mini = json.miniscore;
  const det = mini.matchScoreDetails;

  // Title & Teams
  const t1 = det.matchTeamInfo[0]?.battingTeamShortName || '';
  const t2 = det.matchTeamInfo[0]?.bowlingTeamShortName || '';
  const title = `${t1} vs ${t2}`;

  // State & Status
  const statusText = mini.status || det.customStatus;
  const state = (det.state.toLowerCase().includes('progress') || det.state === 'In Progress') ? 'live' as MatchState
    : det.state.toLowerCase() === 'complete' ? 'result' as MatchState
    : det.state.toLowerCase() === 'stumps' ? 'stumps' as MatchState
    : det.state.toLowerCase() === 'preview' ? 'upcoming' as MatchState
    : 'unknown' as MatchState;

  // Format
  const format = (det.matchFormat || 'Other') as MatchFormat;

  // Batters
  const currentBatters: BatterEntry[] = [];
  if (mini.batsmanStriker) {
    currentBatters.push({
      name: mini.batsmanStriker.batName,
      dismissal: null,
      runs: mini.batsmanStriker.batRuns,
      balls: mini.batsmanStriker.batBalls,
      fours: mini.batsmanStriker.batFours,
      sixes: mini.batsmanStriker.batSixes,
      strikeRate: mini.batsmanStriker.batStrikeRate,
    });
  }
  if (mini.batsmanNonStriker) {
    currentBatters.push({
      name: mini.batsmanNonStriker.batName,
      dismissal: null,
      runs: mini.batsmanNonStriker.batRuns,
      balls: mini.batsmanNonStriker.batBalls,
      fours: mini.batsmanNonStriker.batFours,
      sixes: mini.batsmanNonStriker.batSixes,
      strikeRate: mini.batsmanNonStriker.batStrikeRate,
    });
  }

  // Bowler
  let currentBowler: import('../types').BowlerEntry | null = null;
  if (mini.bowlerStriker) {
    currentBowler = {
      name: mini.bowlerStriker.bowlName,
      overs: String(mini.bowlerStriker.bowlOvs),
      maidens: mini.bowlerStriker.bowlMaidens,
      runs: mini.bowlerStriker.bowlRuns,
      wickets: mini.bowlerStriker.bowlWkts,
      economy: mini.bowlerStriker.bowlEcon,
      wides: mini.bowlerStriker.bowlWides,
      noBalls: mini.bowlerStriker.bowlNoballs,
    };
  }

  // Recent Balls
  const recentBalls: RecentBall[] = (mini.recentOvsStats || '').split(/\s+/).filter(Boolean).map(val => {
    const v = val.trim();
    return {
      value: v,
      isWicket: v === 'W',
      isBoundary: v === '4' || v === '6',
      isExtra: ['Wd', 'Nb', 'B', 'Lb'].includes(v),
    };
  });

  // Innings Summary
  const inningsSummary = det.inningsScoreList
    .map(i => `${i.batTeamName} ${i.score}-${i.wickets}${i.isDeclared ? 'd' : ''} (${i.overs} ov)`)
    .join(' • ');

  // Toss
  const toss = det.tossResults ? `${det.tossResults.tossWinnerName} opt to ${det.tossResults.decision}` : null;

  // Derived
  const isChase = statusText.toLowerCase().includes('need') || statusText.toLowerCase().includes('require');
  const wicketsFallen = mini.batTeam.teamWkts;
  const wicketsInHand = 10 - wicketsFallen;

  // Latest Commentary
  const latestComm = json.commentaryList && json.commentaryList.length > 0 ? json.commentaryList[0] : null;
  const latestCommentary: import('../types').CommentaryBlock | null = latestComm ? {
    over: String(Math.floor(latestComm.overNumber)),
    ball: String(Math.round((latestComm.overNumber % 1) * 10)),
    event: (latestComm.event || 'other').toLowerCase() as any,
    text: latestComm.commText,
    score: null, // Not directly in this item
  } : null;

  return {
    matchId,
    slug,
    title,
    series: '', // Not in this API?
    venue: '',  // Not in this API?
    toss,
    statusText,
    state,
    format,
    inningsSummary,
    currentRR: mini.currentRunRate,
    requiredRR: mini.requiredRunRate,
    winProbability: null,
    currentBatters,
    currentBowler,
    keyStats: {
      partnership: mini.partnerShip ? `${mini.partnerShip.runs} (${mini.partnerShip.balls})` : null,
      lastWicket: mini.lastWicket,
      last5Overs: mini.latestPerformance.find(p => p.label.includes('5')) ? `${mini.latestPerformance.find(p => p.label.includes('5'))?.runs}/${mini.latestPerformance.find(p => p.label.includes('5'))?.wkts}` : null,
    },
    recentBalls,
    latestCommentary,
    tabsAvailable: [],
    derived: {
      isChase,
      runsRequired: mini.remRunsToWin || null,
      ballsRemaining: null, // Need to calculate if needed
      currentRunRate: mini.currentRunRate,
      requiredRunRate: mini.requiredRunRate,
      wicketsInHand,
      lastUpdatedAgeSec: 0,
    },
  };
}

// ─── Parser ───────────────────────────────────────────────────────────────────

export function parseMatchLivePage(
  $: cheerio.CheerioAPI,
  url: string,
  matchId: string
): LiveMatchDetail {
  const parsed = parseMatchUrl(url);
  const slug = parsed?.slug || '';

  // ── Title ──
  let title = '';
  for (const sel of TITLE_SELECTORS) {
    title = cleanText($(sel).first().text());
    if (title) break;
  }
  if (!title) title = `Match ${matchId}`;

  // ── Series ──
  const seriesSelectors = ['.cb-nav-main-headr a', '.cb-nav-hdr a', '.cb-srs-link'];
  let series = '';
  for (const sel of seriesSelectors) {
    series = cleanText($(sel).first().text());
    if (series) break;
  }

  // ── Venue ──
  let venue = '';
  for (const sel of VENUE_SELECTORS) {
    const t = cleanText($(sel).first().text());
    if (t && (t.includes('Stadium') || t.includes('Ground') || t.includes('Oval') || t.includes(',') || t.length < 60)) {
      venue = t; break;
    }
  }

  // ── Toss ──
  let toss: string | null = null;
  for (const sel of TOSS_SELECTORS) {
    const t = cleanText($(sel).first().text());
    if (t && t.toLowerCase().includes('toss')) { toss = t; break; }
  }

  // ── Status & state ──
  let statusText = '';
  let statusCls = '';
  for (const sel of STATUS_SELECTORS) {
    const $el = $(sel).first();
    if ($el.length) {
      statusText = cleanText($el.text());
      statusCls = $el.attr('class') || '';
      break;
    }
  }
  const state = inferState(statusText, statusCls);
  const format = inferFormat(title + ' ' + series);

  // ── Innings summary (current score header) ──
  let inningsSummary: string | null = null;
  for (const sel of SCORE_HEADER_SELECTORS) {
    const t = cleanText($(sel).first().text());
    if (t && t.match(/\d/)) { inningsSummary = t; break; }
  }
  if (!inningsSummary) logSelectorMiss('parseMatchLivePage:score', SCORE_HEADER_SELECTORS, url);

  // ── Run rates ──
  let currentRR: number | null = null;
  let requiredRR: number | null = null;

  const rrSelectors = ['.cb-min-run-rts', '.cb-run-rate-col', '.cb-lv-run-rate'];
  for (const sel of rrSelectors) {
    const $el = $(sel).first();
    if (!$el.length) continue;
    const text = cleanText($el.text());
    const crMatch = text.match(/CRR:\s*([0-9.]+)/i);
    const rrMatch = text.match(/RRR:\s*([0-9.]+)/i);
    if (crMatch) currentRR = safeFloat(crMatch[1]);
    if (rrMatch) requiredRR = safeFloat(rrMatch[1]);
    if (currentRR !== null) break;
  }

  // ── Current batters ──
  const currentBatters = parseLiveBatters($, url);

  // ── Current bowler ──
  const currentBowler = parseLiveBowler($, url);

  // ── Recent balls ──
  const recentBalls = parseRecentBalls($, url);

  // ── Key stats ──
  const keyStats = parseKeyStats($, url);

  // ── Win probability ──
  let winProbability: { home: number; away: number } | null = null;
  const wpSelectors = ['.cb-win-prob', '.cb-wining-prob', '[class*="win-prob"]'];
  for (const sel of wpSelectors) {
    const $el = $(sel).first();
    if (!$el.length) continue;
    const text = cleanText($el.text());
    const nums = text.match(/(\d+(?:\.\d+)?)/g);
    if (nums && nums.length >= 2) {
      winProbability = { home: parseFloat(nums[0]), away: parseFloat(nums[1]) };
      break;
    }
  }

  // ── Available tabs ──
  const tabsAvailable: string[] = [];
  for (const sel of TABS_SELECTORS) {
    $(sel).each((_, tab) => {
      const t = cleanText($(tab).text());
      if (t && !tabsAvailable.includes(t)) tabsAvailable.push(t);
    });
    if (tabsAvailable.length > 0) break;
  }

  // ── Derived fields ──
  const derived = computeDerived(inningsSummary, statusText, recentBalls, currentBatters);

  return {
    matchId,
    slug,
    title,
    series,
    venue,
    toss,
    statusText,
    state,
    format,
    inningsSummary,
    currentRR,
    requiredRR,
    winProbability,
    currentBatters,
    currentBowler,
    keyStats,
    recentBalls,
    latestCommentary: null, // HTML parser doesn't easily extract single latest block yet
    tabsAvailable,
    derived,
  };
}

// ─── Sub-parsers ──────────────────────────────────────────────────────────────

function parseLiveBatters($: cheerio.CheerioAPI, _url: string): BatterEntry[] {
  const batters: BatterEntry[] = [];

  let $rows = $();
  for (const sel of BATTER_ROW_SELECTORS) {
    $rows = $(sel);
    if ($rows.length > 0) break;
  }

  $rows.each((_, row) => {
    const $row = $(row);
    const cols = $row.find('.cb-col').map((_, td) => cleanText($(td).text())).get();

    if (cols.length < 2) return;

    const name = cleanText($row.find('a, .cb-min-itm').first().text()) || cols[0];
    if (!name || name.toLowerCase() === 'batter') return;

    batters.push({
      name,
      dismissal: null, // Live — not dismissed yet
      runs: safeInt(cols[1]),
      balls: safeInt(cols[2]),
      fours: safeInt(cols[3]),
      sixes: safeInt(cols[4]),
      strikeRate: safeFloat(cols[5]),
    });
  });

  return batters;
}

function parseLiveBowler($: cheerio.CheerioAPI, _url: string): BowerEntry | null {
  let $rows = $();
  for (const sel of BOWLER_ROW_SELECTORS) {
    $rows = $(sel);
    if ($rows.length > 0) break;
  }

  let bowler: BowerEntry | null = null;
  const firstRow = $rows.toArray()[0];
  if (firstRow) {
    const $row = $(firstRow);
    const cols = $row.find('.cb-col').map((_, td) => cleanText($(td).text())).get();
    const name = cleanText($row.find('a, .cb-min-itm').first().text()) || cols[0];
    if (name && name.toLowerCase() !== 'bowler' && cols.length >= 2) {
      bowler = {
        name,
        overs: cols[1] || null,
        maidens: safeInt(cols[2]),
        runs: safeInt(cols[3]),
        wickets: safeInt(cols[4]),
        economy: safeFloat(cols[5]),
        wides: safeInt(cols[6]),
        noBalls: safeInt(cols[7]),
      };
    }
  }

  return bowler;
}

// Fix type alias collision
type BowerEntry = import('../types').BowlerEntry;

function parseRecentBalls($: cheerio.CheerioAPI, _url: string): RecentBall[] {
  const balls: RecentBall[] = [];

  let $balls = $();
  for (const sel of RECENT_BALL_SELECTORS) {
    $balls = $(sel);
    if ($balls.length > 0) break;
  }

  $balls.each((_, el) => {
    const $el = $(el);
    const value = cleanText($el.text()) || '?';
    const cls = ($el.attr('class') || '').toLowerCase();

    balls.push({
      value,
      isWicket: value === 'W' || cls.includes('wicket'),
      isBoundary: value === '4' || value === '6' || cls.includes('six') || cls.includes('four'),
      isExtra: value === 'Wd' || value === 'Nb' || value === 'B' || cls.includes('wide') || cls.includes('noball'),
    });
  });

  return balls;
}

function parseKeyStats($: cheerio.CheerioAPI, _url: string): KeyStats {
  let partnership: string | null = null;
  let lastWicket: string | null = null;
  let last5Overs: string | null = null;

  for (const sel of KEY_STATS_SELECTORS) {
    const $stats = $(sel);
    if ($stats.length === 0) continue;

    $stats.each((_, row) => {
      const text = cleanText($(row).text()).toLowerCase();
      if (text.includes('partnership')) {
        partnership = cleanText($(row).text()).replace(/^.*?partnership\s*/i, '').trim();
      } else if (text.includes('last wkt') || text.includes('last wicket')) {
        lastWicket = cleanText($(row).text()).replace(/^.*?last.*?wicket\s*/i, '').trim();
      } else if (text.includes('last 5') || text.includes('recent')) {
        last5Overs = cleanText($(row).text()).replace(/^.*?last\s*5\s*overs?\s*/i, '').trim();
      }
    });

    if (partnership || lastWicket) break;
  }

  return { partnership, lastWicket, last5Overs };
}

// ─── Derived fields ───────────────────────────────────────────────────────────

function computeDerived(
  inningsSummary: string | null,
  statusText: string,
  recentBalls: RecentBall[],
  batters: BatterEntry[]
): DerivedMatchFields {
  // Parse current score from innings summary e.g. "MI: 156-5 (18.2)"
  const scoreMatch = (inningsSummary || '').match(/(\d+)-(\d+)\s*\((\d+(?:\.\d+)?)\)/);
  const runsScored = scoreMatch ? parseInt(scoreMatch[1], 10) : null;
  const wicketsFallen = scoreMatch ? parseInt(scoreMatch[2], 10) : null;
  const oversDone = scoreMatch ? parseFloat(scoreMatch[3]) : null;

  // Runs required from status text e.g. "MI need 45 off 30 balls"
  const needMatch = statusText.match(/need\s+(\d+)\s+(?:runs?\s+)?(?:off|in|from)\s+(\d+)\s+balls?/i);
  const runsRequired = needMatch ? parseInt(needMatch[1], 10) : null;
  const ballsRemaining = needMatch ? parseInt(needMatch[2], 10) : null;

  // CRR and RRR
  const balls = oversDone !== null ? Math.round(oversDone) * 6 + Math.round((oversDone % 1) * 10) : null;
  const currentRunRate = runsScored !== null && balls && balls > 0 ? parseFloat((runsScored / (balls / 6)).toFixed(2)) : null;
  const requiredRunRate = runsRequired !== null && ballsRemaining && ballsRemaining > 0
    ? parseFloat((runsRequired / (ballsRemaining / 6)).toFixed(2)) : null;

  const wicketsInHand = wicketsFallen !== null ? 10 - wicketsFallen : null;

  return {
    isChase: statusText.toLowerCase().includes('need') || statusText.toLowerCase().includes('require'),
    runsRequired,
    ballsRemaining,
    currentRunRate,
    requiredRunRate,
    wicketsInHand,
    lastUpdatedAgeSec: 0,
  };
}
