import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import { PlayerEntry, TeamSquad } from '../types';
import { cleanText, inferRole, inferShortName } from '../utils/normalizer';
import { logSelectorMiss } from '../utils/logger';

// ─── Selectors ────────────────────────────────────────────────────────────────

const TEAM_SECTION_SELECTORS = [
  '.cb-sq-tm',
  '.cb-team-squad',
  'div[class*="squad"]',
  '.cb-col-100.cb-teams-wpr',
];

const TEAM_NAME_SELECTORS = [
  '.cb-sq-tm-hdr',
  '.cb-team-nm',
  'h2.cb-lv-scrs-well',
  'h3',
];

const PLAYER_ITEM_SELECTORS = [
  '.cb-sq-plyr-itm',
  '.cb-player-card',
  '.cb-plyr-card',
  'li.cb-col',
  'a[href*="/profiles/"]',
];

const PLAYING_XI_HEADER_SELECTORS = [
  'span:contains("Playing XI")',
  'h4:contains("Playing")',
  '.cb-sq-XI-hdr',
];

// ─── Parser ───────────────────────────────────────────────────────────────────

export function parseSquadsPage(
  $: cheerio.CheerioAPI,
  url: string,
  _matchId: string
): TeamSquad[] {
  const squads: TeamSquad[] = [];

  let $sections = $();
  for (const sel of TEAM_SECTION_SELECTORS) {
    $sections = $(sel);
    if ($sections.length >= 2) break;
  }

  if ($sections.length < 2) {
    logSelectorMiss('parseSquadsPage:section', TEAM_SECTION_SELECTORS, url);
    return parseSinglePageSquads($, url);
  }

  $sections.each((_, section) => {
    const squad = parseTeamSection($, section, url);
    if (squad) squads.push(squad);
  });

  return squads;
}

function parseTeamSection(
  $: cheerio.CheerioAPI,
  section: AnyNode,
  _url: string
): TeamSquad | null {
  const $section = $(section);

  // Team name
  let name = '';
  for (const sel of TEAM_NAME_SELECTORS) {
    name = cleanText($section.find(sel).first().text());
    if (name) break;
  }
  if (!name) name = 'Unknown Team';

  // Check for Playing XI separator
  let $playingXIContainer = $section;
  let $benchContainer: cheerio.Cheerio<AnyNode> | null = null;

  for (const sel of PLAYING_XI_HEADER_SELECTORS) {
    const $xi = $section.find(sel).first();
    if ($xi.length) {
      $playingXIContainer = $xi.nextUntil('[class*="bench"], [class*="squad"]') as unknown as cheerio.Cheerio<AnyNode>;
      $benchContainer = $xi.nextAll('[class*="bench"], [class*="squad"]').first();
      break;
    }
  }

  // Parse player lists
  const playingXI = parsePlayers($, $playingXIContainer, 11);
  const bench = $benchContainer ? parsePlayers($, $benchContainer, 30) : parsePlayers($, $section, 25).slice(11);

  return {
    name,
    shortName: inferShortName(name),
    playingXI: playingXI.slice(0, 11),
    bench,
  };
}

function parsePlayers(
  $: cheerio.CheerioAPI,
  $container: cheerio.Cheerio<AnyNode>,
  limit: number
): PlayerEntry[] {
  const players: PlayerEntry[] = [];

  for (const sel of PLAYER_ITEM_SELECTORS) {
    const $items = $container.find(sel);
    if ($items.length === 0) continue;

    $items.toArray().forEach(item => {
      if (players.length >= limit) return;

      const $item = $(item);
      const text = cleanText($item.text());
      if (!text || text.length < 2) return;

      // Extract role and flags from badges/classes
      const cls = ($item.attr('class') || '') + ' ' + ($item.find('span').map((_, s) => $(s).text()).get().join(' '));
      const isCaptain = cls.includes('cap') || text.includes('(c)') || text.includes('(C)');
      const isWicketKeeper = cls.includes('wk') || text.includes('(wk)') || text.includes('(WK)');
      const isOverseas = cls.includes('overseas') || cls.includes('intl');

      const name = text.replace(/\s*\(c\)\s*/i, '').replace(/\s*\(wk\)\s*/i, '').trim();
      const roleText = cleanText($item.find('.cb-plyr-role, .cb-role, span.text-gray').text());

      players.push({
        name,
        role: inferRole(roleText),
        isCaptain,
        isWicketKeeper,
        isOverseas,
      });
    });

    if (players.length > 0) break;
  }

  return players;
}

function parseSinglePageSquads(
  $: cheerio.CheerioAPI,
  _url: string
): TeamSquad[] {
  // Fallback: look for player profile links
  const teams: Map<string, PlayerEntry[]> = new Map();

  $('a[href*="/profiles/"]').each((_, a) => {
    const name = cleanText($(a).text());
    if (!name || name.length < 3) return;

    // Try to find the team this player belongs to by closest ancestor
    const $parent = $(a).closest('[class*="team"], [class*="squad"]');
    const teamName = cleanText($parent.find('h2,h3,h4').first().text()) || 'Team';

    if (!teams.has(teamName)) teams.set(teamName, []);
    teams.get(teamName)!.push({
      name,
      role: 'unknown',
      isCaptain: false,
      isWicketKeeper: false,
      isOverseas: false,
    });
  });

  return Array.from(teams.entries()).map(([name, players]) => ({
    name,
    shortName: inferShortName(name),
    playingXI: players.slice(0, 11),
    bench: players.slice(11),
  }));
}
