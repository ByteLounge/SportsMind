import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { config } from './config';
import { logger } from './utils/logger';

import liveRoutes from './routes/live';
import seriesRoutes from './routes/series';
import healthRoutes from './routes/health';

const app: express.Application = express();

// ─── Security & middleware ────────────────────────────────────────────────────

app.use(helmet());
app.use(cors({ origin: config.cors.origin, methods: ['GET'], allowedHeaders: ['Content-Type'] }));
app.use(compression());
app.use(express.json());

if (config.isDev) {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Global rate limiter — protect against hammering
app.use(rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: { code: 'RATE_LIMITED', message: 'Too many requests', section: 'global' } },
}));

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/api/live', liveRoutes);
app.use('/api/series', seriesRoutes);
app.use('/api/health', healthRoutes);

// ─── 404 ─────────────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Unknown endpoint', section: 'router' } });
});

// ─── Global error handler ─────────────────────────────────────────────────────

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { message: err.message, stack: err.stack });
  res.status(500).json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error', section: 'global' } });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(config.port, () => {
  logger.info(`cricketScrap running on http://localhost:${config.port}`, {
    env: config.nodeEnv,
    parserVersion: config.parserVersion,
    playwright: config.playwright.enabled,
  });
});

export default app;
