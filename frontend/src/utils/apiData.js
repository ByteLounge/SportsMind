const FOOTBALL_API_KEY = import.meta.env.VITE_FOOTBALL_API_KEY || "";
const CRICKET_API_KEY = import.meta.env.VITE_CRICKET_API_KEY || "";
const NEWS_API_KEY = import.meta.env.VITE_NEWS_API_KEY || "";
const rawBase = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";
const CRICKETSCRAP_BASE = rawBase.endsWith('/') ? rawBase.slice(0, -1) : rawBase;

// Major football league IDs for filtering from api-sports
const MAJOR_LEAGUE_IDS = new Set([39, 140, 135, 78, 61, 2, 3, 848, 45, 48, 253, 262]);

// ─── Short name → full name map for slug-based team extraction ──────────────
const SHORT_TO_FULL = {
  CSK: 'Chennai Super Kings', MI: 'Mumbai Indians',
  RCB: 'Royal Challengers Bengaluru', KKR: 'Kolkata Knight Riders',
  RR: 'Rajasthan Royals', SRH: 'Sunrisers Hyderabad',
  PBKS: 'Punjab Kings', DC: 'Delhi Capitals',
  LSG: 'Lucknow Super Giants', GT: 'Gujarat Titans',
  IND: 'India', AUS: 'Australia', ENG: 'England',
  PAK: 'Pakistan', SA: 'South Africa', NZ: 'New Zealand',
  WI: 'West Indies', SL: 'Sri Lanka', BAN: 'Bangladesh', AFG: 'Afghanistan',
  ZIM: 'Zimbabwe', IRE: 'Ireland', NED: 'Netherlands',
};

function extractTeamsFromSlug(slug) {
  if (!slug || typeof slug !== 'string') return null;
  const vsIdx = slug.indexOf('-vs-');
  if (vsIdx === -1) return null;
  const t1slug = slug.substring(0, vsIdx);
  const t2slug = slug.substring(vsIdx + 4).split('-')[0];
  const t1 = t1slug.toUpperCase();
  const t2 = t2slug.toUpperCase();
  return {
    team1: { name: SHORT_TO_FULL[t1] || t1slug, shortname: t1 },
    team2: { name: SHORT_TO_FULL[t2] || t2slug, shortname: t2 },
  };
}

function mapMatchData(m) {
  const extracted = extractTeamsFromSlug(m.slug);
  const t1 = extracted?.team1 || { name: m.teams?.[0]?.name || 'TBD', shortname: m.teams?.[0]?.shortName || 'TBD' };
  const t2 = extracted?.team2 || { name: m.teams?.[1]?.name || 'TBD', shortname: m.teams?.[1]?.shortName || 'TBD' };

  const isLive = m.state === 'live' || m.state === 'stumps' || m.state === 'rain_delay';
  const isEnded = m.state === 'result' || m.state === 'abandoned';
  const slugHasIPL = m.slug?.includes('indian-premier-league') || m.slug?.includes('-ipl-');
  const fmt = (m.format === 'Other' && slugHasIPL) ? 't20'
    : m.format === 'T20' ? 't20' : m.format === 'ODI' ? 'odi'
    : m.format === 'Test' ? 'test' : m.format === 'T10' ? 't10' : 't20';

  const scores = m.teams?.map((t, idx) => {
    if (!t.score) return null;
    const [runs, wickets] = t.score.replace('d', '').split('-').map(Number);
    return {
      r: runs || 0,
      w: wickets || 0,
      o: t.overs ? parseFloat(t.overs) : 0,
      inning: `${t.name} Inning 1`
    };
  }).filter(Boolean) || [];

  return {
    id: m.matchId,
    name: m.title || `${t1.name} vs ${t2.name}`,
    matchType: fmt,
    state: m.state || (isLive ? 'live' : isEnded ? 'result' : 'upcoming'),
    status: m.statusText || (isLive ? 'Live' : isEnded ? 'Completed' : 'Upcoming'),
    venue: m.venue || '',
    startTimeText: m.startTimeText || null,
    date: new Date().toISOString().split('T')[0],
    teams: [t1.name, t2.name],
    teamInfo: [
      { name: t1.name, shortname: t1.shortname, img: '' },
      { name: t2.name, shortname: t2.shortname, img: '' },
    ],
    score: scores,
    matchStarted: isLive || isEnded,
    matchEnded: isEnded,
    latestCommentary: m.latestCommentary?.text || (typeof m.latestCommentary === 'string' ? m.latestCommentary : null),
    slug: m.slug || '',
  };
}

