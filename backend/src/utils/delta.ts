import { LiveMatchDetail, MatchDelta, RecentBall } from '../types';

const _snapshots = new Map<string, { data: LiveMatchDetail; timestamp: number }>();

/** Store snapshot for delta comparison */
export function storeSnapshot(matchId: string, data: LiveMatchDetail): void {
  _snapshots.set(matchId, { data, timestamp: Date.now() });
}

/** Compare current match state against stored snapshot */
export function computeDelta(matchId: string, current: LiveMatchDetail): MatchDelta {
  const prev = _snapshots.get(matchId);
  const timestamp = new Date().toISOString();

  if (!prev) {
    storeSnapshot(matchId, current);
    return {
      matchId,
      timestamp,
      hasChanged: false,
      changes: [],
      runsAddedSinceLast: null,
      wicketsFallenSinceLast: null,
      newBalls: [],
    };
  }

  const changes: MatchDelta['changes'] = [];
  const trackedFields: (keyof LiveMatchDetail)[] = ['statusText', 'inningsSummary', 'currentRR', 'requiredRR'];

  for (const field of trackedFields) {
    if (JSON.stringify(prev.data[field]) !== JSON.stringify(current[field])) {
      changes.push({ field, prev: prev.data[field], curr: current[field] });
    }
  }

  const prevScore = extractNumericScore(prev.data);
  const currScore = extractNumericScore(current);
  const prevWickets = extractWickets(prev.data);
  const currWickets = extractWickets(current);

  const runsAdded = prevScore !== null && currScore !== null ? currScore - prevScore : null;
  const wicketsFallen = prevWickets !== null && currWickets !== null ? currWickets - prevWickets : null;

  // Determine new balls since last snapshot
  const prevBallCount = prev.data.recentBalls.length;
  const newBalls: RecentBall[] = current.recentBalls.slice(0, Math.max(0, current.recentBalls.length - prevBallCount));

  const hasChanged = changes.length > 0 || (runsAdded !== null && runsAdded !== 0) || (wicketsFallen !== null && wicketsFallen !== 0);

  storeSnapshot(matchId, current);

  return {
    matchId,
    timestamp,
    hasChanged,
    changes,
    runsAddedSinceLast: runsAdded,
    wicketsFallenSinceLast: wicketsFallen,
    newBalls,
  };
}

function extractNumericScore(data: LiveMatchDetail): number | null {
  // Try to extract runs from inningsSummary like "149-3 (12.5)"
  const m = (data.inningsSummary || '').match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function extractWickets(data: LiveMatchDetail): number | null {
  const m = (data.inningsSummary || '').match(/-(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}
