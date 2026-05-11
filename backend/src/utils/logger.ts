import winston from 'winston';
import { config } from '../config';

export const logger = winston.createLogger({
  level: config.log.level,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    config.isDev
      ? winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
            return `${timestamp} [${level}] ${message}${metaStr}`;
          })
        )
      : winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

/** Log a selector miss — only in debug mode */
export function logSelectorMiss(section: string, selectors: string[], url: string): void {
  if (!config.log.selectorMisses) return;
  logger.debug('Selector miss', { section, selectors, url });
}
