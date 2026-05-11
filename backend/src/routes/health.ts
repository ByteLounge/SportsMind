import { Router, Request, Response, IRouter } from 'express';
import { config } from '../config';
import { cache } from '../utils/cache';
import { getSectionStats } from '../services/cricbuzzService';
import { HealthResponse } from '../types';

const router: IRouter = Router();
const startTime = Date.now();

router.get('/', (_req: Request, res: Response) => {
  const mem = process.memoryUsage();
  const body: HealthResponse = {
    ok: true,
    uptime: Math.round((Date.now() - startTime) / 1000),
    memoryMB: Math.round(mem.heapUsed / 1024 / 1024),
    cacheStats: cache.stats(),
    sections: getSectionStats(),
    providerMode: config.playwright.enabled ? 'playwright-fallback' : 'fetch-cheerio',
    parserVersion: config.parserVersion,
  };
  res.json(body);
});

export default router;
