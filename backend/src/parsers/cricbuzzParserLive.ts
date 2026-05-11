import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import { LiveMatchSummary, TeamScore, MatchState } from '../types';
import {
  cleanText,
  inferState,
  inferFormat,
  inferShortName,
  buildMatchLinks,
  parseMatchUrl,
  extractFromSlug,
  inferStateFromTitle,
} from '../utils/normalizer';
import { logSelectorMiss } from '../utils/logger';
import { findJsonValue } from '../utils/rsc';

// ─── Selector sets (tried in order, first match wins) ────────────────────────

const MATCH_CARD_SELECTORS = [
  '.cb-mtch-lst-itm',
  '.cb-scr-card-sum',
  '[id^="match_"]',
  '.cb-col-100.cb-scr-card',
  '.cb-lv-scrs-col',
];

const MATCH_LINK_SELECTORS = [
  'a.cb-lv-scrs-well-live',
  'a.cb-lv-scrs-well',
  'a[href*="/live-cricket-scores/"]',
  'a[href*="/cricket-scores/"]',
];

const STATUS_SELECTORS = [
  '.cb-text-live',
  '.cb-text-complete',
  '.cb-text-stumps',
  '.cb-text-upcoming',
  '.cb-scr-status',
  '.cb-text-inprogress',
];

const TEAM_ROW_SELECTORS = [
  '.cb-scr-wll-hdr',
  '.cb-lv-scrs-well',
  '.cb-min-bat-rw',
  '.cb-scr-rw',
];

const SERIES_SELECTORS = [
  '.cb-lv-scrs-mtch-info',
  '.cb-text-series',
  '.cb-scr-sub-hdr',
  'span.text-gray',
];

// ─── Parser ───────────────────────────────────────────────────────────────────

