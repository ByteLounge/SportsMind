import { MatchFormat, MatchState, PlayerRole } from '../types';

// ─── Slug code → Full team name ───────────────────────────────────────────────
const SLUG_CODE_TO_FULL: Record<string, string> = {
  // IPL
  csk: 'Chennai Super Kings', mi: 'Mumbai Indians',
  rcb: 'Royal Challengers Bengaluru', kkr: 'Kolkata Knight Riders',
  rr: 'Rajasthan Royals', srh: 'Sunrisers Hyderabad',
  pbks: 'Punjab Kings', dc: 'Delhi Capitals',
  lsg: 'Lucknow Super Giants', gt: 'Gujarat Titans',
  // Internationals
  ind: 'India', aus: 'Australia', eng: 'England',
  pak: 'Pakistan', sa: 'South Africa', nz: 'New Zealand',
  wi: 'West Indies', sl: 'Sri Lanka', ban: 'Bangladesh',
  afg: 'Afghanistan', zim: 'Zimbabwe', ire: 'Ireland',
  ned: 'Netherlands', sco: 'Scotland', usa: 'USA',
  uae: 'United Arab Emirates', nam: 'Namibia', can: 'Canada',
  png: 'Papua New Guinea', wsm: 'Samoa', phi: 'Philippines',
  fiji: 'Fiji', jpn: 'Japan', cis: 'Cook Islands',
  gib: 'Gibraltar', malta: 'Malta', fin: 'Finland', cyp: 'Cyprus',
  rom: 'Romania', bgr: 'Bulgaria',
  // Women's internationals
  indw: 'India Women', ausw: 'Australia Women', engw: 'England Women',
  pakw: 'Pakistan Women', nzw: 'New Zealand Women', saw: 'South Africa Women',
  wiw: 'West Indies Women', slw: 'Sri Lanka Women', banw: 'Bangladesh Women',
  zimw: 'Zimbabwe Women', irew: 'Ireland Women',
  'hkc-w': 'Hong Kong, China Women', mlyw: 'Malaysia Women',
  chnw: 'China Women', grcw: 'Greece Women', denw: 'Denmark Women',
  // English county
  ham: 'Hampshire', ess: 'Essex', warks: 'Warwickshire', yorks: 'Yorkshire',
  notts: 'Nottinghamshire', sur: 'Surrey', som: 'Somerset', glam: 'Glamorgan',
  leic: 'Leicestershire', sus: 'Sussex', derby: 'Derbyshire',
  nhnts: 'Northamptonshire', gloucs: 'Gloucestershire', kent: 'Kent',
  worcs: 'Worcestershire', dur: 'Durham', lancs: 'Lancashire', mdx: 'Middlesex',
};

/**
 * Extract team codes/names and series title from a Cricbuzz slug.
 * Slug format: "{t1}-vs-{t2}-{Nth}-{match|test|odi|t20i}-{series-name}"
 * Examples:
 *   lsg-vs-csk-53rd-match-indian-premier-league-2026
 *   ban-vs-pak-1st-test-pakistan-tour-of-bangladesh-2026
 *   hkc-w-vs-mlyw-5th-match-hong-kong-china-women-t20i-tri-series-2026
 */
