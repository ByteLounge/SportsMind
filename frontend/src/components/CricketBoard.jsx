import React, { useState, useEffect, useRef } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, BarController, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { Play, Volume2, VolumeX, Award, ShieldAlert, Zap, BarChart3, Calendar, Info, Loader2, ArrowLeft, Sun, Moon, Mic, Radio, ExternalLink, RefreshCw, ChevronRight, Users, Activity, Trophy, Video } from 'lucide-react';
import { teams, ptsData as fallbackPtsData, scheduleData } from '../data';
import { LANG_CODE, LANG_OPTIONS, AI_FALLBACKS, UI } from '../translations';
import { fetchCricketLiveMatches, fetchCricketUpcomingMatches, fetchCricketRecentMatches, fetchCricketMatchDetail, fetchCricketMatchDelta, fetchCricketMatchScorecard, fetchCricketMatchCommentary, fetchCricketMatchSquads, fetchCricketStandings, fetchSystemHealth, fetchCricketMatchGraphData, fetchCricketMatchHighlightsByInnings } from '../utils/apiData';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, BarController, Title, Tooltip, Legend, Filler);

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "AIzaSyBjadWPgAD6p0bWYQmMFZ_-HiSneC0MZk4";
const ELEVENLABS_API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY || "sk_c130ff830190aac721d91ae99e26f06841194dbedf5d610e";
const VOICE_ID = "CwhRBWXzGAHq8TQ4Fs17";
const VOICE_OPTIONS = [
  { label: 'Voice 1', id: 'CwhRBWXzGAHq8TQ4Fs17' },
  { label: 'Voice 2', id: 'EXAVITQu4vr4xnSDx7ig' }, // Bella or another popular voice
  { label: 'Voice 3', id: '21m00T83T4hJnxS6ADHh' }, // Rachel
];

