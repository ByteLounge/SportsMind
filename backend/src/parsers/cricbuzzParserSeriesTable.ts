import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import { StandingsRow } from '../types';
import { cleanText, safeInt } from '../utils/normalizer';
import { logSelectorMiss } from '../utils/logger';
import { findJsonValue } from '../utils/rsc';

// ─── Selectors ────────────────────────────────────────────────────────────────

const TABLE_SELECTORS = [
  'table.cb-srs-pnts',
  'table[class*="points"]',
  '.cb-pnts-tbl table',
  '.cb-srs-pnts-table',
  'table',
];

const SERIES_NAME_SELECTORS = [
  'h1.cb-nav-hdr',
  'h2.cb-srs-name',
  '.cb-lv-main-hdr h1',
  'h1',
  'title',
];

const FORM_ITEM_SELECTORS = [
  '.cb-frm-itm',
  'span[class*="form"]',
  '.cb-col-4',
  '.cb-pnts-form',
];

// ─── Parser ───────────────────────────────────────────────────────────────────

export function parseSeriesTablePage(
  $: cheerio.CheerioAPI,
  url: string,
  seriesId: string
): { seriesName: string | null; rows: StandingsRow[] } {
  const html = $.html();
  
  // 1. Try RSC / JSON extraction first — more reliable for Next.js site
  const jsonData = findJsonValue(html, 'pointsTable') || findJsonValue(html, 'standings');
  if (jsonData && typeof jsonData === 'object') {
     try {
       const rows = parsePointsTableJson(jsonData);
       if (rows.length > 0) {
         let seriesName: string | null = null;
         for (const sel of SERIES_NAME_SELECTORS) {
           const t = cleanText($(sel).first().text());
           if (t && t.length > 3) { seriesName = t.replace(/\s+points.table/i, '').trim(); break; }
         }
         return { seriesName, rows };
       }
     } catch (e) {
       // fallback to HTML
     }
  }

  // 2. Existing HTML-based parsing
  let seriesName: string | null = null;
  for (const sel of SERIES_NAME_SELECTORS) {
    const t = cleanText($(sel).first().text());
    if (t && t.length > 3) { seriesName = t.replace(/\s+points.table/i, '').trim(); break; }
  }

  const rows: StandingsRow[] = [];

  let $table: cheerio.Cheerio<AnyNode> | null = null;
  for (const sel of TABLE_SELECTORS) {
    const $t = $(sel).first();
    if ($t.length) { 
      $table = $t; 
      break; 
    }
  }

  if (!$table) {
    logSelectorMiss('parseSeriesTablePage:table', TABLE_SELECTORS, url);
    return { seriesName, rows };
  }

  // Identify column order from header row
  const headers: string[] = [];
  $table.find('thead tr th, tr.cb-srs-pnts-hdr th, tr.cb-srs-pnts-th th, tr:first-child th, tr:first-child td').each((_, th) => {
    headers.push(cleanText($(th).text()).toLowerCase());
  });

  const colMap = buildColMap(headers);

  let rank = 0;
  $table.find('tbody tr, tr:not(:first-child)').each((_, row) => {
    const $row = $(row);
    const cols = $row.find('td').map((_, td) => cleanText($(td).text())).get();

    if (cols.length < 3) return;

    // First column often has "1 RCB" or just "RCB"
    let teamName = cleanText($row.find('td:first-child, .cb-srs-pnts-tm, .cb-srs-pnts-name').first().text());
    if (!teamName || teamName.toLowerCase() === 'team') return;

    // Strip leading rank if it's there (e.g. "1 RCB" -> "RCB")
    teamName = teamName.replace(/^\d+\s+/, '').replace(/\s*\(E\)$/, '').trim();

    rank++;

    // Form indicators (W/L dots)
    const form: string[] = [];
    for (const sel of FORM_ITEM_SELECTORS) {
      $row.find(sel).each((_, el) => {
        const cls = $(el).attr('class') || '';
        const t = cleanText($(el).text());
        if (cls.includes('win') || t === 'W') form.push('W');
        else if (cls.includes('loss') || t === 'L') form.push('L');
        else if (t === 'NR') form.push('NR');
      });
      if (form.length > 0) break;
    }

    rows.push({
      rank,
      team: teamName,
      played: safeInt(col(cols, colMap, 'm', 'p')) ?? 0,
      wins: safeInt(col(cols, colMap, 'w', 'won')) ?? 0,
      losses: safeInt(col(cols, colMap, 'l', 'lost', 'loss')) ?? 0,
      ties: safeInt(col(cols, colMap, 't', 'tie')) ?? 0,
      noResult: safeInt(col(cols, colMap, 'nr', 'n/r')) ?? 0,
      points: safeInt(col(cols, colMap, 'pts', 'pt', 'points')) ?? 0,
      nrr: col(cols, colMap, 'nrr', 'rr') ?? '0.000',
      form,
    });
  });

  return { seriesName, rows };
}

function buildColMap(headers: string[]): Map<string, number> {
  const map = new Map<string, number>();
  headers.forEach((h, i) => map.set(h, i));
  return map;
}

function col(cols: string[], map: Map<string, number>, ...keys: string[]): string | null {
  for (const key of keys) {
    const idx = map.get(key);
    if (idx !== undefined && cols[idx] !== undefined) return cols[idx];
  }
  // Fallback: search by value position
  return null;
}

/** Robustly parse points table JSON from RSC payload */
function parsePointsTableJson(data: any): StandingsRow[] {
  const rows: StandingsRow[] = [];
  
  // Cricbuzz JSON structure: can be a flat list or nested in pointsTable
  const list = Array.isArray(data) ? data : (data.pointsTable || data.standings || data.pointsTableInfo || []);
  
  if (!Array.isArray(list)) return rows;

  const processTable = (tableInfo: any[], teamIdKey?: string) => {
    tableInfo.forEach((item, idx) => {
      const team = item.teamName || item.team || item.name || item.teamFullName || 'Unknown';
      const teamId = item.teamId || item.id;
      
      // Derive form from teamMatches if available
      let form: string[] = [];
      if (Array.isArray(item.teamMatches)) {
         // Filter for completed matches, sort by date (descending), take last 5
         const sortedMatches = [...item.teamMatches]
           .filter((m: any) => m.winner && (m.result || m.status))
           .sort((a: any, b: any) => (b.startdt || 0) - (a.startdt || 0));
         
         form = sortedMatches.slice(0, 5).map((m: any) => {
           const winnerId = Number(m.winner);
           if (!winnerId) return 'NR';
           return winnerId === Number(teamId) ? 'W' : 'L';
         });
      } else if (Array.isArray(item.form)) {
         form = item.form;
      }

      rows.push({
        rank: item.rank || (idx + 1),
        team,
        played: item.matchesPlayed ?? item.played ?? item.p ?? 0,
        wins: item.matchesWon ?? item.won ?? item.w ?? 0,
        losses: item.matchesLost ?? item.lost ?? item.l ?? 0,
        ties: item.matchesTied ?? item.tied ?? item.t ?? 0,
        noResult: item.noRes ?? item.noResult ?? item.nr ?? 0,
        points: item.points ?? item.pts ?? 0,
        nrr: String(item.nrr ?? item.netRunRate ?? item.rr ?? '0.000'),
        form,
      });
    });
  };

  list.forEach(group => {
    if (group.pointsTableInfo && Array.isArray(group.pointsTableInfo)) {
      processTable(group.pointsTableInfo);
    } else if (typeof group === 'object' && group !== null) {
      if (group.teamName || group.team || group.teamFullName) {
        processTable([group]);
      }
    }
  });

  return rows;
}
