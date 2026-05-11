import * as cheerio from 'cheerio';
import { HighlightCard } from '../types';
import { cleanText } from '../utils/normalizer';
import { logSelectorMiss } from '../utils/logger';

// ─── Selectors ────────────────────────────────────────────────────────────────

const CARD_SELECTORS = [
  '.cb-hlt-itm',
  '.cb-ltst-wgt-hdr',
  '.cb-video-itm',
  '.cb-col.cb-col-100[class*="video"]',
  '[class*="highlight"]',
];

const TITLE_SELECTORS = ['.cb-hlt-nm', '.cb-video-title', 'h3', 'h4', '.cb-col-60 a'];
const THUMB_SELECTORS = ['img[data-src]', 'img.cb-hlt-img', 'img'];
const CAT_SELECTORS = ['.cb-hlt-ctgry', '.cb-category', 'span.text-gray'];
const DUR_SELECTORS = ['.cb-hlt-dur', '.cb-duration', 'span[class*="dur"]'];

// ─── Parser ───────────────────────────────────────────────────────────────────

export function parseHighlightsPage(
  $: cheerio.CheerioAPI,
  url: string,
  _matchId: string
): HighlightCard[] {
  const cards: HighlightCard[] = [];

  let $items = $();
  for (const sel of CARD_SELECTORS) {
    $items = $(sel);
    if ($items.length > 0) break;
  }

  if ($items.length === 0) {
    logSelectorMiss('parseHighlightsPage:card', CARD_SELECTORS, url);
    // Fallback: any anchor with a video/highlight keyword
    return parseFlatHighlights($);
  }

  $items.each((_, item) => {
    const $item = $(item);

    // Title
    let title = '';
    for (const sel of TITLE_SELECTORS) {
      title = cleanText($item.find(sel).first().text());
      if (title) break;
    }
    if (!title) title = cleanText($item.text()).slice(0, 80);

    // URL — resolve relative hrefs
    const rawHref = $item.find('a').first().attr('href') || '';
    const itemUrl = rawHref.startsWith('http') ? rawHref
      : rawHref ? `https://www.cricbuzz.com${rawHref}` : '';

    // Thumbnail (metadata only — do NOT download/restream)
    let thumbnail: string | null = null;
    for (const sel of THUMB_SELECTORS) {
      const $img = $item.find(sel).first();
      thumbnail = $img.attr('data-src') || $img.attr('src') || null;
      if (thumbnail) break;
    }

    // Category
    let category: string | null = null;
    for (const sel of CAT_SELECTORS) {
      const c = cleanText($item.find(sel).first().text());
      if (c) { category = c; break; }
    }

    // Duration
    let durationText: string | null = null;
    for (const sel of DUR_SELECTORS) {
      const d = cleanText($item.find(sel).first().text());
      if (d && d.match(/\d+:\d+/)) { durationText = d; break; }
    }

    // Team tag (inferred from title)
    const IPL_TEAMS = ['CSK', 'MI', 'RCB', 'KKR', 'RR', 'SRH', 'PBKS', 'DC', 'LSG', 'GT'];
    let teamTag: string | null = null;
    for (const t of IPL_TEAMS) {
      if (title.includes(t)) { teamTag = t; break; }
    }

    if (title) {
      cards.push({ title, url: itemUrl, thumbnail, category, teamTag, durationText });
    }
  });

  return cards;
}

function parseFlatHighlights($: cheerio.CheerioAPI): HighlightCard[] {
  const cards: HighlightCard[] = [];

  $('a[href]').each((_, a) => {
    const href = $(a).attr('href') || '';
    const text = cleanText($(a).text());
    if (
      (href.includes('highlight') || href.includes('video')) &&
      text.length > 5
    ) {
      cards.push({
        title: text,
        url: href.startsWith('http') ? href : `https://www.cricbuzz.com${href}`,
        thumbnail: null,
        category: null,
        teamTag: null,
        durationText: null,
      });
    }
  });

  return cards.slice(0, 20);
}