const createLogoFallbackDataUri = (teamCode, color) => {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'>
    <rect width='128' height='128' rx='20' fill='${color}' />
    <text x='64' y='72' fill='#ffffff' font-family='sans-serif' font-size='34' font-weight='600' text-anchor='middle'>${teamCode}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

const TeamLogo = ({ teamCode, sizeClass = 'w-8 h-8' }) => {
  const team = teams[teamCode];
  if (!team) return <div className={`${sizeClass} rounded-full bg-border-subtle`} />;
  const fallbackSrc = createLogoFallbackDataUri(teamCode, team.c || '#333');

  return (
    <img
      src={team.l}
      alt={teamCode}
      className={`${sizeClass} object-contain`}
      loading="lazy"
      onError={(e) => {
        if (e.currentTarget.dataset.fallbackApplied === 'true') return;
        e.currentTarget.dataset.fallbackApplied = 'true';
        e.currentTarget.src = fallbackSrc;
      }}
    />
  );
};

const IPL_TEAMS = new Set([
  'Chennai Super Kings', 'Mumbai Indians', 'Royal Challengers Bengaluru',
  'Kolkata Knight Riders', 'Rajasthan Royals', 'Sunrisers Hyderabad',
  'Punjab Kings', 'Delhi Capitals', 'Lucknow Super Giants', 'Gujarat Titans',
]);

const CricketBoard = ({ isDarkMode, toggleTheme, navigate }) => {
  const [activeTab, setActiveTab] = useState('matches');
  const [analysisMode, setAnalysisMode] = useState('casual');
  const [voiceMode, setVoiceMode] = useState('web');
  const [isAiCommentatorEnabled, setIsAiCommentatorEnabled] = useState(true);
  const [language, setLanguage] = useState('English');
  const [isMuted, setIsMuted] = useState(false);
  const [standings, setStandings] = useState([]);

  const t = UI[language] || UI['English'];

  useEffect(() => {
    async function loadRealData() {
      try {
        const [live, upcoming, recent] = await Promise.all([
          fetchCricketLiveMatches(),
          fetchCricketUpcomingMatches(),
          fetchCricketRecentMatches()
        ]);
        
        // Combine and deduplicate by ID
        const allMatches = [...live, ...upcoming, ...recent];
        const uniqueMatches = Array.from(new Map(allMatches.map(m => [m.id, m])).values());
        
        if (uniqueMatches.length > 0) {
          setLiveMatches(uniqueMatches);
          if (!hasAutoSelected.current) {
            hasAutoSelected.current = true;
            const rcbVsMi = uniqueMatches.find(m =>
              String(m.id) === '152097' ||
              (m.teams?.some(t => t.includes('Royal Challengers')) && m.teams?.some(t => t.includes('Mumbai')))
            );
            const autoSelect = rcbVsMi || uniqueMatches.find(m => m.state === 'live') || uniqueMatches[0];
            if (autoSelect) setLiveNarrationMatch(autoSelect);
          }
        }
      } catch (err) {
        console.error("Failed to load real data:", err);
      }

      const standingsData = await fetchCricketStandings();
      if (standingsData && standingsData.length > 0) {
        setStandings(standingsData);
      }
    }
    loadRealData();
    const interval = setInterval(loadRealData, 60000);
    return () => clearInterval(interval);
  }, []);


  // Live matches + AI narration state
  const [liveMatches, setLiveMatches] = useState([]);
  const [aiLiveLines, setAiLiveLines] = useState([]);
  const [isGeneratingLive, setIsGeneratingLive] = useState(false);
  const [liveNarrationMatch, setLiveNarrationMatch] = useState(null);
  const [matchDetail, setMatchDetail] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('all'); // all | international | league | domestic
  const [matchCenterTab, setMatchCenterTab] = useState('overview'); // overview, scorecard, commentary, squads, graphs
  const [scorecardData, setScorecardData] = useState(null);
  const [fullCommentaryData, setFullCommentaryData] = useState(null);
  const [squadsData, setSquadsData] = useState(null);
  const [matchListTab, setMatchListTab] = useState('live'); // live, upcoming, completed
  const [showOverSummaries, setShowOverSummaries] = useState(true);
  const [graphsSubTab, setGraphsSubTab] = useState('win-probability');
  const [graphsData, setGraphsData] = useState({});
  const [isLoadingGraph, setIsLoadingGraph] = useState(false);
  const [highlightsData, setHighlightsData] = useState({ inn1: null, inn2: null });
  const [backendHealth, setBackendHealth] = useState(null);
  const [isLoadingTab, setIsLoadingTab] = useState(false);
  const lastNarratedBall = useRef(null);

  useEffect(() => {
    if (!liveNarrationMatch?.id) return;

    async function applyDetail(detail) {
      if (!detail) return;
      setMatchDetail(detail);
      const latestBall = detail.latestCommentary || detail.commentaryList?.[0];
      if (!isMuted && isAiCommentatorEnabled && latestBall) {
        const ballKey = latestBall.timestamp
          ? `${latestBall.overNumber || latestBall.over}-${latestBall.timestamp}`
          : `${latestBall.over}.${latestBall.ball}-${latestBall.text}`;
        if (lastNarratedBall.current !== ballKey) {
          lastNarratedBall.current = ballKey;
          const over = latestBall.overNumber || latestBall.over || '';
          const ball = latestBall.ball || '';
          const text = latestBall.commText || latestBall.text || '';
          if (text) speak(`${over}${ball ? '.' + ball : ''}, ${text}`);
        }
      }
    }

    async function doFullFetch() {
      const detail = await fetchCricketMatchDetail(liveNarrationMatch.id, liveNarrationMatch.slug);
      await applyDetail(detail);
    }

    async function checkDelta() {
      const resp = await fetchCricketMatchDelta(liveNarrationMatch.id, liveNarrationMatch.slug);
      if (resp?.hasChanged) await doFullFetch();
    }

    doFullFetch();
    const interval = setInterval(checkDelta, 15000);
    return () => clearInterval(interval);
  }, [liveNarrationMatch?.id, isMuted]);

  // Fetch tab-specific data
  useEffect(() => {
    async function fetchTabData() {
      if (!liveNarrationMatch?.id) return;
      setIsLoadingTab(true);
      try {
        if (matchCenterTab === 'scorecard') {
          const data = await fetchCricketMatchScorecard(liveNarrationMatch.id, liveNarrationMatch.slug);
          setScorecardData(data);
        } else if (matchCenterTab === 'commentary') {
          const data = await fetchCricketMatchCommentary(liveNarrationMatch.id, liveNarrationMatch.slug);
          setFullCommentaryData(data);
        } else if (matchCenterTab === 'squads') {
          const data = await fetchCricketMatchSquads(liveNarrationMatch.id, liveNarrationMatch.slug);
          setSquadsData(data);
        } else if (matchCenterTab === 'graphs') {
          setIsLoadingGraph(true);
          try {
            const [winProb, worm, overs, runRate, partnerships, ballMap1, ballMap2] = await Promise.all([
              fetchCricketMatchGraphData(liveNarrationMatch.id, liveNarrationMatch.slug, 'win-probability'),
              fetchCricketMatchGraphData(liveNarrationMatch.id, liveNarrationMatch.slug, 'worm'),
              fetchCricketMatchGraphData(liveNarrationMatch.id, liveNarrationMatch.slug, 'overs'),
              fetchCricketMatchGraphData(liveNarrationMatch.id, liveNarrationMatch.slug, 'run-rate'),
              fetchCricketMatchGraphData(liveNarrationMatch.id, liveNarrationMatch.slug, 'partnerships'),
              fetchCricketMatchGraphData(liveNarrationMatch.id, liveNarrationMatch.slug, 'balls-map', { innings: 1 }),
              fetchCricketMatchGraphData(liveNarrationMatch.id, liveNarrationMatch.slug, 'balls-map', { innings: 2 }),
            ]);
            setGraphsData({ winProb, worm, overs, runRate, partnerships, ballMap1, ballMap2 });
          } finally {
            setIsLoadingGraph(false);
          }
        } else if (matchCenterTab === 'highlights') {
          const [inn1, inn2] = await Promise.all([
            fetchCricketMatchHighlightsByInnings(liveNarrationMatch.id, liveNarrationMatch.slug, 1),
            fetchCricketMatchHighlightsByInnings(liveNarrationMatch.id, liveNarrationMatch.slug, 2),
          ]);
          setHighlightsData({ inn1, inn2 });
        }
      } catch (err) {
        console.error("Tab fetch failed:", err);
      } finally {
        setIsLoadingTab(false);
      }
    }
    fetchTabData();
  }, [matchCenterTab, liveNarrationMatch?.id]);

  // Backend health check
  useEffect(() => {
    async function checkHealth() {
      const health = await fetchSystemHealth();
      setBackendHealth(health);
    }
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);
  const [aiMatchAnalysis, setAiMatchAnalysis] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const hasAutoSelected = useRef(false);

  const generateLiveCommentary = async (matchObj) => {
    const m = matchObj || liveNarrationMatch || (liveMatches[0]);
    if (!m) return;
    setLiveNarrationMatch(m);
    setIsGeneratingLive(true);
    setAiLiveLines([]);

    // Fetch highlights for context if it's a completed/recent match
    let highlightsContext = "";
    if (m.state === 'result' || m.matchEnded) {
      try {
        const [inn1, inn2] = await Promise.all([
          fetchCricketMatchHighlightsByInnings(m.id, m.slug, 1),
          fetchCricketMatchHighlightsByInnings(m.id, m.slug, 2),
        ]);
        const allHighlights = [...(inn1?.highlights || []), ...(inn2?.highlights || [])];
        highlightsContext = allHighlights
          .filter(h => !h.overSeparator)
          .slice(-10)
          .map(h => `[Ov ${h.overNumber}] ${h.commText}`)
          .join('\n');
      } catch (e) { console.error("Failed to fetch highlights for AI:", e); }
    }

    const team1 = m.teams?.[0] || m.realHomeName || 'Team 1';
    const team2 = m.teams?.[1] || m.realAwayName || 'Team 2';
    const situation = m.status || m.statusText || 'Match in progress';
    const scoreInfo = m.score?.length > 0
      ? m.score.map(s => `${s.inning}: ${s.r}/${s.w} (${s.o} ov)`).join(' | ')
      : '';

    const prompt = `You are an electrifying cricket commentator for a ${m.matchType?.toUpperCase() || 'T20'} match.

Match: ${team1} vs ${team2}
Situation: ${situation}
${scoreInfo ? `Scores: ${scoreInfo}` : ''}
${highlightsContext ? `\nRecent Highlights:\n${highlightsContext}` : ''}

Generate EXACTLY 3 short, dramatic commentary lines in ${language} covering:
1. The overall match narrative / result significance
2. A key performance or tactical highlight
3. A closing statement for the fans

Rules:
- ALL text must be in ${language}. No English if ${language} is not English.
- Each line should be 1-2 sentences, punchy and broadcast-quality
- Use cricket terminology naturally
- Make it feel like professional TV commentary

Respond ONLY as JSON: { "lines": ["line1", "line2", "line3"] }`;

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await res.json();
      const text = data.candidates[0].content.parts[0].text;
      let parsed = { lines: [] };
      try {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]);
      } catch (e) {
        console.error("Failed to parse JSON from AI response:", text, e);
      }
      const lines = parsed.lines || [];
      setAiLiveLines(lines);
      // Read all 3 lines with a pause between each
      for (const line of lines) {
        await speak(line);
        await new Promise(r => setTimeout(r, 800));
      }
    } catch (e) {
      const fallback = [
        `${team1} vs ${team2} — ${situation}`,
        `The atmosphere is electric as every ball counts!`,
        `This is the kind of cricket that keeps you on the edge of your seat.`
      ];
      setAiLiveLines(fallback);
      await speak(fallback[0]);
    }
    setIsGeneratingLive(false);
  };

  const generateMatchAnalysis = async (matchObj) => {
    const m = matchObj || liveNarrationMatch;
    if (!m) return;
    setIsAnalyzing(true);
    setAiMatchAnalysis('');
    const team1 = m.teams?.[0] || 'Team 1';
    const team2 = m.teams?.[1] || 'Team 2';
    const situation = m.status || m.statusText || 'Match in progress';
    const scoreInfo = m.score?.length > 0
      ? m.score.map(s => `${s.inning}: ${s.r}/${s.w} (${s.o} ov)`).join(' | ')
      : '';
    const prompt = `You are an expert cricket analyst providing live commentary-quality match analysis.

Match: ${team1} vs ${team2}
Format: ${m.matchType?.toUpperCase() || 'T20'}
Situation: ${situation}
${scoreInfo ? `Scores: ${scoreInfo}` : ''}

Write a comprehensive 3-paragraph analysis in ${language} covering:
1. Current match situation and momentum
2. Key tactical factors and pressure points
3. Win prediction with clear reasoning

ALL text must be in ${language}. Be engaging, broadcast-quality, and precise. No headers — flowing paragraphs only.`;

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await res.json();
      setAiMatchAnalysis(data.candidates[0].content.parts[0].text);
    } catch (e) {
      setAiMatchAnalysis(`${team1} vs ${team2} — ${situation}`);
    }
    setIsAnalyzing(false);
  };

  const speak = async (text) => {
    if (isMuted) return;
    if (voiceMode === 'hd') {
      try {
        const res = await fetch(`/elevenlabs/v1/text-to-speech/${VOICE_ID}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'xi-api-key': ELEVENLABS_API_KEY },
          body: JSON.stringify({ 
            text, 
            model_id: 'eleven_multilingual_v2',
            voice_settings: { stability: 0.5, similarity_boost: 0.75 }
          })
        });
        if (!res.ok) throw new Error('TTS Failed');
        const blob = await res.blob();
        const audio = new Audio(URL.createObjectURL(blob));
        await audio.play();
        return;
      } catch (e) { 
        console.error('HD voice failed, falling back.'); 
      }
    }
    const langCode = LANG_CODE[language] || 'en-IN';
    const shortLang = langCode.split('-')[0];
    const voices = window.speechSynthesis.getVoices();
    const match = voices.find(v => v.lang.startsWith(shortLang));
    
    if (match) {
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 0.95;
      utter.lang = langCode;
      utter.voice = match;
      window.speechSynthesis.speak(utter);
    } else {
      const audio = new Audio(`https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${shortLang}&q=${encodeURIComponent(text)}`);
      await audio.play().catch(e => console.error("TTS Fallback failed:", e));
    }
  };

  // Category classification helpers
  const INTERNATIONAL_KEYWORDS = ['test', 'odi', 't20i', 'international', 'world cup', 'champions trophy', 'asia cup', 'bilateral'];
  const DOMESTIC_KEYWORDS = ['ranji', 'vijay hazare', 'syed mushtaq', 'duleep', 'county', 'sheffield shield', 'big bash', 'plunket shield', 'super smash', 'pakistan cup', 'regional one-day', 'national one-day'];
  const LEAGUE_KEYWORDS = ['ipl', 'indian premier', 'cpl', 'bbl', 'sa20', 'hundred', 'lpl', 'ilt20', 'major league cricket', 'mlc', 't20 blast', 'vitality blast', 'psl', 'pakistan super', 'bpl', 'bangladesh premier', 'npl', 'nepal premier', 'aplt20', 'clt20', 'ram slam'];

  function classifyMatch(m) {
    const series = (m.name || m.series || '').toLowerCase();
    if (LEAGUE_KEYWORDS.some(k => series.includes(k))) return 'league';
    if (INTERNATIONAL_KEYWORDS.some(k => series.includes(k)) || ['ODI', 'Test'].includes(m.matchType?.toUpperCase())) return 'international';
    if (DOMESTIC_KEYWORDS.some(k => series.includes(k))) return 'domestic';
    return 'league'; // fallback
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg-primary text-main">
      <div className="border-b border-border-subtle px-6 flex justify-between items-center bg-bg-primary/90 backdrop-blur-md py-2">
        <div className="flex gap-6">
          <button onClick={() => setActiveTab('matches')}
            className={`text-sm font-medium transition-colors py-2
            ${activeTab === 'matches' ? 'text-[var(--accent-primary)] border-b-2 border-[var(--accent-primary)]' : 'text-muted hover:text-main'}`}>
            Matches
          </button>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            style={{ backgroundColor: isDarkMode ? '#18181b' : '#ffffff', color: isDarkMode ? '#fafafa' : '#111827' }}
            className="border border-border-subtle rounded-md px-2 py-1 text-xs outline-none cursor-pointer"
          >
            {LANG_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value} style={{ backgroundColor: isDarkMode ? '#18181b' : '#ffffff', color: isDarkMode ? '#fafafa' : '#111827' }}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* AI Commentator Toggle */}
          <button
            onClick={() => setIsAiCommentatorEnabled(!isAiCommentatorEnabled)}
            className={`px-3 py-1 text-xs border rounded-md transition-colors ${isAiCommentatorEnabled ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]' : 'bg-transparent text-muted border-border-subtle hover:text-main'}`}
          >
            AI Commentator {isAiCommentatorEnabled ? 'ON' : 'OFF'}
          </button>

          <div className="flex bg-transparent border border-border-subtle rounded-md overflow-hidden">
            <button onClick={() => setAnalysisMode('casual')} className={`px-3 py-1 text-xs transition-colors ${analysisMode === 'casual' ? 'bg-border-subtle text-main' : 'text-muted hover:bg-[var(--bg-card-hover)]'}`}>Fan</button>
            <button onClick={() => setAnalysisMode('expert')} className={`px-3 py-1 text-xs border-l border-border-subtle transition-colors ${analysisMode === 'expert' ? 'bg-border-subtle text-main' : 'text-muted hover:bg-[var(--bg-card-hover)]'}`}>Tactical</button>
          </div>
          <div className="flex bg-transparent border border-border-subtle rounded-md overflow-hidden">
            <button onClick={() => setVoiceMode('web')} className={`px-3 py-1 text-xs transition-colors ${voiceMode === 'web' ? 'bg-border-subtle text-main' : 'text-muted hover:bg-[var(--bg-card-hover)]'}`}>Web</button>
            <button onClick={() => setVoiceMode('hd')} className={`px-3 py-1 text-xs border-l border-border-subtle transition-colors ${voiceMode === 'hd' ? 'bg-border-subtle text-main' : 'text-muted hover:bg-[var(--bg-card-hover)]'}`}>HD</button>
          </div>
          <button onClick={() => setIsMuted(!isMuted)} className="p-1.5 text-muted hover:text-main transition-colors">
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </div>
      </div>

      <main className="flex-grow p-6 max-w-6xl mx-auto w-full flex flex-col gap-6">
        {activeTab === 'matches' && (
          <>
            {/* ── Match List Section ─────────────────────────────────── */}
            {liveMatches.length > 0 && (
              <div className="flex flex-col gap-3">
                {/* Row 1: Live | Upcoming | Completed tabs */}
                <div className="flex items-center gap-6 border-b border-border-subtle pb-2">
                  {[
                    { id: 'live',      label: 'Live',      count: liveMatches.filter(m => ['live','rain_delay','stumps'].includes(m.state)).length },
                    { id: 'upcoming',  label: 'Upcoming',  count: liveMatches.filter(m => m.state === 'upcoming').length },
                    { id: 'completed', label: 'Completed', count: liveMatches.filter(m => ['result','abandoned','unknown'].includes(m.state)).length },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setMatchListTab(tab.id)}
                      className={`relative pb-2 text-sm font-bold transition-all
                        ${matchListTab === tab.id ? 'text-[var(--accent-primary)]' : 'text-muted hover:text-main'}`}
                    >
                      {tab.label}
                      {tab.count > 0 && (
                        <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-bg-primary border border-border-subtle">
                          {tab.count}
                        </span>
                      )}
                      {matchListTab === tab.id && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent-primary)] rounded-full" />
                      )}
                    </button>
                  ))}
                </div>

                {/* Row 2: International | League | Domestic filter */}
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { key: 'all',           label: 'All' },
                    { key: 'international', label: 'International' },
                    { key: 'league',        label: 'League' },
                    { key: 'domestic',      label: 'Domestic' },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setCategoryFilter(key)}
                      className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border
                        ${categoryFilter === key
                          ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)] text-white shadow-lg shadow-[var(--accent-primary)]/20'
                          : 'border-border-subtle text-muted hover:border-[var(--accent-primary)] hover:text-main'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {liveMatches
                    .filter(m => {
                      // Status tab filter
                      if (matchListTab === 'live') return ['live','rain_delay','stumps'].includes(m.state);
                      if (matchListTab === 'upcoming') return m.state === 'upcoming';
                      if (matchListTab === 'completed') return ['result','abandoned','unknown'].includes(m.state);
                      return true;
                    })
                    .filter(m => {
                      // Category filter
                      if (categoryFilter === 'all') return true;
                      return classifyMatch(m) === categoryFilter;
                    })
                    .map((m, idx) => {
                      const isSelected = liveNarrationMatch?.id === m.id;
                      const t1 = m.teamInfo?.[0]?.shortname || m.teams?.[0]?.substring(0, 3).toUpperCase() || '?';
                      const t2 = m.teamInfo?.[1]?.shortname || m.teams?.[1]?.substring(0, 3).toUpperCase() || '?';
                      
                      return (
                        <button
                          key={m.id || idx}
                          onClick={() => { setLiveNarrationMatch(m); setAiLiveLines([]); setAiMatchAnalysis(''); }}
                          className={`flex flex-col gap-3 p-4 rounded-xl border text-left transition-all hover:shadow-xl group
                            ${isSelected
                              ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5 ring-1 ring-[var(--accent-primary)]/30'
                              : 'border-border-subtle bg-bg-card'
                            }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="text-[10px] font-bold text-muted uppercase tracking-widest truncate max-w-[150px]">
                              {m.name.split(',')[1] || m.series || 'Match'}
                            </div>
                            <div className="flex items-center gap-1.5">
                              {m.state === 'rain_delay' && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20 font-bold">RAIN DELAY</span>
                              )}
                              {m.state === 'stumps' && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-500 border border-orange-500/20 font-bold">STUMPS</span>
                              )}
                              {m.matchType && <span className="text-[9px] px-1.5 py-0.5 rounded bg-bg-primary text-muted border border-border-subtle uppercase font-bold">{m.matchType}</span>}
                            </div>
                          </div>

                          <div className="flex flex-col gap-2">
                            {[0, 1].map(i => {
                              const teamShort = m.teamInfo?.[i]?.shortname || m.teams?.[i]?.substring(0, 3).toUpperCase() || '?';
                              const score = m.score?.[i];
                              return (
                                <div key={i} className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <TeamLogo teamCode={teamShort} sizeClass="w-5 h-5" />
                                    <span className="text-sm font-bold text-main">{teamShort}</span>
                                  </div>
                                  <div className="text-sm font-mono text-main">
                                    {score ? (
                                      <>{score.r}/{score.w} <span className="text-[10px] text-muted ml-1">({score.o})</span></>
                                    ) : (
                                      m.state === 'upcoming' ? '' : 'Yet to bat'
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <div className="mt-1 pt-2 border-t border-border-subtle/50 flex flex-col gap-1">
                            <div className={`text-[10px] font-bold uppercase
                              ${m.state === 'live' ? 'text-[#ef4444]' : 'text-[var(--accent-primary)]'}`}>
                              {m.status}
                            </div>
                            {m.venue && (
                              <div className="text-[9px] text-muted flex items-center gap-1">
                                <Info size={9} /> {m.venue}
                              </div>
                            )}
                            {m.state === 'upcoming' && m.startTimeText && (
                              <div className="text-[10px] text-muted italic">{m.startTimeText}</div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}


            {/* ── AI Live Narrator ────────────────────────────────────── */}
            <div className={`rounded-xl border p-5 flex flex-col gap-4 ${isDarkMode ? 'bg-[#18181b] border-[#3f3f46]' : 'bg-bg-card border-border-subtle'}`}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Radio size={14} className="text-[var(--accent-primary)]" />
                  <span className="text-[11px] uppercase tracking-widest font-semibold text-muted">AI Live Commentary</span>
                  {liveNarrationMatch && (
                    <span className="text-[10px] text-muted px-2 py-0.5 rounded-full border border-border-subtle">
                      {liveNarrationMatch.teamInfo?.[0]?.shortname || '?'} vs {liveNarrationMatch.teamInfo?.[1]?.shortname || '?'}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  {liveNarrationMatch && (
                    <a
                      href={`https://www.cricbuzz.com/live-cricket-scores/${liveNarrationMatch.id}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] text-muted hover:text-[var(--accent-primary)] transition-colors border border-border-subtle rounded px-2 py-1"
                    >
                      <ExternalLink size={10} /> Cricbuzz
                    </a>
                  )}
                  <button
                    onClick={() => generateLiveCommentary(liveNarrationMatch || liveMatches[0])}
                    disabled={isGeneratingLive}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--accent-primary)] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {isGeneratingLive
                      ? <><Loader2 size={12} className="animate-spin" /> Generating...</>
                      : <><Mic size={12} /> Read Live Update</>
                    }
                  </button>
                </div>
              </div>

              {/* Match status banner */}
              {liveNarrationMatch?.status && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-primary border border-border-subtle">
                  <span className="w-2 h-2 rounded-full bg-[#ef4444] animate-pulse flex-shrink-0" />
                  <span className="text-sm text-main font-medium">
                    {liveNarrationMatch.status}
                  </span>
                  {liveNarrationMatch?.score?.length > 0 && (
                    <span className="ml-auto text-xs text-muted">
                      {liveNarrationMatch.score.map(s => `${s.r}/${s.w} (${s.o})`).join(' • ')}
                    </span>
                  )}
                </div>
              )}

              {/* AI commentary lines */}
              {aiLiveLines.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {aiLiveLines.map((line, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-bg-primary border border-border-subtle group">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-0.5
                        ${i === 0 ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]'
                        : i === 1 ? 'bg-[var(--team-home)]/20 text-[var(--team-home)]'
                        : 'bg-[var(--accent-secondary)]/20 text-[var(--accent-secondary)]'}`}>
                        {i + 1}
                      </div>
                      <p className="text-sm leading-relaxed text-main flex-grow">{line}</p>
                      <button onClick={() => speak(line)} className="opacity-0 group-hover:opacity-100 text-muted hover:text-[var(--accent-primary)] transition-all flex-shrink-0">
                        <Play size={12} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      aiLiveLines.forEach(async (line, i) => {
                        await new Promise(r => setTimeout(r, i * 2500));
                        speak(line);
                      });
                    }}
                    className="flex items-center gap-1.5 text-[11px] text-[var(--accent-primary)] hover:opacity-80 transition-opacity self-start"
                  >
                    <Volume2 size={12} /> Read all {aiLiveLines.length} lines
                  </button>
                </div>
              ) : (
                <div className="text-center py-6 text-muted text-sm">
                  {isGeneratingLive
                    ? 'Generating live commentary...'
                    : 'Select a match above then press "Read Live Update" to hear AI commentary'}
                </div>
              )}
            </div>

            {/* ── Match Center ────────────────────────────────────────── */}
            {liveNarrationMatch && (
              <div className={`rounded-xl border p-5 flex flex-col gap-4 ${isDarkMode ? 'bg-[#18181b] border-[#3f3f46]' : 'bg-bg-card border-border-subtle'}`}>
                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <BarChart3 size={14} className="text-[var(--accent-primary)]" />
                    <span className="text-[11px] uppercase tracking-widest font-semibold text-muted">Match Center</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase border
                      ${liveNarrationMatch.matchStarted && !liveNarrationMatch.matchEnded
                        ? 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/20 animate-pulse'
                        : liveNarrationMatch.matchEnded
                        ? 'bg-border-subtle text-muted border-transparent'
                        : 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20'}`}>
                      {liveNarrationMatch.matchStarted && !liveNarrationMatch.matchEnded ? 'LIVE'
                        : liveNarrationMatch.matchEnded ? 'ENDED' : 'UPCOMING'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {isLoadingTab && <Loader2 size={14} className="animate-spin text-muted" />}
                    <a
                      href={`https://www.cricbuzz.com/live-cricket-scores/${liveNarrationMatch.id}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] text-muted hover:text-[var(--accent-primary)] transition-colors"
                    >
                      <ExternalLink size={10} /> View on Cricbuzz
                    </a>
                  </div>
                </div>

                {/* Match title + venue */}
                <div className="flex flex-col gap-1">
                  <div className="text-sm font-semibold text-main">{liveNarrationMatch.name}</div>
                  {liveNarrationMatch.venue && (
                    <div className="text-xs text-muted flex items-center gap-1">
                      <Info size={10} /> {liveNarrationMatch.venue}
                    </div>
                  )}
                </div>

                {/* Tab Switcher */}
                <div className="flex border-b border-border-subtle -mx-5 px-5">
                  {[
                    { id: 'overview', label: 'Overview', icon: BarChart3 },
                    { id: 'scorecard', label: 'Scorecard', icon: Award },
                    { id: 'commentary', label: 'Commentary', icon: Mic },
                    { id: 'squads', label: 'Squads', icon: Users },
                    { id: 'graphs', label: 'Graphs', icon: Zap },
                    { id: 'highlights', label: 'Highlights', icon: Video },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setMatchCenterTab(tab.id)}
                      className={`flex items-center gap-1.5 py-3 px-4 text-xs font-medium border-b-2 transition-all
                        ${matchCenterTab === tab.id
                          ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
                          : 'border-transparent text-muted hover:text-main'}`}
                    >
                      <tab.icon size={12} />
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div className="pt-2">
                  {matchCenterTab === 'overview' && (
                    <div className="flex flex-col gap-4">
                      {/* Detailed Player Stats (Striker, Non-Striker, Bowler) */}
                      {(matchDetail?.miniscore || matchDetail?.currentBatters) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Batters */}
                          <div className="flex flex-col gap-2 p-3 rounded-lg bg-bg-primary border border-border-subtle">
                            <div className="text-[9px] uppercase tracking-widest text-muted font-bold">Batting</div>
                            {matchDetail?.currentBatters ? (
                              matchDetail.currentBatters.map((b, i) => (
                                <div key={i} className={`flex justify-between items-center text-xs ${i === 0 ? '' : 'opacity-70'}`}>
                                  <span className={`text-main ${i === 0 ? 'font-medium' : ''}`}>
                                    {b.name}{i === 0 ? '*' : ''}
                                  </span>
                                  <span className="text-muted">
                                    {b.runs}({b.balls})
                                  </span>
                                </div>
                              ))
                            ) : (
                              <>
                                <div className="flex justify-between items-center text-xs">
                                  <span className="font-medium text-main">
                                    {matchDetail.miniscore?.batsmanStriker?.batName}*
                                  </span>
                                  <span className="text-muted">
                                    {matchDetail.miniscore?.batsmanStriker?.batRuns}({matchDetail.miniscore?.batsmanStriker?.batBalls})
                                  </span>
                                </div>
                                {matchDetail.miniscore?.batsmanNonStriker && (
                                  <div className="flex justify-between items-center text-xs opacity-70">
                                    <span className="text-main">
                                      {matchDetail.miniscore?.batsmanNonStriker?.batName}
                                    </span>
                                    <span className="text-muted">
                                      {matchDetail.miniscore?.batsmanNonStriker?.batRuns}({matchDetail.miniscore?.batsmanNonStriker?.batBalls})
                                    </span>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                          {/* Bowlers */}
                          <div className="flex flex-col gap-2 p-3 rounded-lg bg-bg-primary border border-border-subtle">
                            <div className="text-[9px] uppercase tracking-widest text-muted font-bold">Bowling</div>
                            {matchDetail?.currentBowler ? (
                              <div className="flex justify-between items-center text-xs">
                                <span className="font-medium text-main">
                                  {matchDetail.currentBowler.name}
                                </span>
                                <span className="text-muted">
                                  {matchDetail.currentBowler.wickets}-{matchDetail.currentBowler.runs} ({matchDetail.currentBowler.overs})
                                </span>
                              </div>
                            ) : (
                              <>
                                <div className="flex justify-between items-center text-xs">
                                  <span className="font-medium text-main">
                                    {matchDetail.miniscore?.bowlerStriker?.bowlName}
                                  </span>
                                  <span className="text-muted">
                                    {matchDetail.miniscore?.bowlerStriker?.bowlWkts}-{matchDetail.miniscore?.bowlerStriker?.bowlRuns} ({matchDetail.miniscore?.bowlerStriker?.bowlOvs})
                                  </span>
                                </div>
                                {matchDetail.miniscore?.bowlerNonStriker && (
                                  <div className="flex justify-between items-center text-xs opacity-70">
                                    <span className="text-main">
                                      {matchDetail.miniscore?.bowlerNonStriker?.bowlName}
                                    </span>
                                    <span className="text-muted">
                                      {matchDetail.miniscore?.bowlerNonStriker?.bowlWkts}-{matchDetail.miniscore?.bowlerNonStriker?.bowlRuns} ({matchDetail.miniscore?.bowlerNonStriker?.bowlOvs})
                                    </span>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Player Highlights (Latest Performance) */}
                      {(matchDetail?.miniscore?.latestPerformance || matchDetail?.keyStats) && (
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {matchDetail?.miniscore?.latestPerformance?.map((perf, i) => (
                            <div key={i} className="flex-shrink-0 px-3 py-1.5 rounded-full bg-[var(--accent-secondary)]/10 border border-[var(--accent-secondary)]/20 text-[10px] text-[var(--accent-secondary)] font-medium">
                              {perf.label}: {perf.runs}/{perf.wkts}
                            </div>
                          ))}
                          {matchDetail?.keyStats?.last5Overs && (
                            <div className="flex-shrink-0 px-3 py-1.5 rounded-full bg-[var(--accent-secondary)]/10 border border-[var(--accent-secondary)]/20 text-[10px] text-[var(--accent-secondary)] font-medium">
                              Last 5 overs: {matchDetail.keyStats.last5Overs}
                            </div>
                          )}
                          {(matchDetail?.miniscore?.recentOvsStats || matchDetail?.recentBalls) && (
                            <div className="flex-shrink-0 px-3 py-1.5 rounded-full bg-bg-primary border border-border-subtle text-[10px] text-muted flex gap-1">
                              Recent: {matchDetail?.recentBalls ? matchDetail.recentBalls.map(b => b.value).join(' ') : matchDetail.miniscore.recentOvsStats}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Teams + innings scores */}
                      <div className="grid grid-cols-2 gap-3">
                        {[0, 1].map(i => {
                          const teamName = liveNarrationMatch.teams?.[i] || `Team ${i + 1}`;
                          const shortname = liveNarrationMatch.teamInfo?.[i]?.shortname || teamName.substring(0, 3).toUpperCase();
                          const inning = liveNarrationMatch.score?.[i];
                          return (
                            <div key={i} className={`p-4 rounded-lg border bg-bg-primary
                              ${i === 0 ? 'border-[var(--team-home)]/30' : 'border-[var(--team-away)]/30'}`}>
                              <div className="flex items-center gap-2 mb-2">
                                <TeamLogo teamCode={shortname} sizeClass="w-6 h-6" />
                                <div className={`text-[10px] uppercase tracking-widest font-semibold
                                  ${i === 0 ? 'text-[var(--team-home)]' : 'text-[var(--team-away)]'}`}>
                                  {shortname}
                                </div>
                              </div>
                              <div className="text-2xl font-light tracking-tight text-main">
                                {inning ? `${inning.r}/${inning.w}` : '—'}
                              </div>
                              {inning?.o ? (
                                <div className="text-xs text-muted mt-0.5">({inning.o} ov)</div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>

                      {/* Live stats: Target / Need / CRR / RRR */}
                      {liveNarrationMatch.matchStarted && !liveNarrationMatch.matchEnded && (liveNarrationMatch.score?.length >= 2 || (matchDetail?.derived && matchDetail.derived.isChase)) && (() => {
                        const inn1 = liveNarrationMatch.score?.[0];
                        const inn2 = liveNarrationMatch.score?.[1];
                        const target = matchDetail?.derived?.runsRequired ? (matchDetail.derived.runsRequired + (inn2?.r || 0)) : (inn1 ? inn1.r + 1 : 0);
                        const runsNeeded = matchDetail?.derived?.runsRequired || (target - (inn2?.r || 0));
                        const crr = matchDetail?.currentRunRate || (inn2?.o > 0 ? (inn2.r / inn2.o).toFixed(2) : '0.00');
                        const rrr = matchDetail?.requiredRunRate || '∞';
                        
                        return (
                          <div className="flex flex-col gap-2">
                            <div className="grid grid-cols-4 gap-2">
                              {[
                                { label: 'Target', val: target || '—' },
                                { label: 'Need', val: runsNeeded || '—' },
                                { label: 'CRR', val: crr },
                                { label: 'RRR', val: rrr },
                              ].map(({ label, val }) => (
                                <div key={label} className="flex flex-col items-center p-2 rounded-lg bg-bg-primary border border-border-subtle">
                                  <div className="text-[9px] uppercase tracking-widest text-muted">{label}</div>
                                  <div className="text-sm font-semibold text-main mt-0.5">{val}</div>
                                </div>
                              ))}
                            </div>
                            {(matchDetail?.miniscore?.partnerShip || matchDetail?.keyStats?.partnership) && (
                              <div className="flex justify-between items-center px-3 py-1.5 rounded-lg bg-bg-primary border border-border-subtle text-[10px]">
                                <span className="text-muted uppercase tracking-widest">Partnership</span>
                                <span className="text-main font-semibold">
                                  {matchDetail?.keyStats?.partnership || `${matchDetail.miniscore.partnerShip.runs} (${matchDetail.miniscore.partnerShip.balls})`}
                                </span>
                              </div>
                            )}
                            {(matchDetail?.miniscore?.lastWicket || matchDetail?.keyStats?.lastWicket) && (
                              <div className="flex justify-between items-center px-3 py-1.5 rounded-lg bg-bg-primary border border-border-subtle text-[10px]">
                                <span className="text-[#ef4444] uppercase tracking-widest">Last Wicket</span>
                                <span className="text-main font-medium">{matchDetail?.keyStats?.lastWicket || matchDetail.miniscore.lastWicket}</span>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Current status text */}
                      {liveNarrationMatch.status && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-primary border border-border-subtle">
                          {liveNarrationMatch.matchStarted && !liveNarrationMatch.matchEnded && (
                            <span className="w-2 h-2 rounded-full bg-[#ef4444] animate-pulse flex-shrink-0" />
                          )}
                          <span className="text-sm text-main font-medium">{liveNarrationMatch.status}</span>
                        </div>
                      )}

                      {/* AI Deep Analysis */}
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => generateMatchAnalysis(liveNarrationMatch)}
                            disabled={isAnalyzing}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--accent-primary)]/20 hover:bg-[var(--accent-primary)]/20 transition-colors disabled:opacity-50"
                          >
                            {isAnalyzing
                              ? <><Loader2 size={12} className="animate-spin" /> Analyzing...</>
                              : <><Zap size={12} /> AI Deep Analysis</>}
                          </button>
                          <button
                            onClick={() => generateLiveCommentary(liveNarrationMatch)}
                            disabled={isGeneratingLive}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border-subtle text-muted hover:text-main hover:border-[var(--accent-primary)]/30 transition-colors disabled:opacity-50"
                          >
                            <Mic size={12} /> Live Commentary
                          </button>
                        </div>
                        {aiMatchAnalysis && (
                          <div className="p-4 rounded-lg bg-bg-primary border border-border-subtle">
                            <p className="text-sm leading-relaxed text-main whitespace-pre-line">{aiMatchAnalysis}</p>
                            <button
                              onClick={() => speak(aiMatchAnalysis.substring(0, 500))}
                              className="mt-3 flex items-center gap-1 text-[10px] text-muted hover:text-[var(--accent-primary)] transition-colors"
                            >
                              <Volume2 size={10} /> Read aloud
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {matchCenterTab === 'scorecard' && (
                    <div className="flex flex-col gap-6">
                      {scorecardData ? (
                        <>
                          {scorecardData.title && (
                            <div className="text-[10px] uppercase tracking-widest text-muted text-center border-b border-border-subtle pb-2 mb-2">
                              {scorecardData.title}
                            </div>
                          )}
                          {(scorecardData.innings || scorecardData.scoreCard)?.map((innings, idx) => (
                            <div key={idx} className="flex flex-col gap-3">
                              <div className="flex justify-between items-center bg-bg-primary p-3 rounded border border-border-subtle">
                                <span className="text-xs font-bold uppercase tracking-widest text-[var(--accent-primary)]">
                                  {innings.inningsNumber || (innings.inningsId === 1 ? '1st' : '2nd')} Innings — {innings.battingTeam || innings.batTeamName}
                                </span>
                                <span className="text-sm font-bold text-main">{innings.total || `${innings.score}/${innings.wickets}`} ({innings.overs})</span>
                              </div>
                              
                              {/* Batting Table */}
                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                  <thead className="border-b border-border-subtle text-muted">
                                    <tr>
                                      <th className="py-2 px-1">Batter</th>
                                      <th className="py-2 px-1 text-right">R</th>
                                      <th className="py-2 px-1 text-right">B</th>
                                      <th className="py-2 px-1 text-right">4s</th>
                                      <th className="py-2 px-1 text-right">6s</th>
                                      <th className="py-2 px-1 text-right">SR</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border-subtle/30">
                                    {(innings.batting || innings.batTable)?.map((p, i) => (
                                      <tr key={i} className="hover:bg-bg-primary/50 transition-colors">
                                        <td className="py-2 px-1 text-main font-medium">
                                          {p.name || p.batName}
                                          <div className="text-[10px] text-muted font-normal">{p.outDesc || p.dismissal}</div>
                                        </td>
                                        <td className="py-2 px-1 text-right font-bold text-main">{p.runs}</td>
                                        <td className="py-2 px-1 text-right text-muted">{p.balls}</td>
                                        <td className="py-2 px-1 text-right text-muted">{p.fours}</td>
                                        <td className="py-2 px-1 text-right text-muted">{p.sixes}</td>
                                        <td className="py-2 px-1 text-right text-muted">{p.strikeRate}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>

                              {/* Bowling Table */}
                              <div className="overflow-x-auto mt-2">
                                <table className="w-full text-left text-xs">
                                  <thead className="border-b border-border-subtle text-muted">
                                    <tr>
                                      <th className="py-2 px-1">Bowler</th>
                                      <th className="py-2 px-1 text-right">O</th>
                                      <th className="py-2 px-1 text-right">M</th>
                                      <th className="py-2 px-1 text-right">R</th>
                                      <th className="py-2 px-1 text-right">W</th>
                                      <th className="py-2 px-1 text-right">Eco</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border-subtle/30">
                                    {(innings.bowling || innings.bowlTable)?.map((p, i) => (
                                      <tr key={i} className="hover:bg-bg-primary/50 transition-colors">
                                        <td className="py-2 px-1 text-main font-medium">{p.name || p.bowlName}</td>
                                        <td className="py-2 px-1 text-right text-muted">{p.overs}</td>
                                        <td className="py-2 px-1 text-right text-muted">{p.maidens}</td>
                                        <td className="py-2 px-1 text-right text-muted">{p.runs}</td>
                                        <td className="py-2 px-1 text-right font-bold text-[var(--team-away)]">{p.wickets}</td>
                                        <td className="py-2 px-1 text-right text-muted">{p.economy}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>

                              {/* Fall of Wickets */}
                              {innings.fallOfWickets && innings.fallOfWickets.length > 0 && (
                                <div className="mt-4">
                                  <div className="text-[9px] uppercase tracking-widest text-muted font-bold mb-2">Fall of Wickets</div>
                                  <div className="flex flex-wrap gap-2">
                                    {innings.fallOfWickets.map((fow, i) => (
                                      <div key={i} className="text-[10px] px-2 py-1 rounded bg-bg-primary border border-border-subtle">
                                        <span className="text-main font-bold">{fow.score}-{fow.wicket}</span>
                                        <span className="text-muted ml-1">({fow.player}, {fow.over} ov)</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Partnerships */}
                              {innings.partnerships && innings.partnerships.length > 0 && (
                                <div className="mt-4">
                                  <div className="text-[9px] uppercase tracking-widest text-muted font-bold mb-2">Partnerships</div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {innings.partnerships.map((ps, i) => (
                                      <div key={i} className="flex justify-between items-center p-2 rounded bg-bg-primary border border-border-subtle text-[10px]">
                                        <span className="text-main">{ps.players}</span>
                                        <span className="text-[var(--accent-primary)] font-bold">{ps.runs} ({ps.balls})</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </>
                      ) : (
                        <div className="text-center py-12 text-muted text-sm">
                          {isLoadingTab ? 'Loading scorecard...' : 'Scorecard data not available yet.'}
                        </div>
                      )}
                    </div>
                  )}

                  {matchCenterTab === 'commentary' && (() => {
                    const items = fullCommentaryData?.latest
                      || fullCommentaryData?.commentaryList
                      || fullCommentaryData?.items
                      || fullCommentaryData?.data
                      || [];
                    const overSummaries = fullCommentaryData?.overSummaries || [];
                    
                    return (
                      <div className="flex flex-col gap-4 max-h-[700px] overflow-hidden">
                        {/* Over Summaries Panel */}
                        {overSummaries.length > 0 && (
                          <div className="flex flex-col gap-2 p-4 rounded-xl border border-border-subtle bg-bg-primary/50 backdrop-blur-sm">
                            <button
                              onClick={() => setShowOverSummaries(!showOverSummaries)}
                              className="flex items-center justify-between w-full text-left"
                            >
                              <div className="text-[10px] uppercase tracking-widest font-bold text-muted flex items-center gap-1.5">
                                <Zap size={10} className="text-[var(--accent-primary)]" /> Over Summaries
                              </div>
                              <div className="text-[10px] text-[var(--accent-primary)] font-bold">
                                {showOverSummaries ? 'HIDE' : 'SHOW'}
                              </div>
                            </button>
                            {showOverSummaries && (
                              <div className="flex gap-2 overflow-x-auto pb-1 mt-1 custom-scrollbar animate-in fade-in slide-in-from-top-1">
                                {overSummaries.map((os, i) => (
                                  <div key={i} className="flex-shrink-0 flex flex-col gap-1 p-2 rounded-lg border border-border-subtle bg-bg-card min-w-[120px]">
                                    <div className="flex justify-between items-center text-[10px] font-bold">
                                      <span className="text-muted">OVER {os.over}</span>
                                      <span className="text-main">{os.runs} RUNS</span>
                                    </div>
                                    <div className="flex gap-1">
                                      {os.balls?.map((b, bi) => (
                                        <div key={bi} className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold border
                                          ${b === 'W' ? 'border-red-500 text-red-500' : (b === '4' || b === '6') ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]' : 'border-border-subtle text-muted'}`}>
                                          {b}
                                        </div>
                                      ))}
                                    </div>
                                    <div className="text-[8px] text-muted truncate">{os.text}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex flex-col gap-px overflow-y-auto custom-scrollbar rounded-xl border border-border-subtle bg-bg-primary shadow-inner">
                          {items.length > 0 ? (
                            items.map((item, idx) => {
                              const overNum = item.overNumber ?? item.over;
                              const ballNum = item.ballNbr ?? item.ball;
                              const text = item.commText || item.text || '';
                              const eventRaw = Array.isArray(item.events)
                                ? item.events.join(',').toLowerCase()
                                : (item.event || '').toLowerCase();
                              
                              const isWicket = eventRaw.includes('wicket');
                              const isFour = eventRaw.includes('four') || eventRaw.includes('boundary_4');
                              const isSix = eventRaw.includes('six') || eventRaw.includes('boundary_6');
                              const isExtra = eventRaw.includes('extra') || eventRaw.includes('wide') || eventRaw.includes('no_ball');
                              
                              const eventLabel = isWicket ? 'W'
                                : isSix ? '6'
                                : isFour ? '4'
                                : eventRaw.includes('wide') ? 'Wd'
                                : eventRaw.includes('no_ball') ? 'Nb'
                                : null;

                              const score = item.batTeamScore || item.score;
                              
                              return (
                                <div key={idx} className="p-5 border-b border-border-subtle/30 last:border-0 hover:bg-bg-card/50 transition-all flex gap-6 group">
                                  {/* Left Column: Over & Event Icon */}
                                  <div className="w-16 flex-shrink-0 flex flex-col items-center gap-2">
                                    <div className="text-xs font-bold font-mono text-main">
                                      {overNum != null ? `${overNum}${ballNum != null ? '.' + ballNum : ''}` : '—'}
                                    </div>
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black shadow-sm transition-transform group-hover:scale-110
                                      ${isWicket ? 'bg-red-500 text-white shadow-red-500/20'
                                        : isSix ? 'bg-purple-600 text-white shadow-purple-600/20'
                                        : isFour ? 'bg-green-600 text-white shadow-green-600/20'
                                        : isExtra ? 'bg-yellow-500 text-black shadow-yellow-500/20'
                                        : 'bg-bg-primary border border-border-subtle text-muted'}`}>
                                      {eventLabel || (item.event === 'over_end' ? 'END' : '•')}
                                    </div>
                                  </div>

                                  {/* Right Column: Commentary & Score */}
                                  <div className="flex-grow min-w-0 flex flex-col gap-2">
                                    <div className="text-sm leading-relaxed text-main font-medium group-hover:text-[var(--accent-primary)] transition-colors">
                                      {text}
                                    </div>
                                    {score && (
                                      <div className="flex items-center gap-2">
                                        <div className="px-2 py-0.5 rounded bg-bg-primary border border-border-subtle text-[10px] font-bold font-mono text-muted group-hover:text-main transition-colors">
                                          {score}
                                        </div>
                                        {item.event === 'over_end' && (
                                          <div className="h-[1px] flex-grow bg-border-subtle/50" />
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div className="text-center py-12 text-muted text-sm">
                              {isLoadingTab ? 'Loading commentary…' : 'Commentary not available for this match.'}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {matchCenterTab === 'squads' && (
                    <div className="flex flex-col gap-6">
                      {squadsData?.teams?.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {squadsData.teams.map((t, idx) => (
                            <div key={idx} className="flex flex-col gap-3">
                              <div className="flex items-center gap-2 bg-bg-primary p-2 rounded border border-border-subtle">
                                <TeamLogo teamCode={t.shortName || t.name?.substring(0,3).toUpperCase()} sizeClass="w-5 h-5" />
                                <span className="text-xs font-bold uppercase tracking-widest text-main">{t.name}</span>
                              </div>
                              <div className="flex flex-col gap-1.5">
                                {t.playingXI?.map((player, i) => (
                                  <div key={i} className="flex items-center justify-between p-2 rounded hover:bg-bg-primary/50 border border-transparent hover:border-border-subtle/50 transition-all text-xs">
                                    <div className="flex items-center gap-2">
                                      <span className="text-main font-medium">{player.name}</span>
                                      {player.isCaptain && <span className="text-[9px] px-1 bg-[var(--accent-primary)] text-white rounded-sm font-bold">C</span>}
                                      {player.isWicketKeeper && <span className="text-[9px] px-1 bg-border-subtle text-muted rounded-sm font-bold">WK</span>}
                                    </div>
                                    <span className="text-muted capitalize">{player.role}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-12 text-muted text-sm">
                          {isLoadingTab ? 'Loading squads...' : 'Squad details not available.'}
                        </div>
                      )}
                    </div>
                  )}

                  {matchCenterTab === 'graphs' && (
                    <GraphsTab
                      graphsSubTab={graphsSubTab}
                      setGraphsSubTab={setGraphsSubTab}
                      graphsData={graphsData}
                      isLoadingGraph={isLoadingGraph}
                      isDarkMode={isDarkMode}
                    />
                  )}

                  {matchCenterTab === 'highlights' && (
                    <HighlightsTab
                      highlightsData={highlightsData}
                      isLoadingTab={isLoadingTab}
                      isDarkMode={isDarkMode}
                    />
                  )}
                </div>

                {/* Quick actions moved to bottom */}
                <div className="flex gap-2 flex-wrap pt-3 border-t border-border-subtle">
                  <a
                    href={`https://www.cricbuzz.com/cricket-match-highlights/${liveNarrationMatch.id}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-subtle text-xs text-muted hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)]/30 transition-all"
                  >
                    <ExternalLink size={10} /> Match Highlights
                  </a>
                  <button
                    onClick={() => {
                      if (matchCenterTab === 'commentary') setMatchCenterTab('overview');
                      else setMatchCenterTab('commentary');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-subtle text-xs text-muted hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)]/30 transition-all"
                  >
                    <Mic size={10} /> {matchCenterTab === 'commentary' ? 'Hide' : 'Show'} Full History
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'schedule' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-fade-in">
            <div className="md:col-span-2 flex flex-col gap-4">
              <h2 className="text-2xl font-medium tracking-tight mb-4">{t.fixtures}</h2>
              {scheduleData.map(match => (
                <div key={match.id} className="bg-bg-card p-5 rounded-xl border border-border-subtle flex items-center justify-between transition-all group">
                  <div className="flex-1">
                      <div className="text-[10px] text-muted font-semibold tracking-widest uppercase mb-2">{t.match} {match.id} • {match.date}</div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 flex-1">
                        <TeamLogo teamCode={match.t1} />
                        <span className="font-semibold text-lg tracking-tight text-main">{teams[match.t1].n}</span>
                      </div>
                      <div className="text-muted text-sm italic">vs</div>
                      <div className="flex items-center gap-2 flex-1 flex-row-reverse text-right">
                        <TeamLogo teamCode={match.t2} />
                        <span className="font-semibold text-lg tracking-tight text-main">{teams[match.t2].n}</span>
                      </div>
                    </div>
                    <div className="text-xs text-muted mt-2">{match.venue}</div>
                  </div>
                  <div className="ml-8 text-right">
                    {match.s === 'live' ? (
                      <div className="flex flex-col items-end gap-2">
                        <span className="bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20 px-3 py-1 rounded text-[10px] font-semibold uppercase animate-pulse">Live</span>
                        <button onClick={() => setActiveTab('live')} className="bg-main text-black px-4 py-2 rounded text-sm font-medium hover:bg-[#ccc] transition-colors">{t.watch}</button>
                      </div>
                    ) : match.s === 'done' ? (
                      <div className="flex flex-col items-end gap-1">
                        <span className="bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20 px-3 py-1 rounded text-[10px] font-semibold uppercase">{t.completed}</span>
                        <div className="text-xs text-muted">{match.r}</div>
                      </div>
                    ) : (
                      <span className="bg-bg-primary text-muted px-3 py-1 rounded text-[10px] font-semibold uppercase tracking-widest border border-border-subtle">{t.upcoming}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-4">
              <h2 className="text-2xl font-medium tracking-tight mb-4">{t.pointsTable}</h2>
              <div className="bg-bg-card rounded-xl border border-border-subtle overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-bg-primary text-[10px] font-semibold text-muted uppercase tracking-widest">
                    <tr>
                      <th className="p-4 font-medium">{t.team}</th>
                      <th className="p-4 text-center font-medium">P</th>
                      <th className="p-4 text-center font-medium">W</th>
                      <th className="p-4 text-center font-medium">{t.pts}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {(standings.length > 0 ? standings : fallbackPtsData).map((team, idx) => {
                      const teamCode = team.t || team.team;
                      const teamName = team.team || team.t;
                      const played = team.p || team.played;
                      const won = team.w || team.won;
                      const points = team.pt || team.points;
                      const img = team.img;

                      return (
                        <tr key={teamCode} className="transition-all" style={idx < 4 ? { backgroundColor: isDarkMode ? 'rgba(56, 189, 248, 0.05)' : 'rgba(14, 165, 233, 0.05)' } : {}}>
                          <td className="p-4 flex items-center gap-3">
                            <span className="text-xs font-semibold text-muted">{idx+1}</span>
                            {img ? <img src={img} alt={teamName} className="w-5 h-5 object-contain" /> : <TeamLogo teamCode={teamCode} sizeClass="w-5 h-5" />}
                            <span className="font-semibold text-sm tracking-tight text-main">{teamCode}</span>
                          </td>
                          <td className="p-4 text-center text-sm text-muted">{played}</td>
                          <td className="p-4 text-center text-sm text-muted">{won}</td>
                          <td className="p-4 text-center font-medium text-main text-lg">{points}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

// ─── Graphs Tab ───────────────────────────────────────────────────────────────

const GRAPH_TABS = [
  { id: 'win-probability', label: 'Win Probability' },
  { id: 'worm', label: 'Worm' },
  { id: 'overs', label: 'Overs' },
  { id: 'run-rate', label: 'Run Rate' },
  { id: 'partnerships', label: 'Partnerships' },
  { id: 'ball-map', label: 'Ball Map' },
];

const INNINGS_COLORS = [
  { border: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
  { border: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
];

const BASE_CHART_OPTIONS = (isDarkMode) => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: isDarkMode ? '#a1a1aa' : '#6b7280', boxWidth: 12, font: { size: 11 } } },
    tooltip: { mode: 'index', intersect: false },
  },
  scales: {
    x: { ticks: { color: isDarkMode ? '#71717a' : '#9ca3af', font: { size: 10 } }, grid: { color: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' } },
    y: { ticks: { color: isDarkMode ? '#71717a' : '#9ca3af', font: { size: 10 } }, grid: { color: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' } },
  },
});

function getBallChipStyle(label, event) {
  if (!label && !event) return { bg: '#3f3f46', text: '#a1a1aa', display: '·' };
  const ev = (event || '').toUpperCase();
  const lb = (label || '').toString();
  if (ev.includes('WICKET')) return { bg: '#dc2626', text: '#fff', display: 'W' };
  if (lb === '6' || lb === 'SIX') return { bg: '#7c3aed', text: '#fff', display: '6' };
  if (lb === '4' || lb === 'FOUR') return { bg: '#0891b2', text: '#fff', display: '4' };
  if (ev.includes('WIDE') || lb.startsWith('Wd')) return { bg: '#4b5563', text: '#d1fae5', display: 'Wd' };
  if (ev.includes('NO_BALL') || lb.startsWith('Nb')) return { bg: '#92400e', text: '#fef3c7', display: 'Nb' };
  if (lb === '0' || lb === '.' || lb === '') return { bg: '#27272a', text: '#71717a', display: '·' };
  return { bg: '#1d4ed8', text: '#fff', display: lb };
}

function BallMapDisplay({ data }) {
  if (!data?.ok || !data.balls?.length) return <div className="text-center py-8 text-muted text-sm">Ball map data not available.</div>;

  const overMap = new Map();
  [...data.balls].reverse().forEach(b => {
    const ov = Math.floor(b.overNum);
    if (!overMap.has(ov)) overMap.set(ov, []);
    overMap.get(ov).push(b);
  });

  const overEntries = [...overMap.entries()].sort((a, b) => a[0] - b[0]);

  return (
    <div className="space-y-2 font-mono">
      <div className="grid grid-cols-[2rem_1fr] gap-x-3 text-[9px] text-muted uppercase tracking-wider mb-1 px-1">
        <span>Ov</span><span>Balls</span>
      </div>
      {overEntries.map(([ov, balls]) => {
        const overRuns = balls.reduce((s, b) => s + (b.totalRuns || 0), 0);
        return (
          <div key={ov} className="grid grid-cols-[2rem_1fr_2rem] gap-x-3 items-center">
            <span className="text-[10px] text-muted text-right">{ov + 1}</span>
            <div className="flex gap-1 flex-wrap">
              {balls.map((b, i) => {
                const chip = getBallChipStyle(b.ballLabel, b.event);
                return (
                  <div
                    key={i}
                    title={`${b.event || ''} ${b.totalRuns ?? ''}r`}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold leading-none flex-shrink-0"
                    style={{ backgroundColor: chip.bg, color: chip.text }}
                  >
                    {chip.display}
                  </div>
                );
              })}
            </div>
            <span className="text-[10px] text-muted">{overRuns}</span>
          </div>
        );
      })}
    </div>
  );
}

function GraphsTab({ graphsSubTab, setGraphsSubTab, graphsData, isLoadingGraph, isDarkMode }) {
  const [ballMapInnings, setBallMapInnings] = useState(1);

  const winProbAvailable = !isLoadingGraph && graphsData.winProb?.ok === true && graphsData.winProb?.points?.length > 0;
  const visibleTabs = isLoadingGraph
    ? GRAPH_TABS
    : GRAPH_TABS.filter(t => t.id !== 'win-probability' || winProbAvailable);

  useEffect(() => {
    if (!isLoadingGraph && graphsSubTab === 'win-probability' && !winProbAvailable && visibleTabs.length > 0) {
      setGraphsSubTab(visibleTabs[0].id);
    }
  }, [isLoadingGraph, winProbAvailable]);

  if (isLoadingGraph) {
    return <div className="text-center py-12 text-muted text-sm animate-pulse">Loading graphs…</div>;
  }

  const chartOpts = BASE_CHART_OPTIONS(isDarkMode);

  const renderGraph = () => {
    if (graphsSubTab === 'win-probability') {
      const d = graphsData.winProb;
      if (!d?.ok || !d.points?.length) return <div className="text-center py-8 text-muted text-sm">Win probability data not available.</div>;
      const labels = d.points.map(p => `${p.overNum}.${p.ballNbr % 6}`);
      return (
        <div className="h-72">
          <Line
            data={{
              labels,
              datasets: [
                { label: d.team1Name || 'Team 1', data: d.points.map(p => p.team1WinPct), borderColor: INNINGS_COLORS[0].border, backgroundColor: INNINGS_COLORS[0].bg, borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0 },
                { label: d.team2Name || 'Team 2', data: d.points.map(p => p.team2WinPct), borderColor: INNINGS_COLORS[1].border, backgroundColor: INNINGS_COLORS[1].bg, borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0 },
              ]
            }}
            options={{ ...chartOpts, scales: { ...chartOpts.scales, y: { ...chartOpts.scales.y, min: 0, max: 100, ticks: { ...chartOpts.scales.y.ticks, callback: v => v + '%' } } } }}
          />
        </div>
      );
    }

    if (graphsSubTab === 'worm') {
      const d = graphsData.worm;
      if (!d?.ok || !d.innings?.length) return <div className="text-center py-8 text-muted text-sm">Worm data not available.</div>;
      const maxOvers = Math.max(...d.innings.map(i => i.overs.length));
      const labels = Array.from({ length: maxOvers }, (_, i) => String(i + 1));
      return (
        <div className="h-72">
          <Line
            data={{
              labels,
              datasets: d.innings.map((inn, idx) => ({
                label: inn.batTeamName || `Innings ${inn.inningsId}`,
                data: inn.overs.map(o => o.cumulative),
                borderColor: INNINGS_COLORS[idx]?.border || '#8b5cf6',
                backgroundColor: 'transparent',
                borderWidth: 2, tension: 0.3, pointRadius: 2,
              }))
            }}
            options={chartOpts}
          />
        </div>
      );
    }

    if (graphsSubTab === 'overs') {
      const d = graphsData.overs;
      if (!d?.ok || !d.innings?.length) return <div className="text-center py-8 text-muted text-sm">Overs data not available.</div>;
      const maxOvers = Math.max(...d.innings.map(i => i.overs.length));
      const labels = Array.from({ length: maxOvers }, (_, i) => String(i + 1));
      return (
        <div className="h-72">
          <Bar
            data={{
              labels,
              datasets: d.innings.map((inn, idx) => ({
                label: inn.batTeamName || `Innings ${inn.inningsId}`,
                data: inn.overs.map(o => o.runs),
                backgroundColor: INNINGS_COLORS[idx]?.bg || 'rgba(139,92,246,0.3)',
                borderColor: INNINGS_COLORS[idx]?.border || '#8b5cf6',
                borderWidth: 1,
              }))
            }}
            options={{ ...chartOpts, scales: { ...chartOpts.scales, x: { ...chartOpts.scales.x, stacked: false } } }}
          />
        </div>
      );
    }

    if (graphsSubTab === 'run-rate') {
      const d = graphsData.runRate;
      if (!d?.ok || !d.innings?.length) return <div className="text-center py-8 text-muted text-sm">Run rate data not available.</div>;
      const maxOvers = Math.max(...d.innings.map(i => i.overs.length));
      const labels = Array.from({ length: maxOvers }, (_, i) => String(i + 1));
      return (
        <div className="h-72">
          <Line
            data={{
              labels,
              datasets: d.innings.map((inn, idx) => ({
                label: inn.batTeamName || `Innings ${inn.inningsId}`,
                data: inn.overs.map(o => o.runRate),
                borderColor: INNINGS_COLORS[idx]?.border || '#8b5cf6',
                backgroundColor: 'transparent',
                borderWidth: 2, tension: 0.4, pointRadius: 2,
              }))
            }}
            options={chartOpts}
          />
        </div>
      );
    }

    if (graphsSubTab === 'partnerships') {
      const d = graphsData.partnerships;
      if (!d?.ok || !d.innings?.length) return <div className="text-center py-8 text-muted text-sm">Partnership data not available.</div>;
      return (
        <div className="space-y-6">
          {d.innings.map((inn, idx) => (
            <div key={inn.inningsId}>
              <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: INNINGS_COLORS[idx]?.border }}>{inn.batTeamName || `Innings ${inn.inningsId}`}</div>
              <div className="space-y-2">
                {inn.partnerships.map((p, i) => {
                  const maxRuns = Math.max(...inn.partnerships.map(x => x.totalRuns), 1);
                  const pct = (p.totalRuns / maxRuns) * 100;
                  return (
                    <div key={i} className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center text-xs">
                      <div className="text-right text-muted truncate">{p.bat1Name} <span className="font-bold text-main">{p.bat1Runs}({p.bat1Balls})</span></div>
                      <div className="w-24 h-3 rounded-full bg-bg-primary overflow-hidden flex-shrink-0">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: INNINGS_COLORS[idx]?.border }} />
                      </div>
                      <div className="text-muted truncate"><span className="font-bold text-main">{p.bat2Runs}({p.bat2Balls})</span> {p.bat2Name}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (graphsSubTab === 'ball-map') {
      const data = ballMapInnings === 1 ? graphsData.ballMap1 : graphsData.ballMap2;
      return (
        <div>
          <div className="flex gap-2 mb-4">
            {[1, 2].map(i => (
              <button key={i} onClick={() => setBallMapInnings(i)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${ballMapInnings === i ? 'bg-[var(--accent-primary)] text-white' : 'bg-bg-primary border border-border-subtle text-muted hover:text-main'}`}>
                {i === 1 ? '1st Inn' : '2nd Inn'}
              </button>
            ))}
          </div>
          <BallMapDisplay data={data} />
        </div>
      );
    }

    return null;
  };

  return (
    <div className="pt-2">
      <div className="flex gap-1 flex-wrap mb-4">
        {visibleTabs.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setGraphsSubTab(id)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
              graphsSubTab === id
                ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                : 'border-border-subtle text-muted hover:text-main'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {renderGraph()}
    </div>
  );
}

// ─── Highlights Tab ───────────────────────────────────────────────────────────

function getHighlightBadge(events) {
  if (!events?.length) return null;
  const flat = events.map(e => e.toUpperCase()).join(',');
  if (flat.includes('WICKET')) return { color: '#dc2626', label: 'WICKET' };
  if (flat.includes('SIX')) return { color: '#7c3aed', label: 'SIX' };
  if (flat.includes('FOUR')) return { color: '#0891b2', label: 'FOUR' };
  if (flat.includes('OVER-BREAK') || flat.includes('OVER_BREAK')) return { color: '#6b7280', label: 'END OF OVER' };
  if (flat.includes('DROP')) return { color: '#f59e0b', label: 'DROP' };
  if (flat.includes('MILESTONE')) return { color: '#10b981', label: 'MILESTONE' };
  return { color: '#52525b', label: events[0] };
}

function HighlightsTab({ highlightsData, isLoadingTab, isDarkMode }) {
  const [inn, setInn] = useState(1);

  if (isLoadingTab) {
    return <div className="text-center py-12 text-muted text-sm animate-pulse">Loading highlights…</div>;
  }

  const data = inn === 1 ? highlightsData.inn1 : highlightsData.inn2;
  const highlights = data?.highlights || [];

  return (
    <div className="pt-2">
      <div className="flex gap-2 mb-4">
        {[1, 2].map(i => (
          <button
            key={i}
            onClick={() => setInn(i)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              inn === i ? 'bg-[var(--accent-primary)] text-white' : 'bg-bg-primary border border-border-subtle text-muted hover:text-main'
            }`}
          >
            {i === 1 ? '1st Innings' : '2nd Innings'}
          </button>
        ))}
      </div>

      {highlights.length === 0 ? (
        <div className="text-center py-8 text-muted text-sm">
          {data === null ? 'No highlights available for this innings.' : 'No key moments found.'}
        </div>
      ) : (
        <div className="space-y-2">
          {highlights.map((h, i) => {
            if (h.overSeparator) {
              return (
                <div key={i} className="px-3 py-2 rounded-lg bg-bg-primary border border-border-subtle/40 text-[10px] text-muted italic">
                  {h.commText}
                </div>
              );
            }
            const badge = getHighlightBadge(h.events);
            return (
              <div
                key={i}
                className={`flex gap-3 items-start p-3 rounded-lg border ${
                  isDarkMode ? 'bg-[#18181b] border-[#3f3f46]' : 'bg-bg-card border-border-subtle'
                }`}
              >
                <div className="flex-shrink-0 flex flex-col items-center gap-1 w-12 text-center">
                  <span className="text-[9px] text-muted font-mono">Ov {h.overNumber}</span>
                  {badge && (
                    <span
                      className="text-[8px] font-bold px-1 py-0.5 rounded uppercase leading-tight"
                      style={{ backgroundColor: badge.color + '22', color: badge.color }}
                    >
                      {badge.label}
                    </span>
                  )}
                  {h.totalRuns != null && (
                    <span className="text-[9px] font-bold text-main">{h.totalRuns}r</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-main leading-relaxed">{h.commText}</p>
                  <div className="flex items-center gap-2 mt-1.5 text-[9px] text-muted flex-wrap">
                    {h.batsmanStriker && <span className="font-medium">{h.batsmanStriker.batName || h.batsmanStriker}</span>}
                    {h.bowlerStriker && <><span>•</span><span>{h.bowlerStriker.bowlName || h.bowlerStriker}</span></>}
                    {h.batTeamScore && (
                      <span className="ml-auto font-mono text-[10px] text-main">{h.batTeamScore}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default CricketBoard;