async function fetchCricketLiveMatchesFromBackend() {
  const res = await fetch(`${CRICKETSCRAP_BASE}/api/live`);
  if (!res.ok) throw new Error(`Backend ${res.status}`);
  const json = await res.json();
  if (!json.ok || !Array.isArray(json.matches) || json.matches.length === 0)
    throw new Error('Backend returned no matches');

  return json.matches.map(mapMatchData);
}

export async function fetchCricketUpcomingMatches() {
  try {
    const res = await fetch(`${CRICKETSCRAP_BASE}/api/live/upcoming`);
    if (!res.ok) throw new Error(`Backend upcoming ${res.status}`);
    const json = await res.json();
    return json.ok && Array.isArray(json.matches) ? json.matches.map(mapMatchData) : [];
  } catch (err) {
    console.error("Failed to fetch upcoming matches:", err);
    return [];
  }
}

export async function fetchCricketRecentMatches() {
  try {
    const res = await fetch(`${CRICKETSCRAP_BASE}/api/live/recent`);
    if (!res.ok) throw new Error(`Backend recent ${res.status}`);
    const json = await res.json();
    return json.ok && Array.isArray(json.matches) ? json.matches.map(mapMatchData) : [];
  } catch (err) {
    console.error("Failed to fetch recent matches:", err);
    return [];
  }
}

// Module-level cache — prevents quota exhaustion (CricAPI: 100 calls/day)
const _cache = new Map();
const CACHE_TTL = 90_000; // 90 seconds

function getCached(key) {
  const entry = _cache.get(key);
  return entry && Date.now() - entry.ts < CACHE_TTL ? entry.data : null;
}
function setCache(key, data) {
  _cache.set(key, { data, ts: Date.now() });
}

const CRICKET_FALLBACK_MATCHES = [
  {
    id: "demo-mi-rcb",
    name: "Mumbai Indians vs Royal Challengers Bengaluru, Match 47, IPL 2026",
    matchType: "t20",
    status: "MI need 31 runs in 10 balls",
    state: "live",
    venue: "Wankhede Stadium, Mumbai",
    date: new Date().toISOString().split('T')[0],
    teams: ["Mumbai Indians", "Royal Challengers Bengaluru"],
    teamInfo: [
      { name: "Mumbai Indians", shortname: "MI", img: "https://g.cricapi.com/iapi/55-637852956181378533.png?w=48" },
      { name: "Royal Challengers Bengaluru", shortname: "RCB", img: "https://g.cricapi.com/iapi/164-637852956181378533.png?w=48" }
    ],
    score: [
      { r: 186, w: 8, o: 20.0, inning: "Royal Challengers Bengaluru Inning 1" },
      { r: 156, w: 5, o: 18.2, inning: "Mumbai Indians Inning 1" }
    ],
    matchStarted: true,
    matchEnded: false
  },
  {
    id: "demo-csk-srh",
    name: "Chennai Super Kings vs Sunrisers Hyderabad, Match 48, IPL 2026",
    matchType: "t20",
    status: "Match starts at 7:30 PM IST",
    state: "upcoming",
    venue: "MA Chidambaram Stadium, Chennai",
    date: new Date().toISOString().split('T')[0],
    teams: ["Chennai Super Kings", "Sunrisers Hyderabad"],
    teamInfo: [
      { name: "Chennai Super Kings", shortname: "CSK", img: "https://g.cricapi.com/iapi/135-637852956181378533.png?w=48" },
      { name: "Sunrisers Hyderabad", shortname: "SRH", img: "https://g.cricapi.com/iapi/1664528-637852956181378533.png?w=48" }
    ],
    score: [],
    matchStarted: false,
    matchEnded: false
  }
];

