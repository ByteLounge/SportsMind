import * as cheerio from 'cheerio';
import { CommentaryBlock, OverSummary, CricbuzzApiCommentary } from '../types';
import { cleanText } from '../utils/normalizer';
import { logSelectorMiss } from '../utils/logger';
import { findJsonValue } from '../utils/rsc';

// ─── Selectors ────────────────────────────────────────────────────────────────

// ... selectors ...

// ─── JSON Parser ──────────────────────────────────────────────────────────────

export function parseCommentaryApi(
  json: CricbuzzApiCommentary,
  _matchId: string
): {
  blocks: CommentaryBlock[];
  overSummaries: OverSummary[];
  inningsTab: string;
  previewText: string | null;
} {
  const blocks: CommentaryBlock[] = [];
  const overSummaries: OverSummary[] = [];

  const commMap = json.matchCommentary || {};
  const entries = Object.values(commMap).sort((a, b) => b.timestamp - a.timestamp);

  for (const entry of entries) {
    if (entry.commType === 'commentary' && entry.commText) {
      // Over/ball from overNumber
      const overNum = entry.overNumber ? Math.floor(entry.overNumber) : 0;
      const ballNum = entry.overNumber ? Math.round((entry.overNumber % 1) * 10) : 0;

      blocks.push({
        over: overNum > 0 ? String(overNum) : '',
        ball: ballNum > 0 ? String(ballNum) : '',
        event: entry.event && entry.event.length > 0 ? entry.event[0].toLowerCase() as any : 'other',
        text: entry.commText,
        score: null,
      });
    }

    if (entry.overSeparator) {
      const sep = entry.overSeparator;
      overSummaries.push({
        over: sep.overNum,
        runs: sep.runs,
        wickets: sep.wickets,
        balls: (sep.recentOvsStats || '').split(/\s+/).filter(Boolean),
        text: `${sep.batTeamName}: ${sep.score}/${sep.wicketsFallen} (${sep.overNum} ov)`,
      });
    }
  }

  return {
    blocks,
    overSummaries,
    inningsTab: entries.length > 0 ? `${entries[0].inningsId === 1 ? '1st' : '2nd'} Innings` : '1st Innings',
    previewText: null,
  };
}

/** Parse commentary from embedded RSC data in HTML */
function parseCommentaryRsc(html: string): ReturnType<typeof parseCommentaryPage> | null {
  const data = findJsonValue(html, 'matchPreviewFullComm') as any;
  if (!data || !Array.isArray(data.commentary)) return null;

  const blocks: CommentaryBlock[] = [];
  const overSummaries: OverSummary[] = [];
  let inningsTab = '1st Innings';

  // Process all innings in order
  data.commentary.forEach((inn: any) => {
    if (inn.inningsId > 0) inningsTab = `${inn.inningsId}${inn.inningsId === 1 ? 'st' : inn.inningsId === 2 ? 'nd' : inn.inningsId === 3 ? 'rd' : 'th'} Innings`;
    
    if (Array.isArray(inn.commentaryList)) {
      inn.commentaryList.forEach((entry: any) => {
        if (entry.commText) {
          const overNum = entry.overNumber ? Math.floor(entry.overNumber) : 0;
          const ballNum = entry.overNumber ? Math.round((entry.overNumber % 1) * 10) : 0;

          blocks.push({
            over: overNum > 0 ? String(overNum) : '',
            ball: ballNum > 0 ? String(ballNum) : '',
            event: entry.event ? entry.event.toLowerCase() as any : 'other',
            text: entry.commText,
            score: entry.batTeamScore > 0 ? String(entry.batTeamScore) : null,
          });
        }

        if (entry.overSeparator) {
          const sep = entry.overSeparator;
          overSummaries.push({
            over: sep.overNum,
            runs: sep.runs,
            wickets: sep.wickets,
            balls: (sep.recentOvsStats || '').split(/\s+/).filter(Boolean),
            text: `${sep.batTeamName}: ${sep.score}/${sep.wicketsFallen} (${sep.overNum} ov)`,
          });
        }
      });
    }
  });

  return { blocks, overSummaries, inningsTab, previewText: null };
}

// ─── Event classification ─────────────────────────────────────────────────────

const COMMENTARY_BLOCK_SELECTORS = [
  '.cb-col.cb-col-100.cb-font-13.cb-commentary-lv',
  '.cb-com-ln',
  '.cb-col-100.cb-comm-row',
  '[class*="commentary"]',
];

const OVER_SUMMARY_SELECTORS = [
  '.cb-col.cb-col-100.cb-over-smry',
  '.cb-ovr-smry',
  '.cb-col-100.cb-over-row',
];

const OVER_BALL_SELECTORS = [
  '.cb-col.cb-col-8.cb-ball-txt-srk',
  '.cb-ball-txt-srk',
  'span[class*="ball"]',
];

