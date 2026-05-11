import axios, { AxiosError } from 'axios';
import Bottleneck from 'bottleneck';
import * as cheerio from 'cheerio';
import { config } from '../config';
import { logger } from '../utils/logger';

// ─── Rate limiter — max CONCURRENCY_CAP concurrent requests ──────────────────

const limiter = new Bottleneck({
  maxConcurrent: config.fetch.concurrencyCap,
  minTime: 400, // minimum ms between jobs
});

// ─── Axios instance ───────────────────────────────────────────────────────────

const http = axios.create({
  baseURL: config.cricbuzz.baseUrl,
  timeout: config.fetch.timeoutMs,
  headers: {
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    Referer: 'https://www.google.com/',
  },
});

function randomUA(): string {
  const uas = config.cricbuzz.userAgents;
  return uas[Math.floor(Math.random() * uas.length)];
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Core fetch with retries ──────────────────────────────────────────────────

async function fetchHtml(path: string): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= config.fetch.retries; attempt++) {
    try {
      const response = await limiter.schedule(() =>
        http.get(path, {
          headers: { 'User-Agent': randomUA() },
        })
      );
      return response.data as string;
    } catch (err) {
      lastError = err as Error;
      const status = (err as AxiosError).response?.status;
      logger.warn(`Fetch attempt ${attempt + 1} failed`, {
        path,
        status,
        message: (err as Error).message,
      });

      // Don't retry on 404 or 403
      if (status === 404 || status === 403) break;

      if (attempt < config.fetch.retries) {
        await sleep(config.fetch.retryDelayMs * (attempt + 1));
      }
    }
  }

  throw lastError ?? new Error(`Failed to fetch: ${path}`);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface FetchResult {
  $: cheerio.CheerioAPI;
  html: string;
  url: string;
  fetchedAt: number;
}

/** Fetch a Cricbuzz page and return a Cheerio instance */
export async function fetchPage(path: string): Promise<FetchResult> {
  const fullUrl = path.startsWith('http') ? path : `${config.cricbuzz.baseUrl}${path}`;
  const urlPath = path.startsWith('http') ? new URL(path).pathname : path;

  logger.debug('Fetching page', { urlPath });
  const html = await fetchHtml(urlPath);
  const $ = cheerio.load(html);

  return { $, html, url: fullUrl, fetchedAt: Date.now() };
}

/** Extract embedded JSON from <script> tags (Cricbuzz sometimes embeds state) */
export function extractScriptJson(html: string, varName: string): unknown | null {
  const patterns = [
    new RegExp(`window\\.${varName}\\s*=\\s*({[\\s\\S]*?});`, 'm'),
    new RegExp(`${varName}\\s*=\\s*({[\\s\\S]*?});`, 'm'),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch {
        // continue
      }
    }
  }
  return null;
}

// ─── JSON API fetch (Cricbuzz internal endpoints) ────────────────────────────

const jsonHttp = axios.create({
  baseURL: config.cricbuzz.baseUrl,
  timeout: config.fetch.timeoutMs,
  headers: {
    Accept: 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    Referer: 'https://www.cricbuzz.com/',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

/** Fetch a Cricbuzz internal JSON API endpoint */
export async function fetchJson<T = unknown>(path: string): Promise<T> {
  const response = await limiter.schedule(() =>
    jsonHttp.get<T>(path, { headers: { 'User-Agent': randomUA() } })
  );
  return response.data;
}

// ─── Optional Playwright fallback ─────────────────────────────────────────────

export async function fetchPageWithPlaywright(path: string, waitSelector?: string): Promise<FetchResult> {
  if (!config.playwright.enabled) {
    throw new Error('Playwright fallback is disabled. Set USE_PLAYWRIGHT_FALLBACK=true to enable.');
  }

  try {
    // Dynamic import — Playwright is optional peer dependency
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { chromium } = require('playwright') as typeof import('playwright');

    const browser = await chromium.launch({ 
      headless: true,
      args: ['--disable-blink-features=AutomationControlled']
    });
    const ctx = await browser.newContext({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1',
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      locale: 'en-US',
      colorScheme: 'light',
    });

    // Mask webdriver
    await ctx.addInitScript('Object.defineProperty(navigator, "webdriver", { get: () => undefined })');

    const page = await ctx.newPage();

    // Randomize extra headers to look more like a real browser
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9',
      'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
    });

    const fullUrl = path.startsWith('http') ? path : `${config.cricbuzz.baseUrl}${path}`;
    logger.debug('Navigating with Playwright', { fullUrl });
    
    // Use networkidle0-like wait if possible, or just wait longer
    await page.goto(fullUrl, { waitUntil: 'load', timeout: 60000 });

    if (waitSelector) {
      logger.debug('Waiting for selector', { waitSelector });
      // Wait for the selector to be visible
      await page.waitForSelector(waitSelector, { state: 'attached', timeout: 20000 }).catch(() => {
        logger.warn('Playwright wait timeout', { path, waitSelector });
      });
      // Small sleep to allow for rendering after element is attached
      await page.waitForTimeout(2000);
    }

    const html = await page.content();
    await browser.close();

    const $ = cheerio.load(html);
    return { $, html, url: fullUrl, fetchedAt: Date.now() };
  } catch (err) {
    logger.error('Playwright fallback failed', { path, error: (err as Error).message });
    throw err;
  }
}

/** Auto-select fetch method — use Playwright only if static fetch yields empty content */
export async function smartFetch(path: string, checkSelector: string): Promise<FetchResult> {
  const result = await fetchPage(path);
  const hasContent = result.$(checkSelector).length > 0;

  if (!hasContent && config.playwright.enabled) {
    logger.info('Static fetch yielded empty content, trying Playwright', { path, checkSelector });
    return fetchPageWithPlaywright(path, checkSelector);
  }

  return result;
}