export async function fetchCricketMatchDetail(matchId, slug) {
  try {
    const res = await fetch(`${CRICKETSCRAP_BASE}/api/live/${matchId}?slug=${slug}`);
    if (!res.ok) throw new Error(`Backend detail ${res.status}`);
    const json = await res.json();
    if (!json.ok) { console.error(`Match detail error: ${json.error?.message}`); return null; }
    return json.data ?? json;
  } catch (err) {
    console.error(`Failed to fetch match detail for ${matchId}:`, err);
    return null;
  }
}

export async function fetchCricketMatchWidget(matchId, slug) {
  try {
    const res = await fetch(`${CRICKETSCRAP_BASE}/api/live/${matchId}/widget${slug ? '?slug=' + slug : ''}`);
    if (!res.ok) throw new Error(`Backend ${res.status}`);
    const json = await res.json();
    if (!json.ok) { console.error(`Widget error: ${json.error?.message}`); return null; }
    return json.widget ?? null;
  } catch (err) {
    console.error("Failed to fetch widget:", err);
    return null;
  }
}

export async function fetchCricketMatchDelta(matchId, slug) {
  try {
    const url = `${CRICKETSCRAP_BASE}/api/live/${matchId}/delta${slug ? '?slug=' + slug : ''}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Backend ${res.status}`);
    const json = await res.json();
    return json.ok ? json : null;
  } catch (err) {
    console.error("Failed to fetch delta:", err);
    return null;
  }
}

export async function fetchCricketMatchCommentary(matchId, slug) {
  try {
    const res = await fetch(`${CRICKETSCRAP_BASE}/api/live/${matchId}/commentary?slug=${slug}`);
    if (!res.ok) throw new Error(`Backend ${res.status}`);
    const json = await res.json();
    if (!json.ok) { console.error(`Commentary error: ${json.error?.message}`); return null; }
    return json;
  } catch (err) {
    console.error("Failed to fetch commentary:", err);
    return null;
  }
}

export async function fetchCricketMatchScorecard(matchId, slug) {
  try {
    const res = await fetch(`${CRICKETSCRAP_BASE}/api/live/${matchId}/scorecard?slug=${slug}`);
    if (!res.ok) throw new Error(`Backend ${res.status}`);
    const json = await res.json();
    if (!json.ok) { console.error(`Scorecard error: ${json.error?.message}`); return null; }
    return json;
  } catch (err) {
    console.error("Failed to fetch scorecard:", err);
    return null;
  }
}

export async function fetchCricketMatchSquads(matchId, slug) {
  try {
    const res = await fetch(`${CRICKETSCRAP_BASE}/api/live/${matchId}/squads?slug=${slug}`);
    if (!res.ok) throw new Error(`Backend ${res.status}`);
    const json = await res.json();
    if (!json.ok) { console.error(`Squads error: ${json.error?.message}`); return null; }
    return json;
  } catch (err) {
    console.error("Failed to fetch squads:", err);
    return null;
  }
}