export function extractFromSlug(slug: string): {
  t1Code: string; t1Name: string;
  t2Code: string; t2Name: string;
  series: string;
} {
  const vsIdx = slug.indexOf('-vs-');
  if (vsIdx === -1) {
    return { t1Code: '', t1Name: 'Team A', t2Code: '', t2Name: 'Team B', series: '' };
  }

  const t1Raw = slug.substring(0, vsIdx); // e.g. "lsg", "hkc-w", "nzw"
  const afterVs = slug.substring(vsIdx + 4); // e.g. "csk-53rd-match-indian-premier-league-2026"
  const parts = afterVs.split('-');

  // Collect team2 slug parts until we hit an ordinal or known match keyword
  const t2Parts: string[] = [];
  let si = 0;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i].toLowerCase();
    const isOrdinal = /^\d+(st|nd|rd|th)$/.test(p);
    const isMatchKw = /^(final|semi|qualifier|eliminator|playoff)$/.test(p);
    const isTypePrev = i > 0 && /^(test|odi|t20i|t20|match)$/.test(p);
    if (isOrdinal || isMatchKw || isTypePrev) { si = i; break; }
    t2Parts.push(parts[i]);
    si = i + 1;
  }

  const t2Raw = t2Parts.join('-'); // e.g. "csk", "mlyw"

  // Skip match descriptor (ordinal + type) to reach series words
  let pi = si;
  if (pi < parts.length && /^\d+(st|nd|rd|th)$/.test(parts[pi].toLowerCase())) {
    pi++; // skip "53rd"
    if (pi < parts.length && /^(match|test|odi|t20i|t20)$/.test(parts[pi].toLowerCase())) {
      pi++; // skip "match"/"test"/etc.
    }
  } else if (pi < parts.length && /^(final|semi|qualifier|eliminator|playoff)$/.test(parts[pi].toLowerCase())) {
    pi++; // skip "final"/"semi"/etc.
  }

  const series = parts.slice(pi)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  const slugNameOf = (raw: string) =>
    SLUG_CODE_TO_FULL[raw.toLowerCase()] ||
    raw.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  return {
    t1Code: t1Raw.toUpperCase(),
    t1Name: slugNameOf(t1Raw),
    t2Code: t2Raw.toUpperCase(),
    t2Name: slugNameOf(t2Raw),
    series,
  };
}

/** Infer state from anchor/title text like "CSK won", "Preview", "Stumps" */
export function inferStateFromTitle(title: string): MatchState {
  const t = title.toLowerCase();
  if (t.includes(' won') || t.includes('won by') || t.includes(' wins') || t.includes('match drawn')) return 'result';
  if (t.includes('stumps')) return 'stumps';
  if (t.includes('abandoned')) return 'abandoned';
  if (t.includes('rain') || t.includes('bad light') || t.includes('delayed')) return 'rain_delay';
  if (t.includes('preview') || t.includes('starts') || t.includes('scheduled') || t.includes('upcoming')) return 'upcoming';
  if (t.includes('opt to') || t.includes('toss') || t.includes('batting') || t.includes('bowling') || t.includes('need') || t.includes('live')) return 'live';
  return 'unknown';
}

/** Parse "152-3 (18.4 ov)" → { score: "152-3", overs: "18.4" } */
export function parseScoreText(raw: string): { score: string | null; overs: string | null } {
  if (!raw) return { score: null, overs: null };
  const clean = raw.trim();
  const ovMatch = clean.match(/\((\d+(?:\.\d+)?)\s*(?:ov|overs?)?\)/i);
  const scoreMatch = clean.match(/^(\d+(?:-\d+)?)/);
  return {
    score: scoreMatch ? scoreMatch[1] : null,
    overs: ovMatch ? ovMatch[1] : null,
  };
}

/** Normalise status text → MatchState */
export function inferState(text: string, cssClass?: string): MatchState {
  const t = (text || '').toLowerCase();
  const c = (cssClass || '').toLowerCase();

  if (c.includes('cb-text-live') || t.includes(' need ') || t.includes('batting')) return 'live';
  if (c.includes('cb-text-stumps') || t.includes('stumps')) return 'stumps';
  if (c.includes('cb-text-complete') || t.includes('won by') || t.includes('match drawn') || t.includes('abandoned')) {
    if (t.includes('abandoned')) return 'abandoned';
    return 'result';
  }
  if (t.includes('rain') || t.includes('bad light') || t.includes('delayed')) return 'rain_delay';
  if (t.includes('starts') || t.includes('scheduled') || c.includes('cb-text-upcoming')) return 'upcoming';
  return 'unknown';
}

/** Infer cricket format from series / match title */
export function inferFormat(text: string): MatchFormat {
  const t = (text || '').toLowerCase();
  if (t.includes('t10')) return 'T10';
  if (t.includes('t20') || t.includes('ipl') || t.includes('indian premier') || t.includes('bbl') || t.includes('psl') || t.includes('cpl') || t.includes('hundred')) return 'T20';
  if (t.includes('one day') || t.includes('odi') || t.includes('50-over')) return 'ODI';
  if (t.includes('test') || t.includes('5-day')) return 'Test';
  return 'Other';
}

