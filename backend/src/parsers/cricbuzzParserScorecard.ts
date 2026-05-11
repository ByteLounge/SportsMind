import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import {
  BatterEntry, BowlerEntry, FallOfWicket, InningsScorecard, InningsNumber,
  CricbuzzApiScorecard
} from '../types';
import { cleanText, safeFloat, safeInt } from '../utils/normalizer';
import { logSelectorMiss } from '../utils/logger';

// ─── Selectors ────────────────────────────────────────────────────────────────

// ... selectors ...

// ─── JSON Parser ──────────────────────────────────────────────────────────────

export function parseScorecardApi(
  json: CricbuzzApiScorecard,
  _matchId: string
): InningsScorecard[] {
  const innings: InningsScorecard[] = [];

  for (const inn of json.scoreCard) {
    const batting: BatterEntry[] = Object.values(inn.batTeamDetails.batsmenData).map(b => ({
      name: b.batName,
      dismissal: b.outDesc || 'not out',
      runs: b.runs,
      balls: b.balls,
      fours: b.fours,
      sixes: b.sixes,
      strikeRate: b.strikeRate,
    }));

    const bowling: BowlerEntry[] = Object.values(inn.bowlTeamDetails.bowlersData).map(b => ({
      name: b.bowlName,
      overs: String(b.overs),
      maidens: b.maidens,
      runs: b.runs,
      wickets: b.wickets,
      economy: b.economy,
      wides: b.wides,
      noBalls: b.noBalls,
    }));

    const fallOfWickets: FallOfWicket[] = Object.values(inn.wicketsData).map(w => ({
      wicket: w.wktNbr,
      score: String(w.wktRuns),
      over: String(w.wktOver),
      batter: w.batName,
    }));

    const partnerships: string[] = Object.values(inn.partnershipsData).map(p => 
      `${p.bat1Name} & ${p.bat2Name}: ${p.totalRuns} (${p.totalBalls})`
    );

    const extras = inn.extrasData;
    const extrasStr = `${extras.total} (b ${extras.byes}, lb ${extras.legByes}, w ${extras.wides}, nb ${extras.noBalls}, p ${extras.penalty})`;

    // Use scoreDetails for accurate total score and overs
    const totalRuns = inn.scoreDetails?.runs ?? 0;
    const totalWickets = inn.scoreDetails?.wickets ?? 0;
    const oversDone = inn.scoreDetails?.overs ?? 0;
    const isDeclared = inn.scoreDetails?.isDeclared ?? false;

    innings.push({
      inningsNumber: inn.inningsId as any,
      battingTeam: inn.batTeamDetails.batTeamName,
      total: `${totalRuns}-${totalWickets}${isDeclared ? 'd' : ''}`,
      overs: String(oversDone),
      extras: extrasStr,
      batting,
      bowling,
      yetToBat: [],
      fallOfWickets,
      powerplay: null,
      partnerships,
    });
  }

  return innings;
}

// ─── Parser ───────────────────────────────────────────────────────────────────

const INNINGS_HEADER_SELECTORS = ['h2.cb-scrd-hdr-rw', 'h4.cb-scrd-hdr-rw', '.cb-scrd-hdr', 'div[class*="cb-scrd-hdr"]'];
const EXTRAS_SELECTORS = ['.cb-scrd-itms .text-ivr', '.cb-scrd-itms .cb-font-13.cb-scrd-itm-rw', 'span.cb-extras'];
const TOTAL_SELECTORS = ['.cb-scrd-itms .cb-font-13.cb-scrd-itm-rw.cb-total-rw', '.cb-scrd-itms .cb-font-13.text-bold'];
const FOW_SELECTORS = ['.cb-scrd-itms .cb-fow-itm', '.cb-fow-itm'];

// ─── Parser ───────────────────────────────────────────────────────────────────

export function parseScorecardPage(
  $: cheerio.CheerioAPI,
  url: string,
  matchId: string
): InningsScorecard[] {
  const innings: InningsScorecard[] = [];

  // Find innings sections — separated by headers like "1st Innings", "2nd Innings"
  // Cricbuzz structures scorecards with `.cb-scrd-hdr-rw` separating each innings
  let headerSel = '';
  for (const sel of INNINGS_HEADER_SELECTORS) {
    if ($(sel).length > 0) { headerSel = sel; break; }
  }

  if (!headerSel) {
    logSelectorMiss('parseScorecardPage:header', INNINGS_HEADER_SELECTORS, url);
    // Try full-page fallback
    return parseScorecardFallback($, url);
  }

  const $headers = $(headerSel);
  $headers.each((inningsIdx, headerEl) => {
    try {
      const inning = parseInningsSection($, headerEl, inningsIdx, url);
      if (inning) innings.push(inning);
    } catch {
      // Partial failure — skip this innings block
    }
  });

  return innings;
}