export async function fetchCricketMatchGraphData(matchId, slug, graphType, params = {}) {
  try {
    const qParams = { ...params, slug };
    const query = new URLSearchParams(qParams).toString();
    const url = `${CRICKETSCRAP_BASE}/api/live/${matchId}/graphs/${graphType}${query ? '?' + query : ''}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Backend graph ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`Graph fetch failed [${graphType}]:`, err);
    return null;
  }
}

export async function fetchCricketMatchHighlights(matchId, slug) {
  try {
    const res = await fetch(`${CRICKETSCRAP_BASE}/api/live/${matchId}/highlights?slug=${slug}`);
    if (!res.ok) throw new Error(`Backend highlights ${res.status}`);
    const json = await res.json();
    if (!json.ok) { console.error(`Highlights error: ${json.error?.message}`); return null; }
    return json.data ?? null;
  } catch (err) {
    console.error(`Failed to fetch highlights for ${matchId}:`, err);
    return null;
  }
}

export async function fetchCricketMatchHighlightsByInnings(matchId, slug, inningsId) {
  try {
    const res = await fetch(`${CRICKETSCRAP_BASE}/api/live/${matchId}/highlights/${inningsId}${slug ? '?slug=' + slug : ''}`);
    if (!res.ok) throw new Error(`Backend highlights innings ${res.status}`);
    const json = await res.json();
    return json.ok ? json : null;
  } catch (err) {
    console.error(`Failed to fetch highlights innings ${inningsId} for ${matchId}:`, err);
    return null;
  }
}

export async function fetchSeriesPointsTable(seriesId, slug = null) {
  try {
    let url = `${CRICKETSCRAP_BASE}/api/series/${seriesId}/points-table`;
    if (slug) url += `?slug=${slug}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Backend points table ${res.status}`);
    const json = await res.json();
    return json.ok ? json.rows : null;
  } catch (err) {
    console.error(`Failed to fetch points table for ${seriesId}:`, err);
    return null;
  }
}

export async function fetchSeriesSquads(seriesId, slug = null) {
  try {
    let url = `${CRICKETSCRAP_BASE}/api/series/${seriesId}/squads`;
    if (slug) url += `?slug=${slug}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Backend series squads ${res.status}`);
    const json = await res.json();
    return json.ok ? json.data : null;
  } catch (err) {
    console.error(`Failed to fetch series squads for ${seriesId}:`, err);
    return null;
  }
}

export async function fetchSeriesStats(seriesId, statType) {
  try {
    const res = await fetch(`${CRICKETSCRAP_BASE}/api/series/${seriesId}/stats/${statType}`);
    if (!res.ok) throw new Error(`Backend series stats ${res.status}`);
    const json = await res.json();
    return json.ok ? json : null;
  } catch (err) {
    console.error(`Failed to fetch series stats [${statType}] for ${seriesId}:`, err);
    return null;
  }
}

export async function fetchSystemHealth() {
  try {
    const res = await fetch(`${CRICKETSCRAP_BASE}/api/health`);
    if (!res.ok) throw new Error(`Backend health ${res.status}`);
    const json = await res.json();
    return json;
  } catch (err) {
    console.error(`Failed to fetch system health:`, err);
    return null;
  }
}

export async function fetchNewsByTopic(topic = 'sports') {
  const cacheKey = `news_topic_${topic}`;
  const hit = getCached(cacheKey);
  if (hit) return hit;

  try {
    // Use CORS-friendly cached source as primary for browser
    const res = await fetch(`https://saurav.tech/NewsAPI/top-headlines/category/sports/in.json`);
    const data = await res.json();
    if (data.status === 'ok' && data.articles) {
      const keyword = topic === 'sports' ? null : topic.toLowerCase();
      const filtered = keyword
        ? data.articles.filter(a => a.title?.toLowerCase().includes(keyword) || a.description?.toLowerCase().includes(keyword))
        : data.articles;
      const articles = (filtered.length > 0 ? filtered : data.articles).slice(0, 10);
      const result = articles.map(a => ({
        title: a.title,
        url: a.url,
        urlToImage: a.urlToImage,
        source: { name: a.source?.name || 'Unknown' }
      }));
      setCache(cacheKey, result);
      return result;
    }
    return [];
  } catch (err) {
    console.error(`Failed to fetch news for topic: ${topic}`, err);
    return [];
  }
}

