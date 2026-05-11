import { Request, Response } from 'express';
import * as svc from '../services/cricbuzzService';

// ─── GET /api/live/:matchId/graphs/balls-map?innings=1 ───────────────────────

export async function getBallMap(req: Request, res: Response): Promise<void> {
  const { matchId } = req.params;
  const inningsId = parseInt(req.query.innings as string, 10);

  if (!inningsId || inningsId < 1 || inningsId > 2) {
    res.status(400).json({
      ok: false,
      error: { code: 'INVALID_INNINGS', message: 'Pass ?innings=1 or ?innings=2', section: 'request' },
    });
    return;
  }

  const result = await svc.getBallMap(matchId, inningsId);
  res.status(result.ok ? 200 : 502).json(result);
}

// ─── GET /api/live/:matchId/graphs/partnerships ──────────────────────────────

export async function getPartnerships(req: Request, res: Response): Promise<void> {
  const { matchId } = req.params;
  const result = await svc.getPartnershipGraph(matchId);
  res.status(result.ok ? 200 : 502).json(result);
}

// ─── GET /api/live/:matchId/graphs/worm ──────────────────────────────────────

export async function getWorm(req: Request, res: Response): Promise<void> {
  const { matchId } = req.params;
  const result = await svc.getWormGraph(matchId);
  res.status(result.ok ? 200 : 502).json(result);
}

// ─── GET /api/live/:matchId/graphs/overs ─────────────────────────────────────

export async function getOvers(req: Request, res: Response): Promise<void> {
  const { matchId } = req.params;
  const result = await svc.getOversGraph(matchId);
  res.status(result.ok ? 200 : 502).json(result);
}

// ─── GET /api/live/:matchId/graphs/run-rate ──────────────────────────────────

export async function getRunRate(req: Request, res: Response): Promise<void> {
  const { matchId } = req.params;
  const result = await svc.getRunRateGraph(matchId);
  res.status(result.ok ? 200 : 502).json(result);
}

// ─── GET /api/live/:matchId/graphs/win-probability ───────────────────────────

export async function getWinProbability(req: Request, res: Response): Promise<void> {
  const { matchId } = req.params;
  const result = await svc.getWinProbability(matchId);
  res.status(result.ok ? 200 : 502).json(result);
}

// ─── GET /api/live/:matchId/highlights/:inningsId ────────────────────────────

export async function getInningsHighlights(req: Request, res: Response): Promise<void> {
  const { matchId, inningsId } = req.params;
  const id = parseInt(inningsId, 10);

  if (!id || id < 1 || id > 2) {
    res.status(400).json({
      ok: false,
      error: { code: 'INVALID_INNINGS', message: 'inningsId must be 1 or 2', section: 'request' },
    });
    return;
  }

  const result = await svc.getInningsHighlights(matchId, id);
  res.status(result.ok ? 200 : 502).json(result);
}
