import { Router, IRouter } from 'express';
import * as ctrl from '../controllers/seriesController';

const router: IRouter = Router();

router.get('/:seriesId/points-table', ctrl.getSeriesTable);
router.get('/:seriesId/squads', ctrl.getSeriesSquads);
router.get('/:seriesId/stats/:statType', ctrl.getSeriesStats);

export default router;