export async function fetchSportsNews() {
  const hit = getCached('sports_news');
  if (hit) return hit;

  try {
    // CORS-friendly cached source (NewsAPI blocks browser requests directly)
    const res = await fetch('https://saurav.tech/NewsAPI/top-headlines/category/sports/in.json');
    const data = await res.json();
    if (data.status === 'ok' && data.articles && data.articles.length > 0) {
      const result = data.articles.map(a => ({
        title: a.title,
        url: a.url,
        urlToImage: a.urlToImage,
        source: { name: a.source?.name || 'Unknown' }
      }));
      setCache('sports_news', result);
      return result;
    }
    throw new Error("Cached news API returned empty");
  } catch (err) {
    console.warn("News API failed, using static fallback", err);
    return [
      { title: "IPL 2026: MI vs RCB — Hardik Pandya's stunning knock seals thriller at Wankhede", url: "#", urlToImage: null, source: { name: "SportsMind AI" } },
      { title: "Champions League Final Preview: Real Madrid vs Bayern Munich — Tactical breakdown", url: "#", urlToImage: null, source: { name: "SportsMind" } },
      { title: "NBA Playoffs: Knicks edge Celtics in overtime to take 3-2 series lead", url: "#", urlToImage: null, source: { name: "SportsMind" } },
      { title: "French Open 2026: Alcaraz beats Sinner in epic 5-set semi-final at Roland Garros", url: "#", urlToImage: null, source: { name: "SportsMind" } },
      { title: "Formula 1 Monaco GP: Verstappen leads Leclerc in thrilling title battle", url: "#", urlToImage: null, source: { name: "SportsMind" } }
    ];
  }
}

export async function fetchFootballLiveMatches() {
  const hit = getCached('football_live');
  if (hit) return hit;

  try {
    const res = await fetch("https://v3.football.api-sports.io/fixtures?live=all", {
      headers: { "x-apisports-key": FOOTBALL_API_KEY }
    });
    const data = await res.json();
    const all = data.response || [];

    // Prefer major leagues; fall back to all matches if none found
    const major = all.filter(f => MAJOR_LEAGUE_IDS.has(f.league?.id));
    const result = major.length > 0 ? major : all;
    setCache('football_live', result);
    return result;
  } catch (err) {
    console.error("Failed to fetch football matches:", err);
    return [];
  }
}

export async function fetchCricketLiveMatches() {
  const hit = getCached('cricket_live');
  if (hit) return hit;

  // Try cricketScrap backend first — real Cricbuzz data, no quota limit
  try {
    const matches = await fetchCricketLiveMatchesFromBackend();
    if (matches.length > 0) {
      matches.sort((a, b) => {
        const aLive = a.matchStarted && !a.matchEnded;
        const bLive = b.matchStarted && !b.matchEnded;
        const aIPL = a.matchType === 't20' && (a.name?.toLowerCase().includes('ipl') || a.name?.toLowerCase().includes('indian premier'));
        const bIPL = b.matchType === 't20' && (b.name?.toLowerCase().includes('ipl') || b.name?.toLowerCase().includes('indian premier'));
        if (aLive && !bLive) return -1;
        if (!aLive && bLive) return 1;
        if (aIPL && !bIPL) return -1;
        if (!aIPL && bIPL) return 1;
        return 0;
      });
      setCache('cricket_live', matches);
      return matches;
    }
  } catch (_backendErr) {
    console.warn("cricketScrap backend unavailable, trying CricAPI:", _backendErr.message);
  }

  // CricAPI fallback — 100 calls/day quota
  try {
    const res = await fetch(`https://api.cricapi.com/v1/currentMatches?apikey=${CRICKET_API_KEY}&offset=0`);
    const data = await res.json();

    if (data.status === "success" && Array.isArray(data.data) && data.data.length > 0) {
      const matches = data.data
        .filter(m => m.matchStarted || !m.matchEnded)
        .map(m => ({
          id: m.id,
          name: m.name,
          matchType: m.matchType,
          status: m.status,
          state: 'live',
          venue: m.venue || "Unknown Venue",
          date: m.date || new Date().toISOString().split('T')[0],
          teams: m.teams || [],
          teamInfo: m.teamInfo || [],
          score: m.score || [],
          matchStarted: m.matchStarted || false,
          matchEnded: m.matchEnded || false
        }));

      if (matches.length > 0) {
        matches.sort((a, b) => {
          const aIsIPL = a.name?.toLowerCase().includes('ipl') || a.name?.toLowerCase().includes('indian premier');
          const bIsIPL = b.name?.toLowerCase().includes('ipl') || b.name?.toLowerCase().includes('indian premier');
          const aLive = a.matchStarted && !a.matchEnded;
          const bLive = b.matchStarted && !b.matchEnded;
          if (aLive && !bLive) return -1;
          if (!aLive && bLive) return 1;
          if (aIsIPL && !bIsIPL) return -1;
          if (!aIsIPL && bIsIPL) return 1;
          return 0;
        });

        setCache('cricket_live', matches);
        return matches;
      }
    }
    throw new Error("CricAPI returned no match data");
  } catch (err) {
    console.error("Both cricket sources failed, using fallback:", err);
    return CRICKET_FALLBACK_MATCHES;
  }
}