const INNINGS_TAB_SELECTORS = ['.cb-scrd-lnk', '.cb-comm-tab', 'a[href*="innings"]'];

// ─── Event classification ─────────────────────────────────────────────────────

function classifyEvent(text: string, cls: string): CommentaryBlock['event'] {
  const t = text.toLowerCase();
  const c = cls.toLowerCase();

  if (c.includes('wicket') || c.includes('out') || t.includes('out!') || t.includes('wicket')) return 'wicket';
  if (c.includes('six') || t.includes('six!') || t.includes('sixer')) return 'boundary_6';
  if (c.includes('four') || t.includes('four!') || t.match(/boundary/)) return 'boundary_4';
  if (t.match(/^0\.?\s*$/) || t.includes('dot ball') || t.includes('no run')) return 'dot';
  if (t.includes('wide') || t.includes('no ball') || t.includes('bye')) return 'extra';
  if (t.includes('end of over') || c.includes('ovr-end')) return 'over_end';
  if (t.match(/^\d+\s*run/)) return 'run';
  return 'other';
}

// ─── Parser ───────────────────────────────────────────────────────────────────

export function parseCommentaryPage(
  $: cheerio.CheerioAPI,
  url: string,
  _matchId: string
): {
  blocks: CommentaryBlock[];
  overSummaries: OverSummary[];
  inningsTab: string;
  previewText: string | null;
} {
  const blocks: CommentaryBlock[] = [];
  const overSummaries: OverSummary[] = [];

  // ── Innings tab (which innings is displayed) ──
  let inningsTab = '1st Innings';
  for (const sel of INNINGS_TAB_SELECTORS) {
    const $active = $(sel).filter('.cb-active, .active, [aria-selected="true"]').first();
    if ($active.length) { inningsTab = cleanText($active.text()); break; }
  }

  // ── Preview text (match preview / toss info) ──
  const previewSelectors = ['.cb-preview-txt', '.cb-mtch-prvw', '.cb-pre-txt', 'div.cb-col-67 > p'];
  let previewText: string | null = null;
  for (const sel of previewSelectors) {
    const t = cleanText($(sel).first().text());
    if (t && t.length > 20) { previewText = t.slice(0, 400); break; }
  }

  // ─── Commentary blocks ──
  let $blocks = $();
  for (const sel of COMMENTARY_BLOCK_SELECTORS) {
    $blocks = $(sel);
    if ($blocks.length > 0) break;
  }

  if ($blocks.length === 0) {
    // Try RSC/JSON extraction
    const rscData = parseCommentaryRsc($.html());
    if (rscData && rscData.blocks.length > 0) {
      return { ...rscData, previewText: previewText || rscData.previewText };
    }
    logSelectorMiss('parseCommentaryPage:block', COMMENTARY_BLOCK_SELECTORS, url);
  }

  $blocks.each((_, el) => {
    const $el = $(el);
    const cls = $el.attr('class') || '';
    const text = cleanText($el.text());

    if (!text || text.length < 3) return;

    // Extract over.ball notation — "18.4" or "Over 18"
    const overBallMatch = text.match(/^(\d+)\.(\d)/);
    const over = overBallMatch ? overBallMatch[1] : '';
    const ball = overBallMatch ? overBallMatch[2] : '';

    // Extract inline score — "156-5"
    const scoreMatch = text.match(/(\d+-\d+)/);
    const score = scoreMatch ? scoreMatch[1] : null;

    blocks.push({
      over,
      ball,
      event: classifyEvent(text, cls),
      text: text.slice(0, 500),
      score,
    });
  });

  // ── Over summaries ──
  let $overRows = $();
  for (const sel of OVER_SUMMARY_SELECTORS) {
    $overRows = $(sel);
    if ($overRows.length > 0) break;
  }

  $overRows.each((_, el) => {
    const $el = $(el);

    // Extract over number
    const overText = cleanText($el.find('.cb-col.cb-col-8, span').first().text());
    const overNum = parseInt(overText.replace(/\D/g, ''), 10);
    if (isNaN(overNum)) return;

    // Ball markers (colored icons)
    const balls: string[] = [];
    for (const sel of OVER_BALL_SELECTORS) {
      $el.find(sel).each((_, b) => {
        const v = cleanText($(b).text());
        if (v) balls.push(v);
      });
      if (balls.length > 0) break;
    }

    // Run total for over
    const overTotal = balls.reduce((sum, b) => {
      if (b === 'W' || b === '' || b === 'Wd' || b === 'Nb') return sum;
      return sum + (parseInt(b, 10) || 0);
    }, 0);

    const wickets = balls.filter(b => b === 'W').length;

    overSummaries.push({
      over: overNum,
      runs: overTotal,
      wickets,
      balls,
      text: cleanText($el.text()),
    });
  });

  return { blocks, overSummaries, inningsTab, previewText };
}