/** Build normalised short name from team name */
export function inferShortName(name: string): string {
  const KNOWN: Record<string, string> = {
    'Chennai Super Kings': 'CSK',
    'Mumbai Indians': 'MI',
    'Royal Challengers Bengaluru': 'RCB',
    'Royal Challengers Bangalore': 'RCB',
    'Kolkata Knight Riders': 'KKR',
    'Rajasthan Royals': 'RR',
    'Sunrisers Hyderabad': 'SRH',
    'Punjab Kings': 'PBKS',
    'Delhi Capitals': 'DC',
    'Lucknow Super Giants': 'LSG',
    'Gujarat Titans': 'GT',
    India: 'IND',
    Australia: 'AUS',
    England: 'ENG',
    'South Africa': 'SA',
    'New Zealand': 'NZ',
    Pakistan: 'PAK',
    'Sri Lanka': 'SL',
    Bangladesh: 'BAN',
    Afghanistan: 'AFG',
    Zimbabwe: 'ZIM',
    'West Indies': 'WI',
    Ireland: 'IRE',
    Netherlands: 'NED',
    Scotland: 'SCO',
    USA: 'USA',
    'United Arab Emirates': 'UAE',
  };
  return KNOWN[name] || name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 3);
}

/** Extract matchId and slug from Cricbuzz URL */
export function parseMatchUrl(url: string): { matchId: string; slug: string } | null {
  const m = url.match(/\/(\d+)\/([a-z0-9-]+)\/?$/i);
  if (!m) return null;
  return { matchId: m[1], slug: m[2] };
}

/** Extract seriesId and slug from Cricbuzz series URL */
export function parseSeriesUrl(url: string): { seriesId: string; slug: string } | null {
  const m = url.match(/\/cricket-series\/(\d+)\/([^/]+)/i);
  if (!m) return null;
  return { seriesId: m[1], slug: m[2] };
}

/** Build all Cricbuzz URLs for a match */
export function buildMatchLinks(matchId: string, slug: string): import('../types').MatchLinks {
  const base = 'https://www.cricbuzz.com';
  return {
    live: `${base}/live-cricket-scores/${matchId}/${slug}`,
    scorecard: `${base}/live-cricket-scorecard/${matchId}/${slug}`,
    commentary: `${base}/live-cricket-full-commentary/${matchId}/${slug}`,
    squads: `${base}/cricket-match-squads/${matchId}/${slug}`,
    highlights: `${base}/cricket-match-highlights/${matchId}/${slug}`,
  };
}

/** Parse float safely */
export function safeFloat(s: string | null | undefined): number | null {
  if (!s) return null;
  const n = parseFloat(s.trim());
  return isNaN(n) ? null : n;
}

/** Parse int safely */
export function safeInt(s: string | null | undefined): number | null {
  if (!s) return null;
  const n = parseInt(s.trim(), 10);
  return isNaN(n) ? null : n;
}

/** Normalise player role from visible text */
export function inferRole(text: string): PlayerRole {
  const t = (text || '').toLowerCase();
  if (t.includes('wk') || t.includes('wicket')) return 'wicket-keeper';
  if (t.includes('all') || t.includes('ar')) return 'all-rounder';
  if (t.includes('bowl')) return 'bowler';
  if (t.includes('bat')) return 'batter';
  return 'unknown';
}

/** Strip whitespace and ad text from a Cheerio text node */
export function cleanText(raw: string | undefined | null): string {
  return (raw || '').replace(/\s+/g, ' ').trim();
}

/** Try multiple selectors, return the first that has results */
export function firstMatch<T>(selectors: string[], fn: (sel: string) => T | null): T | null {
  for (const sel of selectors) {
    const result = fn(sel);
    if (result !== null && result !== undefined) return result;
  }
  return null;
}