function parseInningsSection(
  $: cheerio.CheerioAPI,
  headerEl: AnyNode,
  idx: number,
  url: string
): InningsScorecard | null {
  const $header = $(headerEl);
  const headerText = cleanText($header.text());

  // Extract batting team from header: "Mumbai Indians Innings 1 (20.0 Ov)"
  const teamMatch = headerText.match(/^(.+?)\s+(?:Innings|Inning)\s*(\d)/i);
  const battingTeam = teamMatch ? cleanText(teamMatch[1]) : headerText;

  // Get the table/section that follows this header
  const $section = $header.nextUntil(INNINGS_HEADER_SELECTORS.join(','));

  // ── Batting ──
  const batting = parseBattingRows($, $section, url);

  // ── Bowling ──
  const bowling = parseBowlingRows($, $section, url);

  // ── Extras ──
  let extras = '';
  for (const sel of EXTRAS_SELECTORS) {
    const e = $section.filter(sel).first().text() || $section.find(sel).first().text();
    if (e && e.toLowerCase().includes('extra')) {
      extras = cleanText(e);
      break;
    }
  }

  // ── Total ──
  let total = '';
  for (const sel of TOTAL_SELECTORS) {
    const t = $section.filter(sel).first().text() || $section.find(sel).first().text();
    if (t && t.match(/\d+-\d+/)) { total = cleanText(t); break; }
  }

  // ── Overs ──
  const oversMatch = headerText.match(/\((\d+(?:\.\d+)?)\s*Ov\)/i);
  const overs = oversMatch ? oversMatch[1] : '';

  // ── Yet to bat ──
  const ytbSelectors = ['.cb-scrd-itms .cb-scrd-itm-rw.cb-yet-to-bat', '.cb-ytb'];
  let yetToBat: string[] = [];
  for (const sel of ytbSelectors) {
    const $ytb = $section.find(sel).first();
    if ($ytb.length) {
      const text = cleanText($ytb.text()).replace(/Yet to bat\s*:?\s*/i, '');
      yetToBat = text.split(',').map(s => cleanText(s)).filter(Boolean);
      break;
    }
  }

  // ── Fall of wickets ──
  const fallOfWickets = parseFallOfWickets($, $section);

  // ── Powerplay ──
  let powerplay: string | null = null;
  const ppSelectors = ['.cb-scrd-itms .cb-pp-itm', '.cb-pwr-play'];
  for (const sel of ppSelectors) {
    const pp = cleanText($section.find(sel).text());
    if (pp) { powerplay = pp; break; }
  }

  // ── Partnerships ──
  const partnerships: string[] = $section
    .find('.cb-scrd-itms .cb-prtnrshp-itm, .cb-prtnrship')
    .map((_, el) => cleanText($(el).text()))
    .get()
    .filter(Boolean);

  return {
    inningsNumber: ((idx + 1) as InningsNumber),
    battingTeam,
    total,
    overs,
    extras,
    batting,
    bowling,
    yetToBat,
    fallOfWickets,
    powerplay,
    partnerships,
  };
}

function parseBattingRows(
  $: cheerio.CheerioAPI,
  $section: cheerio.Cheerio<AnyNode>,
  _url: string
): BatterEntry[] {
  const entries: BatterEntry[] = [];

  // Multiple selector strategies
  const rowSels = ['.cb-scrd-itm-rw:not(.cb-scrd-itm-hdr):not(.cb-fow-itm):not(.cb-bowl-itm)', '.cb-bat-itm'];

  let $rows = $();
  for (const sel of rowSels) {
    $rows = $section.filter(sel).add($section.find(sel));
    if ($rows.length > 0) break;
  }

  $rows.each((_, row) => {
    const $row = $(row);
    const cols = $row.find('td, .cb-col').map((_, td) => cleanText($(td).text())).get();

    if (cols.length < 2) return;

    // Column order: name, dismissal, R, B, 4s, 6s, SR
    const name = cleanText(cols[0] || '');
    if (!name || name.toLowerCase() === 'batter') return; // skip header row

    const isHeaderLike = name.toLowerCase().includes('did not bat') ||
      name.toLowerCase().includes('yet to bat') ||
      name.toLowerCase().includes('extras') ||
      name.toLowerCase().includes('total');
    if (isHeaderLike) return;

    // Dismissal might be in col 1 or merged
    let dismissal: string | null = null;
    let runIdx = 1;

    if (cols.length >= 6) {
      // Standard: name | dismissal | R | B | 4s | 6s | SR
      dismissal = cleanText(cols[1] || '') || null;
      runIdx = 2;
    }

    entries.push({
      name,
      dismissal: dismissal === 'not out' ? 'not out' : dismissal,
      runs: safeInt(cols[runIdx]),
      balls: safeInt(cols[runIdx + 1]),
      fours: safeInt(cols[runIdx + 2]),
      sixes: safeInt(cols[runIdx + 3]),
      strikeRate: safeFloat(cols[runIdx + 4]),
    });
  });

  return entries;
}