export async function fetchCricketTeams() {
  try {
    const res = await fetch("https://free-cricbuzz-cricket-api.p.rapidapi.com/cricket-teams", {
      headers: {
        'x-rapidapi-key': import.meta.env.VITE_RAPIDAPI_KEY || '',
        'x-rapidapi-host': 'free-cricbuzz-cricket-api.p.rapidapi.com'
      }
    });
    const data = await res.json();
    return data.status === "success" ? data.response : [];
  } catch (err) {
    console.error("Failed to fetch cricket teams:", err);
    return [];
  }
}

export async function fetchPlayersByTeam(teamId = "2") {
  try {
    const res = await fetch(`https://free-cricbuzz-cricket-api.p.rapidapi.com/cricket-players?teamid=${teamId}`, {
      headers: {
        'x-rapidapi-key': import.meta.env.VITE_RAPIDAPI_KEY || '',
        'x-rapidapi-host': 'free-cricbuzz-cricket-api.p.rapidapi.com'
      }
    });
    const data = await res.json();
    return data.status === "success" ? data.response : [];
  } catch (err) {
    console.error("Failed to fetch players:", err);
    return [];
  }
}

export async function fetchBasketballLiveMatches() {
  try {
    const res = await fetch("https://v1.basketball.api-sports.io/games?live=all", {
      headers: { "x-apisports-key": FOOTBALL_API_KEY }
    });
    const data = await res.json();
    return data.response || [];
  } catch (err) {
    console.error("Failed to fetch basketball matches:", err);
    return [];
  }
}

export async function fetchTennisLiveMatches() {
  try {
    const res = await fetch("https://v1.tennis.api-sports.io/fixtures?live=all", {
      headers: { "x-apisports-key": FOOTBALL_API_KEY }
    });
    const data = await res.json();
    return data.response || [];
  } catch (err) {
    console.error("Failed to fetch tennis matches:", err);
    return [];
  }
}

