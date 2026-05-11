import { Router, IRouter } from 'express';
import * as ctrl from '../controllers/liveController';
import * as graphs from '../controllers/graphsController';

const router: IRouter = Router();

// List all live matches (with optional filters)
router.get('/', ctrl.getLiveMatches);

// Upcoming and Recent matches
router.get('/upcoming', ctrl.getUpcomingMatches);
router.get('/recent', ctrl.getRecentMatches);

// Match-level endpoints — slug required via ?slug= or URL segment
router.get('/:matchId', ctrl.getMatchLive);
router.get('/:matchId/scorecard', ctrl.getScorecard);
router.get('/:matchId/commentary', ctrl.getCommentary);
router.get('/:matchId/squads', ctrl.getSquads);
router.get('/:matchId/highlights', ctrl.getHighlights);
router.get('/:matchId/widget', ctrl.getMatchWidget);
router.get('/:matchId/delta', ctrl.getMatchDelta);

// Innings highlights (JSON API — key moments per innings)
router.get('/:matchId/highlights/:inningsId', graphs.getInningsHighlights);

// Graph endpoints
router.get('/:matchId/graphs/balls-map', graphs.getBallMap);
router.get('/:matchId/graphs/partnerships', graphs.getPartnerships);
router.get('/:matchId/graphs/worm', graphs.getWorm);
router.get('/:matchId/graphs/overs', graphs.getOvers);
router.get('/:matchId/graphs/run-rate', graphs.getRunRate);
router.get('/:matchId/graphs/win-probability', graphs.getWinProbability);

export default router;