function toSlugPart(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function buildSlugFromMatch(m: LiveMatchSummary): string {
  const t1 = toSlugPart(m.teams[0].shortName || m.teams[0].name);
  const t2 = toSlugPart(m.teams[1].shortName || m.teams[1].name);
  const matchDesc = m.title.includes(',') ? toSlugPart(m.title.split(',').slice(1).join(',').trim()) : '';
  const series = toSlugPart(m.series);
  if (!t1 || !t2) return '';
  return [t1, 'vs', t2, matchDesc, series].filter(Boolean).join('-');
}

export function parseLiveScoresPage(
  $: cheerio.CheerioAPI,
  url: string
): LiveMatchSummary[] {
  const html = $.html();

  // Pre-build slug map from anchor tags — always accurate when present
  const slugMap = new Map<string, string>();
  $('a[href*="/live-cricket-scores/"]').each((_, a) => {
    const href = $(a).attr('href') || '';
    const parsed = parseMatchUrl(href);
    if (parsed?.slug) slugMap.set(parsed.matchId, parsed.slug);
  });

  // 1. Try RSC / JSON extraction first
  const rscData = findJsonValue(html, 'currentMatchesList') as any;
  if (rscData && Array.isArray(rscData.typeMatches)) {
    try {
      const matches = parseLiveScoresRsc(rscData);
      if (matches.length > 0) {
        // Cricbuzz dropped slug from matchInfo JSON in their Next.js migration.
        // Enrich from HTML anchors first, then reconstruct from team+series data.
        return matches.map(m => {
          if (m.slug) return m;
          const slug = slugMap.get(m.matchId) || buildSlugFromMatch(m);
          if (!slug) return m;
          return { ...m, slug, links: buildMatchLinks(m.matchId, slug) };
        });
      }
    } catch (e) {
      // fallback
    }
  }

  // 2. Existing HTML-based parsing
  const matches: LiveMatchSummary[] = [];
// ...

  // Find the card container selector that works
  let $cards = $();
  for (const sel of MATCH_CARD_SELECTORS) {
    $cards = $(sel);
    if ($cards.length > 0) break;
  }

  if ($cards.length === 0) {
    logSelectorMiss('parseLiveScoresPage:card', MATCH_CARD_SELECTORS, url);
    // Fallback: try parsing anchor tags with /live-cricket-scores/ hrefs
    return parseLiveScoresFallback($, url);
  }

  $cards.each((_, card) => {
    try {
      const match = parseMatchCard($, card, url);
      if (match) matches.push(match);
    } catch (err) {
      // Skip malformed cards — don't crash the whole response
    }
  });

  return matches;
}

function parseMatchCard(
  $: cheerio.CheerioAPI,
  card: AnyNode,
  url: string
): LiveMatchSummary | null {
  const $card = $(card);

  // ── Match link & ID ──
  let matchHref = '';
  let matchId = '';
  let slug = '';

  for (const sel of MATCH_LINK_SELECTORS) {
    const $a = $card.find(sel).first();
    if ($a.length && $a.attr('href')) {
      matchHref = $a.attr('href')!;
      break;
    }
  }

  // Also try any anchor with a matchId-looking href
  if (!matchHref) {
    $card.find('a[href]').each((_, a) => {
      const h = $(a).attr('href') || '';
      if (h.match(/\/\d{4,}\/[a-z0-9-]+/) && !matchHref) matchHref = h;
    });
  }

  if (!matchHref) {
    logSelectorMiss('parseMatchCard:link', MATCH_LINK_SELECTORS, url);
    return null;
  }

  const parsed = parseMatchUrl(matchHref);
  if (!parsed) return null;
  matchId = parsed.matchId;
  slug = parsed.slug;

  // ── Match title (series + teams description) ──
  const titleSelectors = [
    '.cb-lv-mtch-title',
    '.cb-mtch-info',
    'h4',
    '.cb-lv-scrs-mtch-hdr',
    'span.cb-font-16',
  ];
  let title = '';
  for (const sel of titleSelectors) {
    const t = cleanText($card.find(sel).first().text());
    if (t) { title = t; break; }
  }
  if (!title) title = `Match ${matchId}`;

  // ── Series name ──
  let series = '';
  for (const sel of SERIES_SELECTORS) {
    const s = cleanText($card.find(sel).first().text());
    if (s) { series = s; break; }
  }

  // ── Venue ──
  const venueSelectors = ['.cb-lv-scrs-venue', '.cb-text-gray.cb-font-12', '.cb-scr-sub-hdr'];
  let venue = '';
  for (const sel of venueSelectors) {
    const v = cleanText($card.find(sel).first().text());
    if (v) { venue = v; break; }
  }

  // ── Status text & state ──
  let statusText = '';
  let statusCls = '';
  for (const sel of STATUS_SELECTORS) {
    const $el = $card.find(sel).first();
    if ($el.length) {
      statusText = cleanText($el.text());
      statusCls = ($el.attr('class') || '');
      break;
    }
  }
  let state: MatchState = inferState(statusText, statusCls);

  // ── Start time ──
  let startTimeText: string | null = null;
  const timeSelectors = ['.cb-text-upcoming', '.cb-mtch-dt', 'span[class*="time"]'];
  for (const sel of timeSelectors) {
    const t = cleanText($card.find(sel).first().text());
    if (t) { startTimeText = t; break; }
  }

  // ── Teams & scores ──
  const rawTeams = parseTeamScores($, $card, card);

  // Always extract from slug as ground truth for team identity
  const slugInfo = extractFromSlug(slug);

  const teams: [import('../types').TeamScore, import('../types').TeamScore] = [
    (rawTeams[0].name && rawTeams[0].name !== 'TBD')
      ? rawTeams[0]
      : { ...rawTeams[0], name: slugInfo.t1Name, shortName: inferShortName(slugInfo.t1Name) || slugInfo.t1Code },
    (rawTeams[1].name && rawTeams[1].name !== 'TBD')
      ? rawTeams[1]
      : { ...rawTeams[1], name: slugInfo.t2Name, shortName: inferShortName(slugInfo.t2Name) || slugInfo.t2Code },
  ];

  // Prefer slug-derived series when HTML extraction was empty
  if (!series && slugInfo.series) series = slugInfo.series;

  // Improve statusText: use part after " - " in title when HTML extraction was empty
  if (!statusText && title.includes(' - ')) {
    statusText = title.split(' - ').slice(1).join(' - ').trim();
  }

  // Improve state inference using title text when it's still unknown
  if (state === 'unknown' || !statusText) {
    const titleState = inferStateFromTitle(title);
    if (titleState !== 'unknown') state = titleState;
  }

  // ── Format ──
  // Include slug in the format check so "indian-premier-league" slug maps to T20
  const format = inferFormat(title + ' ' + series + ' ' + slug);

  // ── Links ──
  const links = buildMatchLinks(matchId, slug);

  return {
    matchId,
    slug,
    title,
    series,
    venue,
    statusText,
    state,
    format,
    startTimeText,
    teams,
    latestCommentary: null,
    links,
  };
}

function parseTeamScores(
  $: cheerio.CheerioAPI,
  $card: cheerio.Cheerio<AnyNode>,
  _card: AnyNode
): [TeamScore, TeamScore] {
  const teams: TeamScore[] = [];

  for (const sel of TEAM_ROW_SELECTORS) {
    const rows = $card.find(sel);
    if (rows.length >= 2) {
      rows.toArray().slice(0, 2).forEach(row => {
        const $row = $(row);

        // Prefer child-span extraction (e.g. <span class="cb-hmscg-tm-nm">CSK</span><span>149-3 (12.5 ov)</span>)
        const $spans = $row.children('span');
        let name: string;
        let scoreRaw: string;
        if ($spans.length >= 2) {
          name = cleanText($spans.eq(0).text());
          scoreRaw = cleanText($spans.eq(1).text());
        } else {
          // Typical single-text format: "CSK  149-3  (12.5)"
          const rawText = cleanText($row.text());
          const parts = rawText.split(/\s{2,}|\t/);
          name = cleanText(parts[0] || '');
          scoreRaw = cleanText(parts.slice(1).join(' '));
        }

        const ovMatch = scoreRaw.match(/\((\d+(?:\.\d+)?)/);
        const scoreMatch = scoreRaw.match(/(\d+-\d+|\d+\/\d+)/);

        teams.push({
          name,
          shortName: inferShortName(name),
          score: scoreMatch ? scoreMatch[1].replace('/', '-') : null,
          overs: ovMatch ? ovMatch[1] : null,
        });
      });
      break;
    }
  }

  // Try alternate — team names and scores in separate elements
  if (teams.length < 2) {
    const teamNames = $card.find('.cb-hmscg-tm-nm, .cb-lv-scrs-tm-nm, .cb-ovr-flo').map((_, el) => cleanText($(el).text())).get();
    const scores = $card.find('.cb-hmscg-scr-itm, .cb-lv-scrs-scr, .cb-scr-wll-hdr span').map((_, el) => cleanText($(el).text())).get();

    for (let i = 0; i < Math.min(2, teamNames.length); i++) {
      const score = scores[i] || null;
      const ovMatch = (score || '').match(/\((\d+(?:\.\d+)?)\)/);
      const scoreMatch = (score || '').match(/(\d+-\d+|\d+\/\d+)/);
      teams.push({
        name: teamNames[i],
        shortName: inferShortName(teamNames[i]),
        score: scoreMatch ? scoreMatch[1].replace('/', '-') : null,
        overs: ovMatch ? ovMatch[1] : null,
      });
    }
  }

  // Pad to 2 teams if needed
  while (teams.length < 2) {
    teams.push({ name: 'TBD', shortName: 'TBD', score: null, overs: null });
  }

  return [teams[0], teams[1]];
}

/**
 * Parse anchor title attr: "Mumbai Indians vs Royal Challengers Bengaluru, 54th Match - RCB opt to bowl"
 * Returns full team names and status text — more accurate than slug extraction.
 */
function parseTitleAttr(titleAttr: string): { t1Name: string; t2Name: string; statusText: string } | null {
  const vsIdx = titleAttr.indexOf(' vs ');
  if (vsIdx === -1) return null;
  const t1Name = titleAttr.substring(0, vsIdx).trim();
  const rest = titleAttr.substring(vsIdx + 4); // "Royal Challengers…, 54th Match - RCB opt to bowl"
  const dashIdx = rest.lastIndexOf(' - ');
  const statusText = dashIdx !== -1 ? rest.substring(dashIdx + 3).trim() : '';
  const commaIdx = rest.indexOf(',');
  const t2Name = (commaIdx !== -1
    ? rest.substring(0, commaIdx)
    : dashIdx !== -1 ? rest.substring(0, dashIdx) : rest
  ).trim();
  if (!t1Name || !t2Name) return null;
  return { t1Name, t2Name, statusText };
}

/** Fallback: extract matches from anchor hrefs if card-level parsing fails */
function parseLiveScoresFallback(
  $: cheerio.CheerioAPI,
  _url: string
): LiveMatchSummary[] {
  const seen = new Set<string>();
  const matches: LiveMatchSummary[] = [];

  $('a[href*="/live-cricket-scores/"]').each((_, a) => {
    const href = $(a).attr('href') || '';
    const parsed = parseMatchUrl(href);
    if (!parsed || seen.has(parsed.matchId)) return;
    seen.add(parsed.matchId);

    // Anchor text — e.g. "MI vs RCB - RCB opt to bowl" (short form)
    const rawTitle = cleanText($(a).text()).replace(/^LIVE\s*/i, '').trim();

    // Anchor title attribute has FULL team names — prefer it
    const titleAttr = cleanText($(a).attr('title') || '');
    const fromTitle = titleAttr ? parseTitleAttr(titleAttr) : null;

    // Slug-based extraction as fallback for team names
    const slugInfo = extractFromSlug(parsed.slug);

    const t1Name = fromTitle?.t1Name || slugInfo.t1Name;
    const t2Name = fromTitle?.t2Name || slugInfo.t2Name;

    // Build a clean title: "LSG vs CSK, 53rd Match, Indian Premier League 2026"
    // If we have the title attr, reconstruct from it; otherwise use anchor text
    const title = titleAttr
      ? titleAttr.replace(/ - .+$/, '').replace(/,$/, '').trim()  // strip " - status" suffix
      : rawTitle || `Match ${parsed.matchId}`;

    // Status: from title attr, otherwise from anchor text after " - "
    const statusText = fromTitle?.statusText ||
      (rawTitle.includes(' - ') ? rawTitle.split(' - ').slice(1).join(' - ').trim() : '');

    // State from status text or title
    const inferredFromStatus = inferStateFromTitle(statusText);
    const inferredFromTitle = inferStateFromTitle(rawTitle || titleAttr);
    const state: import('../types').MatchState =
      inferredFromStatus !== 'unknown' ? inferredFromStatus :
      inferredFromTitle !== 'unknown' ? inferredFromTitle :
      inferState(statusText, '');

    const series = slugInfo.series;
    const format = inferFormat(title + ' ' + series + ' ' + parsed.slug);
    const links = buildMatchLinks(parsed.matchId, parsed.slug);

    // Prefer slug code (always clean) over generated initials for shortName
    const t1Short = inferShortName(t1Name) !== t1Name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 3)
      ? inferShortName(t1Name)   // from KNOWN map — reliable
      : slugInfo.t1Code || inferShortName(t1Name);  // slug code is accurate
    const t2Short = inferShortName(t2Name) !== t2Name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 3)
      ? inferShortName(t2Name)
      : slugInfo.t2Code || inferShortName(t2Name);

    matches.push({
      matchId: parsed.matchId,
      slug: parsed.slug,
      title,
      series,
      venue: '',
      statusText,
      state,
      format,
      startTimeText: null,
      teams: [
        { name: t1Name, shortName: t1Short, score: null, overs: null },
        { name: t2Name, shortName: t2Short, score: null, overs: null },
      ],
      latestCommentary: null,
      links,
    });
  });

  return matches;
}