export async function fetchCricketStandings() {
  const hit = getCached('cricket_standings');
  if (hit) return hit;

  // Try cricketScrap backend first (IPL 2026 points table)
  try {
    const rows = await fetchSeriesPointsTable("9241", "indian-premier-league-2026");
    if (rows && Array.isArray(rows)) {
      const result = rows.map((team) => ({
        rank: team.rank,
        team: team.team,
        img: team.img || "",
        played: team.played,
        won: team.wins,
        lost: team.losses,
        points: team.points,
        nrr: team.nrr || "0.000",
        form: team.form || []
      }));
      setCache('cricket_standings', result);
      return result;
    }
  } catch (_err) {
    console.warn("Backend standings failed, trying CricAPI fallback");
  }

  try {
    const seriesId = "87c62aac-bc3c-4738-ab93-19da0690488f";
    const res = await fetch(`https://api.cricapi.com/v1/series_points?apikey=${CRICKET_API_KEY}&id=${seriesId}`);
    const data = await res.json();

    if (data.status === "success" && data.data && Array.isArray(data.data)) {
      const sortedData = data.data.map(team => ({
        ...team,
        points: (team.wins * 2) + (team.ties * 1)
      })).sort((a, b) => b.points - a.points || b.wins - a.wins);

      const result = sortedData.map((team, index) => ({
        rank: index + 1,
        team: team.teamname,
        img: team.img,
        played: team.matches,
        won: team.wins,
        lost: team.loss,
        points: team.points,
        nrr: team.nrr || "N/A"
      }));
      setCache('cricket_standings', result);
      return result;
    }
  } catch (err) {
    console.error("Failed to fetch real cricket standings, using fallback", err);
  }

  return [
    { rank: 1, team: "Sunrisers Hyderabad", played: 12, won: 8, lost: 4, points: 16, nrr: "+0.757" },
    { rank: 2, team: "Gujarat Titans", played: 12, won: 8, lost: 4, points: 16, nrr: "+0.228" },
    { rank: 3, team: "Punjab Kings", played: 11, won: 7, lost: 4, points: 14, nrr: "+0.571" },
    { rank: 4, team: "Royal Challengers Bengaluru", played: 11, won: 7, lost: 4, points: 14, nrr: "+1.234" },
    { rank: 5, team: "Rajasthan Royals", played: 12, won: 6, lost: 6, points: 12, nrr: "+0.082" },
    { rank: 6, team: "Chennai Super Kings", played: 11, won: 6, lost: 5, points: 12, nrr: "+0.151" },
    { rank: 7, team: "Kolkata Knight Riders", played: 11, won: 5, lost: 6, points: 10, nrr: "-0.169" },
    { rank: 8, team: "Delhi Capitals", played: 12, won: 4, lost: 8, points: 8, nrr: "-1.154" },
    { rank: 9, team: "Mumbai Indians", played: 11, won: 3, lost: 8, points: 6, nrr: "-0.642" },
    { rank: 10, team: "Lucknow Super Giants", played: 11, won: 3, lost: 8, points: 6, nrr: "-0.954" }
  ];
}

export async function fetchFootballStandings() {
  const hit = getCached('football_standings');
  if (hit) return hit;

  try {
    // Try to fetch real Premier League standings (league 39, current season)
    const res = await fetch("https://v3.football.api-sports.io/standings?league=39&season=2025", {
      headers: { "x-apisports-key": FOOTBALL_API_KEY }
    });
    const data = await res.json();
    const standings = data.response?.[0]?.league?.standings?.[0];
    if (standings && standings.length > 0) {
      const result = standings.map((entry) => ({
        rank: entry.rank,
        team: entry.team.name,
        logo: entry.team.logo,
        played: entry.all.played,
        won: entry.all.win,
        draw: entry.all.draw,
        lost: entry.all.lose,
        gf: entry.all.goals.for,
        ga: entry.all.goals.against,
        gd: entry.goalsDiff > 0 ? `+${entry.goalsDiff}` : `${entry.goalsDiff}`,
        points: entry.points
      }));
      setCache('football_standings', result);
      return result;
    }
  } catch (err) {
    console.error("Failed to fetch real football standings, using fallback", err);
  }

  return [
    { rank: 1, team: "Manchester City", played: 38, won: 28, draw: 7, lost: 3, gf: 96, ga: 34, gd: "+62", points: 91 },
    { rank: 2, team: "Arsenal", played: 38, won: 28, draw: 5, lost: 5, gf: 91, ga: 29, gd: "+62", points: 89 },
    { rank: 3, team: "Liverpool", played: 38, won: 24, draw: 10, lost: 4, gf: 86, ga: 41, gd: "+45", points: 82 },
    { rank: 4, team: "Aston Villa", played: 38, won: 20, draw: 8, lost: 10, gf: 76, ga: 61, gd: "+15", points: 68 },
    { rank: 5, team: "Tottenham Hotspur", played: 38, won: 20, draw: 6, lost: 12, gf: 74, ga: 61, gd: "+13", points: 66 },
    { rank: 6, team: "Chelsea", played: 38, won: 18, draw: 9, lost: 11, gf: 77, ga: 63, gd: "+14", points: 63 },
    { rank: 7, team: "Newcastle United", played: 38, won: 18, draw: 6, lost: 14, gf: 85, ga: 62, gd: "+23", points: 60 },
    { rank: 8, team: "Manchester United", played: 38, won: 18, draw: 6, lost: 14, gf: 57, ga: 58, gd: "-1", points: 60 }
  ];
}
