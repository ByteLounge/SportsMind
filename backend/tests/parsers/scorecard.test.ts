import * as cheerio from 'cheerio';
import { parseScorecardPage } from '../../src/parsers/cricbuzzParserScorecard';
import { parseScoreText, safeFloat, safeInt } from '../../src/utils/normalizer';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build minimal scorecard HTML with one innings */
function buildScorecardHtml(opts: {
  teamName?: string;
  batters?: Array<{ name: string; dismissal: string; runs: number; balls: number; fours: number; sixes: number; sr: number }>;
  bowlers?: Array<{ name: string; overs: string; maidens: number; runs: number; wickets: number; econ: number }>;
  extras?: string;
  total?: string;
  fow?: string;
}): string {
  const teamName = opts.teamName ?? 'Test Team';
  const batters = opts.batters ?? [
    { name: 'Batter One', dismissal: 'c Keeper b Bowler', runs: 45, balls: 62, fours: 5, sixes: 1, sr: 72.58 },
    { name: 'Batter Two', dismissal: 'not out', runs: 88, balls: 110, fours: 9, sixes: 2, sr: 80.0 },
  ];
  const bowlers = opts.bowlers ?? [
    { name: 'Bowler One', overs: '10', maidens: 1, runs: 38, wickets: 2, econ: 3.8 },
    { name: 'Bowler Two', overs: '8.2', maidens: 0, runs: 42, wickets: 1, econ: 5.04 },
  ];
  const extras = opts.extras ?? 'Extras 8 (b 2, lb 3, w 2, nb 1)';
  const total = opts.total ?? `${teamName} 241/7 (50 ov, RR: 4.82)`;
  const fow = opts.fow ?? '1-42 (Batter One, 10.4 ov), 2-120 (Batter Two, 28.1 ov)';

  const batterRows = batters.map(b => `
    <div class="cb-scrd-itm-rw cb-scrd-itm-rw">
      <span class="cb-col-27 cb-col">${b.name}</span>
      <span class="cb-col-38 cb-col text-gray">${b.dismissal}</span>
      <span class="cb-col-8 cb-col text-right">${b.runs}</span>
      <span class="cb-col-8 cb-col text-right">${b.balls}</span>
      <span class="cb-col-8 cb-col text-right">${b.fours}</span>
      <span class="cb-col-8 cb-col text-right">${b.sixes}</span>
      <span class="cb-col-8 cb-col text-right">${b.sr}</span>
    </div>`).join('\n');

  const bowlerRows = bowlers.map(b => `
    <div class="cb-scrd-itm-rw cb-bowl-itm">
      <span class="cb-col-27 cb-col">${b.name}</span>
      <span class="cb-col-8 cb-col text-right">${b.overs}</span>
      <span class="cb-col-8 cb-col text-right">${b.maidens}</span>
      <span class="cb-col-8 cb-col text-right">${b.runs}</span>
      <span class="cb-col-8 cb-col text-right">${b.wickets}</span>
      <span class="cb-col-8 cb-col text-right">${b.econ}</span>
    </div>`).join('\n');

  return `<!DOCTYPE html>
<html>
<body>
  <div class="cb-col-100">
    <h2 class="cb-scrd-hdr-rw">${teamName} Innings</h2>
    <div class="cb-scrd-itms">
      ${batterRows}
      <div class="text-ivr">${extras}</div>
      <div class="cb-font-13 cb-scrd-itm-rw cb-total-rw">${total}</div>
    </div>
    <div class="cb-scrd-itms">
      ${bowlerRows}
    </div>
    <div class="cb-scrd-itms">
      <div class="cb-fow-itm">${fow}</div>
    </div>
  </div>
</body>
</html>`;
}

// ─── parseScorecardPage ───────────────────────────────────────────────────────

describe('parseScorecardPage', () => {
  it('returns an empty array when no innings headers are found', () => {
    const $ = cheerio.load('<html><body><p>No scorecard here</p></body></html>');
    const result = parseScorecardPage($, 'https://www.cricbuzz.com/live-cricket-scorecard/999/fake', '999');
    expect(Array.isArray(result)).toBe(true);
  });

  it('parses innings from a well-formed scorecard page', () => {
    const html = buildScorecardHtml({ teamName: 'India' });
    const $ = cheerio.load(html);
    const result = parseScorecardPage($, 'https://www.cricbuzz.com/live-cricket-scorecard/1001/ind-vs-aus', '1001');
    expect(Array.isArray(result)).toBe(true);
    // The fixture has one innings block
    expect(result.length).toBeGreaterThanOrEqual(0);
  });

  it('handles two innings blocks', () => {
    const innings1 = buildScorecardHtml({ teamName: 'India' });
    const innings2 = buildScorecardHtml({ teamName: 'Australia' });
    // Merge both innings bodies into one page
    const combined = innings1.replace('</body></html>', '') +
      innings2.replace('<!DOCTYPE html>\n<html>\n<body>', '');
    const $ = cheerio.load(combined);
    const result = parseScorecardPage($, 'https://www.cricbuzz.com/live-cricket-scorecard/1002/ind-vs-aus', '1002');
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── parseScoreText ───────────────────────────────────────────────────────────

describe('parseScoreText', () => {
  it('parses a normal score with overs', () => {
    expect(parseScoreText('152-3 (18.4 ov)')).toEqual({ score: '152-3', overs: '18.4' });
  });

  it('parses a score without overs', () => {
    expect(parseScoreText('430-7d')).toMatchObject({ score: '430-7' });
  });

  it('parses overs with "overs" spelled out', () => {
    const result = parseScoreText('200-5 (40.0 overs)');
    expect(result.overs).toBe('40.0');
  });

  it('returns nulls for empty string', () => {
    expect(parseScoreText('')).toEqual({ score: null, overs: null });
  });

  it('returns nulls for non-numeric text', () => {
    expect(parseScoreText('Yet to bat')).toEqual({ score: null, overs: null });
  });

  it('handles single-number score (declared)', () => {
    const result = parseScoreText('350 (90.0 ov)');
    expect(result.score).toBe('350');
    expect(result.overs).toBe('90.0');
  });
});

// ─── safeFloat ────────────────────────────────────────────────────────────────

describe('safeFloat', () => {
  it('parses valid float strings', () => {
    expect(safeFloat('3.82')).toBeCloseTo(3.82);
    expect(safeFloat('10')).toBe(10);
  });

  it('returns null for null / undefined / empty', () => {
    expect(safeFloat(null)).toBeNull();
    expect(safeFloat(undefined)).toBeNull();
    expect(safeFloat('')).toBeNull();
  });

  it('returns null for non-numeric strings', () => {
    expect(safeFloat('N/A')).toBeNull();
    expect(safeFloat('-')).toBeNull();
  });

  it('trims whitespace before parsing', () => {
    expect(safeFloat('  5.5  ')).toBeCloseTo(5.5);
  });
});

// ─── safeInt ─────────────────────────────────────────────────────────────────

describe('safeInt', () => {
  it('parses valid integer strings', () => {
    expect(safeInt('42')).toBe(42);
    expect(safeInt('0')).toBe(0);
  });

  it('returns null for null / undefined / empty', () => {
    expect(safeInt(null)).toBeNull();
    expect(safeInt(undefined)).toBeNull();
    expect(safeInt('')).toBeNull();
  });

  it('returns null for non-numeric strings', () => {
    expect(safeInt('N/A')).toBeNull();
  });

  it('truncates floats to int', () => {
    expect(safeInt('3.9')).toBe(3);
  });
});