// ─── Filters ──────────────────────────────────────────────────────────────────

const SERIES_KEYWORDS: Record<string, string[]> = {
  ipl: ['indian premier', 'ipl'],
  psl: ['pakistan super', 'psl'],
  bbl: ['big bash', 'bbl'],
  cpl: ['caribbean premier', 'cpl'],
  sa20: ['sa20', 'south africa t20'],
  hundred: ['hundred'],
  wpl: ['women\'s premier', 'wpl'],
  test: ['test match', '5-day'],
  odi: ['one-day', 'odi'],
};

export function filterMatches(
  matches: LiveMatchSummary[],
  opts: { series?: string; team?: string; status?: string }
): LiveMatchSummary[] {
  let result = matches;

  if (opts.series) {
    const kws = SERIES_KEYWORDS[opts.series.toLowerCase()] || [opts.series.toLowerCase()];
    result = result.filter(m =>
      kws.some(kw =>
        m.series.toLowerCase().includes(kw) ||
        m.title.toLowerCase().includes(kw)
      )
    );
  }

  if (opts.team) {
    const t = opts.team.toLowerCase();
    result = result.filter(m =>
      m.teams.some(tm =>
        tm.name.toLowerCase().includes(t) ||
        tm.shortName.toLowerCase().includes(t)
      )
    );
  }

  if (opts.status) {
    const s = opts.status.toLowerCase();
    if (s === 'live') {
      result = result.filter(m => ['live', 'stumps', 'rain_delay'].includes(m.state));
    } else if (s === 'upcoming') {
      result = result.filter(m => m.state === 'upcoming');
    } else if (s === 'recent') {
      result = result.filter(m => ['result', 'abandoned'].includes(m.state));
    } else {
      result = result.filter(m => m.state === s);
    }
  }

  return result;
}

