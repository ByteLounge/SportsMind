import * as cheerio from 'cheerio';
import { SeriesTeamSquad, PlayerEntry } from '../types';
import { cleanText, inferRole } from '../utils/normalizer';
import { logSelectorMiss } from '../utils/logger';

// ─── Selectors ────────────────────────────────────────────────────────────────

const TEAM_BLOCK_SELECTORS = [
  '.cb-teams-wpr .cb-col',
  '.cb-sq-team-wpr',
  'div[class*="team-squad"]',
  '.cb-srs-squad-col',
];

const TEAM_NAME_SELECTORS = ['h2', 'h3', '.cb-team-name', '.cb-srs-sq-tm-nm'];

const PLAYER_LINK_SELECTORS = [
  'a[href*="/profiles/"]',
  '.cb-srs-plr-itm a',
  '.cb-player-itm',
];

// ─── Parser ───────────────────────────────────────────────────────────────────

export function parseSeriesSquadsPage(
  $: cheerio.CheerioAPI,
  url: string,
  _seriesId: string
): { seriesName: string | null; teams: SeriesTeamSquad[] } {
  const seriesNameSelectors = ['h1.cb-nav-hdr', 'h1', 'title'];
  let seriesName: string | null = null;
  for (const sel of seriesNameSelectors) {
    const t = cleanText($(sel).first().text());
    if (t && t.length > 3) { seriesName = t.replace(/\s+squads?/i, '').trim(); break; }
  }

  let $blocks = $();
  for (const sel of TEAM_BLOCK_SELECTORS) {
    $blocks = $(sel);
    if ($blocks.length >= 2) break;
  }

  if ($blocks.length < 2) {
    logSelectorMiss('parseSeriesSquadsPage:block', TEAM_BLOCK_SELECTORS, url);
    // Fallback: group profile links by nearest header
    return { seriesName, teams: parseFlatSquads($) };
  }

  const teams: SeriesTeamSquad[] = [];

  $blocks.each((_, block) => {
    const $block = $(block);

    let name = '';
    for (const sel of TEAM_NAME_SELECTORS) {
      name = cleanText($block.find(sel).first().text());
      if (name) break;
    }
    if (!name) return;

    const players: PlayerEntry[] = [];

    for (const sel of PLAYER_LINK_SELECTORS) {
      $block.find(sel).each((_, a) => {
        const $a = $(a);
        const pName = cleanText($a.text());
        if (!pName || pName.length < 2) return;

        const badge = cleanText($a.parent().find('span, .badge').text());
        players.push({
          name: pName,
          role: inferRole(badge + ' ' + cleanText($a.attr('title') || '')),
          isCaptain: badge.toLowerCase().includes('cap') || badge.includes('(c)'),
          isWicketKeeper: badge.toLowerCase().includes('wk'),
          isOverseas: badge.toLowerCase().includes('overseas'),
        });
      });
      if (players.length > 0) break;
    }

    teams.push({ name, players });
  });

  return { seriesName, teams };
}

function parseFlatSquads($: cheerio.CheerioAPI): SeriesTeamSquad[] {
  const teamMap = new Map<string, PlayerEntry[]>();

  $('a[href*="/profiles/"]').each((_, a) => {
    const name = cleanText($(a).text());
    if (!name) return;
    const $section = $(a).closest('[class*="col"]').prevAll('h2, h3').first();
    const teamName = cleanText($section.text()) || 'Unknown';
    if (!teamMap.has(teamName)) teamMap.set(teamName, []);
    teamMap.get(teamName)!.push({ name, role: 'unknown', isCaptain: false, isWicketKeeper: false, isOverseas: false });
  });

  return Array.from(teamMap.entries()).map(([name, players]) => ({ name, players }));
}
