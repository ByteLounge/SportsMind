import { Request, Response } from 'express';
import * as svc from '../services/cricbuzzService';
import { BATTING_STAT_TYPES, BOWLING_STAT_TYPES, SeriesStatType } from '../types';

function requireSlug(req: Request): string {
  return (req.query.slug as string) || req.params.slug || '';
}

// ─── GET /api/series/:seriesId/points-table ───────────────────────────────────

export async function getSeriesTable(req: Request, res: Response): Promise<void> {
  const { seriesId } = req.params;
  const slug = requireSlug(req);

  if (!slug) {
    res.status(400).json({
      ok: false,
      error: { code: 'MISSING_SLUG', message: 'Pass ?slug=<series-slug>', section: 'request' }
    });
    return;
  }

  const result = await svc.getSeriesTable(seriesId, slug);
  res.status(result.ok ? 200 : 502).json(result);
}

// ─── GET /api/series/:seriesId/squads ────────────────────────────────────────

export async function getSeriesSquads(req: Request, res: Response): Promise<void> {
  const { seriesId } = req.params;
  const slug = requireSlug(req);

  if (!slug) {
    res.status(400).json({
      ok: false,
      error: { code: 'MISSING_SLUG', message: 'Pass ?slug=<series-slug>', section: 'request' }
    });
    return;
  }

  const result = await svc.getSeriesSquads(seriesId, slug);
  res.status(result.ok ? 200 : 502).json(result);
}

// ─── GET /api/series/:seriesId/stats/:statType ────────────────────────────────

const VALID_STAT_TYPES = new Set<string>([...BATTING_STAT_TYPES, ...BOWLING_STAT_TYPES]);

export async function getSeriesStats(req: Request, res: Response): Promise<void> {
  const { seriesId, statType } = req.params;

  if (!VALID_STAT_TYPES.has(statType)) {
    res.status(400).json({
      ok: false,
      error: {
        code: 'INVALID_STAT_TYPE',
        message: `Unknown statType "${statType}". Valid values: ${[...VALID_STAT_TYPES].join(', ')}`,
        section: 'request',
      },
    });
    return;
  }

  const result = await svc.getSeriesStats(seriesId, statType as SeriesStatType);
  res.status(result.ok ? 200 : 502).json(result);
}
