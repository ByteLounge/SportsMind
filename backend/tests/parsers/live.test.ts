import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';

import { parseLiveScoresPage, filterMatches } from '../../src/parsers/cricbuzzParserLive';
import { inferState, inferFormat, inferShortName, parseMatchUrl, buildMatchLinks } from '../../src/utils/normalizer';
import { LiveMatchSummary } from '../../src/types';

// ─── Fixture ──────────────────────────────────────────────────────────────────

const FIXTURE = fs.readFileSync(
  path.join(__dirname, '../fixtures/live_scores_sample.html'),
  'utf-8'
);

function loadFixture(): cheerio.CheerioAPI {
  return cheerio.load(FIXTURE);
}

// ─── parseLiveScoresPage ──────────────────────────────────────────────────────

describe('parseLiveScoresPage', () => {
  let matches: LiveMatchSummary[];

  beforeAll(() => {
    const $ = loadFixture();
    matches = parseLiveScoresPage($, 'https://www.cricbuzz.com/cricket-match/live-scores');
  });

  it('returns 3 match cards from the fixture', () => {
    expect(matches).toHaveLength(3);
  });

  it('parses the live T20 match (CSK vs LSG)', () => {
    const m = matches.find(x => x.matchId === '152086');
    expect(m).toBeDefined();
    expect(m!.state).toBe('live');
    expect(m!.format).toBe('T20');
    expect(m!.venue).toBe('MA Chidambaram Stadium, Chennai');
  });

  it('parses the completed Test match (India vs Australia)', () => {
    const m = matches.find(x => x.matchId === '150234');
    expect(m).toBeDefined();
    expect(m!.state).toBe('result');
    expect(m!.format).toBe('Test');
    expect(m!.statusText).toMatch(/india won/i);
  });

  it('parses the upcoming ODI (England vs Pakistan)', () => {
    const m = matches.find(x => x.matchId === '153001');
    expect(m).toBeDefined();
    expect(m!.state).toBe('upcoming');
    expect(m!.startTimeText).toBeTruthy();
  });

  it('builds correct links for the live match', () => {
    const m = matches.find(x => x.matchId === '152086')!;
    expect(m.links.live).toBe('https://www.cricbuzz.com/live-cricket-scores/152086/csk-vs-lsg-53rd-match-indian-premier-league-2026');
    expect(m.links.scorecard).toContain('/live-cricket-scorecard/152086/');
    expect(m.links.commentary).toContain('/live-cricket-full-commentary/152086/');
  });

  it('attaches team short names', () => {
    const m = matches.find(x => x.matchId === '152086')!;
    const names = m.teams.map(t => t.shortName);
    expect(names).toContain('CSK');
    expect(names).toContain('LSG');
  });

  it('parses CSK score from the live match', () => {
    const m = matches.find(x => x.matchId === '152086')!;
    const csk = m.teams.find(t => t.shortName === 'CSK');
    expect(csk?.score).toBe('149-3');
    expect(csk?.overs).toBe('12.5');
  });

  it('returns empty array for an empty page', () => {
    const $ = cheerio.load('<html><body></body></html>');
    const result = parseLiveScoresPage($, 'https://www.cricbuzz.com/cricket-match/live-scores');
    expect(result).toEqual([]);
  });
});

// ─── filterMatches ────────────────────────────────────────────────────────────

describe('filterMatches', () => {
  let matches: LiveMatchSummary[];

  beforeAll(() => {
    const $ = loadFixture();
    matches = parseLiveScoresPage($, 'https://www.cricbuzz.com/cricket-match/live-scores');
  });

  it('filters by series=ipl', () => {
    const result = filterMatches(matches, { series: 'ipl' });
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.every(m => m.format === 'T20')).toBe(true);
  });

  it('filters by status=live', () => {
    const result = filterMatches(matches, { status: 'live' });
    expect(result.every(m => m.state === 'live')).toBe(true);
    expect(result.length).toBe(1);
  });

  it('filters by status=result', () => {
    const result = filterMatches(matches, { status: 'result' });
    expect(result.every(m => m.state === 'result')).toBe(true);
    expect(result.length).toBe(1);
  });

  it('filters by team name', () => {
    const result = filterMatches(matches, { team: 'india' });
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty array when no matches pass filter', () => {
    const result = filterMatches(matches, { status: 'stumps' });
    expect(result).toHaveLength(0);
  });

  it('applies multiple filters together', () => {
    const result = filterMatches(matches, { series: 'ipl', status: 'live' });
    expect(result.length).toBeGreaterThanOrEqual(1);
    result.forEach(m => {
      expect(m.state).toBe('live');
    });
  });
});

// ─── inferState ───────────────────────────────────────────────────────────────

