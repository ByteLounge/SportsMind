import { Request, Response } from 'express';
import * as svc from '../services/cricbuzzService';
import { computeDelta, storeSnapshot } from '../utils/delta';
import { MatchWidget } from '../types';

function requireSlug(req: Request): string {
  return (req.query.slug as string) || req.params.slug || '';
}

// ─── GET /api/live ────────────────────────────────────────────────────────────

export async function getLiveMatches(req: Request, res: Response): Promise<void> {
  const series = req.query.series as string | undefined;
  const team = req.query.team as string | undefined;
  const status = req.query.status as string | undefined;

  const result = await svc.getLiveMatches({ series, team, status });
  res.status(result.ok ? 200 : 502).json(result);
}

// ─── GET /api/live/upcoming ───────────────────────────────────────────────────

export async function getUpcomingMatches(req: Request, res: Response): Promise<void> {
  const series = req.query.series as string | undefined;
  const team = req.query.team as string | undefined;
  const status = req.query.status as string | undefined;

  const result = await svc.getUpcomingMatches({ series, team, status });
  res.status(result.ok ? 200 : 502).json(result);
}

// ─── GET /api/live/recent ─────────────────────────────────────────────────────

export async function getRecentMatches(req: Request, res: Response): Promise<void> {
  const series = req.query.series as string | undefined;
  const team = req.query.team as string | undefined;
  const status = req.query.status as string | undefined;

  const result = await svc.getRecentMatches({ series, team, status });
  res.status(result.ok ? 200 : 502).json(result);
}

// ─── GET /api/live/:matchId ───────────────────────────────────────────────────

export async function getMatchLive(req: Request, res: Response): Promise<void> {
  const { matchId } = req.params;
  const slug = requireSlug(req);

  if (!slug) {
    res.status(400).json({ ok: false, error: { code: 'MISSING_SLUG', message: 'Pass ?slug=<match-slug> or provide it in the URL', section: 'request' } });
    return;
  }

  const result = await svc.getMatchLive(matchId, slug);

  // Compute delta against previous snapshot
  if (result.ok && result.data) {
    const delta = computeDelta(matchId, result.data);
    res.status(200).json({ ...result, delta });
  } else {
    res.status(result.ok ? 200 : 502).json(result);
  }
}

// ─── GET /api/live/:matchId/scorecard ─────────────────────────────────────────

export async function getScorecard(req: Request, res: Response): Promise<void> {
  const { matchId } = req.params;
  const slug = requireSlug(req);
  if (!slug) { res.status(400).json({ ok: false, error: { code: 'MISSING_SLUG', message: 'Pass ?slug=<match-slug>', section: 'request' } }); return; }
  const result = await svc.getScorecard(matchId, slug);
  res.status(result.ok ? 200 : 502).json(result);
}

// ─── GET /api/live/:matchId/commentary ────────────────────────────────────────

export async function getCommentary(req: Request, res: Response): Promise<void> {
  const { matchId } = req.params;
  const slug = requireSlug(req);
  const full = req.query.full === 'true';

  if (!slug) { res.status(400).json({ ok: false, error: { code: 'MISSING_SLUG', message: 'Pass ?slug=<match-slug>', section: 'request' } }); return; }
  const result = await svc.getCommentary(matchId, slug, full);
  res.status(result.ok ? 200 : 502).json(result);
}

// ─── GET /api/live/:matchId/squads ────────────────────────────────────────────

export async function getSquads(req: Request, res: Response): Promise<void> {
  const { matchId } = req.params;
  const slug = requireSlug(req);
  if (!slug) { res.status(400).json({ ok: false, error: { code: 'MISSING_SLUG', message: 'Pass ?slug=<match-slug>', section: 'request' } }); return; }
  const result = await svc.getSquads(matchId, slug);
  res.status(result.ok ? 200 : 502).json(result);
}

// ─── GET /api/live/:matchId/highlights ────────────────────────────────────────

export async function getHighlights(req: Request, res: Response): Promise<void> {
  const { matchId } = req.params;
  const slug = requireSlug(req);
  if (!slug) { res.status(400).json({ ok: false, error: { code: 'MISSING_SLUG', message: 'Pass ?slug=<match-slug>', section: 'request' } }); return; }
  const result = await svc.getHighlights(matchId, slug);
  res.status(result.ok ? 200 : 502).json(result);
}

// ─── GET /api/live/:matchId/widget ────────────────────────────────────────────
/** Compact widget shape for frontend cards */
export async function getMatchWidget(req: Request, res: Response): Promise<void> {
  const { matchId } = req.params;
  const slug = requireSlug(req);
  if (!slug) { res.status(400).json({ ok: false, error: { code: 'MISSING_SLUG', message: 'Pass ?slug=<match-slug>', section: 'request' } }); return; }

  const result = await svc.getMatchLive(matchId, slug);

  if (!result.ok || !result.data) {
    res.status(502).json({ ok: false, error: result.error });
    return;
  }

  const d = result.data;
  const widget: MatchWidget = {
    matchId,
    title: d.title,
    statusText: d.statusText,
    state: d.state,
    team1: {
      name: d.title.split(' vs ')[0]?.trim() || 'Team 1',
      shortName: d.title.split(' vs ')[0]?.trim().slice(0, 3).toUpperCase() || 'TM1',
      score: d.inningsSummary?.match(/^[^:]+:\s*([\d-]+)/)?.[1] ?? null,
      overs: d.inningsSummary?.match(/\(([\d.]+)\)/)?.[1] ?? null,
    },
    team2: {
      name: d.title.split(' vs ')[1]?.trim() || 'Team 2',
      shortName: d.title.split(' vs ')[1]?.trim().slice(0, 3).toUpperCase() || 'TM2',
      score: null,
      overs: null,
    },
    derived: d.derived,
    links: {
      live: `https://www.cricbuzz.com/live-cricket-scores/${matchId}/${slug}`,
      scorecard: `https://www.cricbuzz.com/live-cricket-scorecard/${matchId}/${slug}`,
      commentary: `https://www.cricbuzz.com/live-cricket-full-commentary/${matchId}/${slug}`,
      squads: `https://www.cricbuzz.com/cricket-match-squads/${matchId}/${slug}`,
      highlights: `https://www.cricbuzz.com/cricket-match-highlights/${matchId}/${slug}`,
    },
  };

  res.json({ ok: true, widget });
}

// ─── GET /api/live/:matchId/delta ─────────────────────────────────────────────

export async function getMatchDelta(req: Request, res: Response): Promise<void> {
  const { matchId } = req.params;
  const slug = requireSlug(req);
  if (!slug) { res.status(400).json({ ok: false, error: 'Missing slug' }); return; }

  const result = await svc.getMatchLive(matchId, slug);
  if (!result.ok || !result.data) {
    res.status(502).json({ ok: false, error: result.error }); return;
  }

  const delta = computeDelta(matchId, result.data);
  storeSnapshot(matchId, result.data);
  res.json({ ok: true, delta });
}