function normalizeState(s: string): MatchState {
  const t = (s || '').toLowerCase();
  if (t === 'in progress' || t === 'live' || t === 'toss') return 'live';
  if (t === 'preview' || t === 'upcoming') return 'upcoming';
  if (t === 'complete' || t === 'result' || t === 'abandoned') return 'result';
  if (t === 'stumps') return 'stumps';
  if (t === 'rain' || t === 'delayed' || t === 'rain_delay') return 'rain_delay';
  return 'unknown';
}

/** Robustly parse live scores from RSC currentMatchesList payload */
function parseLiveScoresRsc(data: any): LiveMatchSummary[] {
  const matches: LiveMatchSummary[] = [];
  if (!data || !Array.isArray(data.typeMatches)) return matches;

  data.typeMatches.forEach((type: any) => {
    if (!Array.isArray(type.seriesMatches)) return;

    type.seriesMatches.forEach((seriesMatch: any) => {
      const wrapper = seriesMatch.seriesAdWrapper;
      if (!wrapper || !Array.isArray(wrapper.matches)) return;

      wrapper.matches.forEach((m: any) => {
        const info = m.matchInfo;
        const score = m.matchScore;
        if (!info) return;

        const matchId = String(info.matchId);
        const slug = info.slug || '';

        const teams: [TeamScore, TeamScore] = [
          {
            name: info.team1.teamName,
            shortName: info.team1.teamSName,
            score: score?.team1Score?.inngs1 ? `${score.team1Score.inngs1.runs}-${score.team1Score.inngs1.wickets}` : null,
            overs: score?.team1Score?.inngs1?.overs?.toString() || null,
          },
          {
            name: info.team2.teamName,
            shortName: info.team2.teamSName,
            score: score?.team2Score?.inngs1 ? `${score.team2Score.inngs1.runs}-${score.team2Score.inngs1.wickets}` : null,
            overs: score?.team2Score?.inngs1?.overs?.toString() || null,
          }
        ];

        matches.push({
          matchId,
          slug,
          title: `${info.team1.teamName} vs ${info.team2.teamName}, ${info.matchDesc}`,
          series: info.seriesName,
          venue: info.venueInfo?.ground || '',
          statusText: info.status || '',
          state: normalizeState(info.state || info.stateTitle),
          format: info.matchFormat as any || 'unknown',
          startTimeText: info.startDate ? new Date(Number(info.startDate)).toLocaleTimeString() : null,
          teams,
          latestCommentary: null,
          links: buildMatchLinks(matchId, slug),
        });
      });
    });
  });

  return matches;
}