describe('inferState', () => {
  it('detects live from cb-text-live class', () => {
    expect(inferState('CSK need 55 runs', 'cb-text-live')).toBe('live');
  });

  it('detects live from " need " keyword', () => {
    expect(inferState('PAK need 23 runs in 18 balls', '')).toBe('live');
  });

  it('detects result from cb-text-complete class', () => {
    expect(inferState('India won by 112 runs', 'cb-text-complete')).toBe('result');
  });

  it('detects result from "won by" keyword', () => {
    expect(inferState('Australia won by 5 wickets', '')).toBe('result');
  });

  it('detects abandoned', () => {
    expect(inferState('Match abandoned due to rain', 'cb-text-complete')).toBe('abandoned');
  });

  it('detects stumps', () => {
    expect(inferState('Stumps - Day 2', 'cb-text-stumps')).toBe('stumps');
  });

  it('detects upcoming', () => {
    expect(inferState('Starts at 10:30 AM', '')).toBe('upcoming');
    expect(inferState('', 'cb-text-upcoming')).toBe('upcoming');
  });

  it('detects rain delay', () => {
    expect(inferState('Rain stopped play', '')).toBe('rain_delay');
  });

  it('falls back to unknown', () => {
    expect(inferState('', '')).toBe('unknown');
  });
});

// ─── inferFormat ──────────────────────────────────────────────────────────────

describe('inferFormat', () => {
  it('detects T20 from IPL', () => {
    expect(inferFormat('Indian Premier League 2026')).toBe('T20');
  });

  it('detects T20 from explicit T20 label', () => {
    expect(inferFormat('India vs England, 2nd T20I')).toBe('T20');
  });

  it('detects T10', () => {
    expect(inferFormat('Abu Dhabi T10 League')).toBe('T10');
  });

  it('detects ODI', () => {
    expect(inferFormat('Pakistan Tour of England, 1st ODI')).toBe('ODI');
  });

  it('detects Test', () => {
    expect(inferFormat('Border-Gavaskar Trophy, 2nd Test')).toBe('Test');
  });

  it('falls back to Other', () => {
    expect(inferFormat('Some Unknown Tournament')).toBe('Other');
  });
});

// ─── inferShortName ───────────────────────────────────────────────────────────

describe('inferShortName', () => {
  it('returns known IPL team abbreviations', () => {
    expect(inferShortName('Chennai Super Kings')).toBe('CSK');
    expect(inferShortName('Mumbai Indians')).toBe('MI');
    expect(inferShortName('Royal Challengers Bengaluru')).toBe('RCB');
    expect(inferShortName('Lucknow Super Giants')).toBe('LSG');
    expect(inferShortName('Gujarat Titans')).toBe('GT');
  });

  it('returns known country abbreviations', () => {
    expect(inferShortName('India')).toBe('IND');
    expect(inferShortName('Australia')).toBe('AUS');
    expect(inferShortName('England')).toBe('ENG');
    expect(inferShortName('West Indies')).toBe('WI');
  });

  it('generates initials for unknown teams', () => {
    expect(inferShortName('Fictional Cricket Club')).toBe('FCC');
  });
});

// ─── parseMatchUrl ────────────────────────────────────────────────────────────

describe('parseMatchUrl', () => {
  it('extracts matchId and slug from a live-scores URL', () => {
    const result = parseMatchUrl('/live-cricket-scores/152086/csk-vs-lsg-53rd-match-indian-premier-league-2026');
    expect(result).toEqual({ matchId: '152086', slug: 'csk-vs-lsg-53rd-match-indian-premier-league-2026' });
  });

  it('extracts matchId and slug from a scorecard URL', () => {
    const result = parseMatchUrl('/live-cricket-scorecard/150234/india-vs-australia-2nd-test-border-gavaskar-trophy-2026');
    expect(result).toEqual({ matchId: '150234', slug: 'india-vs-australia-2nd-test-border-gavaskar-trophy-2026' });
  });

  it('returns null for a URL with no numeric segment', () => {
    expect(parseMatchUrl('/cricket-series/ipl-2026-season')).toBeNull();
    expect(parseMatchUrl('')).toBeNull();
    expect(parseMatchUrl('/cricket-match')).toBeNull();
  });
});

// ─── buildMatchLinks ──────────────────────────────────────────────────────────

describe('buildMatchLinks', () => {
  const links = buildMatchLinks('152086', 'csk-vs-lsg-53rd-match-indian-premier-league-2026');

  it('builds live URL', () => {
    expect(links.live).toBe('https://www.cricbuzz.com/live-cricket-scores/152086/csk-vs-lsg-53rd-match-indian-premier-league-2026');
  });

  it('builds scorecard URL', () => {
    expect(links.scorecard).toBe('https://www.cricbuzz.com/live-cricket-scorecard/152086/csk-vs-lsg-53rd-match-indian-premier-league-2026');
  });

  it('builds commentary URL', () => {
    expect(links.commentary).toBe('https://www.cricbuzz.com/live-cricket-full-commentary/152086/csk-vs-lsg-53rd-match-indian-premier-league-2026');
  });

  it('builds squads URL', () => {
    expect(links.squads).toBe('https://www.cricbuzz.com/cricket-match-squads/152086/csk-vs-lsg-53rd-match-indian-premier-league-2026');
  });

  it('builds highlights URL', () => {
    expect(links.highlights).toBe('https://www.cricbuzz.com/cricket-match-highlights/152086/csk-vs-lsg-53rd-match-indian-premier-league-2026');
  });
});