function parseBowlingRows(
  $: cheerio.CheerioAPI,
  $section: cheerio.Cheerio<AnyNode>,
  _url: string
): BowlerEntry[] {
  const entries: BowlerEntry[] = [];

  const rowSels = ['.cb-bowl-itm', '.cb-scrd-itm-rw.cb-bowl-itm'];
  let $rows = $();
  for (const sel of rowSels) {
    $rows = $section.filter(sel).add($section.find(sel));
    if ($rows.length > 0) break;
  }

  $rows.each((_, row) => {
    const $row = $(row);
    const cols = $row.find('td, .cb-col').map((_, td) => cleanText($(td).text())).get();

    if (cols.length < 2) return;

    const name = cleanText(cols[0] || '');
    if (!name || name.toLowerCase() === 'bowler') return;

    // Column order: name | O | M | R | W | Eco | Wd | Nb
    entries.push({
      name,
      overs: cols[1] || null,
      maidens: safeInt(cols[2]),
      runs: safeInt(cols[3]),
      wickets: safeInt(cols[4]),
      economy: safeFloat(cols[5]),
      wides: safeInt(cols[6]),
      noBalls: safeInt(cols[7]),
    });
  });

  return entries;
}

function parseFallOfWickets(
  $: cheerio.CheerioAPI,
  $section: cheerio.Cheerio<AnyNode>
): FallOfWicket[] {
  const entries: FallOfWicket[] = [];

  for (const sel of FOW_SELECTORS) {
    const $rows = $section.filter(sel).add($section.find(sel));
    if ($rows.length === 0) continue;

    $rows.each((i, row) => {
      const text = cleanText($(row).text());
      // Format: "1-45 (Smith, 8.2)"
      const m = text.match(/(\d+)-(\d+)\s*\(([^,]+),?\s*([0-9.]+)?\)/);
      if (m) {
        entries.push({
          wicket: parseInt(m[1], 10),
          score: `${m[1]}-${m[2]}`,
          over: m[4] || '',
          batter: cleanText(m[3]),
        });
      }
    });

    if (entries.length > 0) break;
  }

  return entries;
}

function parseScorecardFallback(
  $: cheerio.CheerioAPI,
  _url: string
): InningsScorecard[] {
  // Last resort: look for any table with runs/balls columns
  const innings: InningsScorecard[] = [];

  $('table').each((i, table) => {
    const headers = $(table).find('th').map((_, th) => cleanText($(th).text()).toLowerCase()).get();
    const hasRunBall = headers.some(h => h === 'r') && headers.some(h => h === 'b');
    if (!hasRunBall) return;

    const batting: BatterEntry[] = [];
    $(table).find('tr').each((_, row) => {
      const cols = $(row).find('td').map((_, td) => cleanText($(td).text())).get();
      if (cols.length < 4 || !cols[0]) return;
      batting.push({
        name: cols[0],
        dismissal: cols[1] || null,
        runs: safeInt(cols[2]),
        balls: safeInt(cols[3]),
        fours: safeInt(cols[4]),
        sixes: safeInt(cols[5]),
        strikeRate: safeFloat(cols[6]),
      });
    });

    innings.push({
      inningsNumber: ((i + 1) as InningsNumber),
      battingTeam: '',
      total: '',
      overs: '',
      extras: '',
      batting,
      bowling: [],
      yetToBat: [],
      fallOfWickets: [],
      powerplay: null,
      partnerships: [],
    });
  });

  return innings;
}
