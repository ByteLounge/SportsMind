import React, { useState, useEffect, useRef } from 'react';
import { Play, Mic, Sun, Moon, Share2, Activity, ArrowRight, Trophy } from 'lucide-react';
import { mockData as initialMockData, globalNews as initialNews } from '../mockData';
import { GEMINI_API_KEY, ELEVENLABS_API_KEY, generateAICommentary, speak } from '../utils/api';
import { fetchSportsNews, fetchFootballLiveMatches, fetchCricketLiveMatches, fetchBasketballLiveMatches, fetchTennisLiveMatches, fetchCricketStandings, fetchFootballStandings, fetchNewsByTopic, fetchPlayersByTeam, fetchSystemHealth } from '../utils/apiData';

const ads = [
  { brand: 'NIKE', text: 'Just Do It', sub: 'Official Kit Partner', cta: 'Shop Now', bg: 'bg-black text-white' },
  { brand: 'ADIDAS', text: 'Impossible Is Nothing', sub: 'Official Footwear Partner', cta: 'View Kicks', bg: 'bg-zinc-900 text-white' },
  { brand: 'DREAM11', text: 'Play Fantasy Sports', sub: 'India\'s Biggest Fantasy Platform', cta: 'Play Now', bg: 'bg-red-600 text-white' }
];

export default function SportsMind({ isDarkMode, toggleTheme, navigate }) {
  const [activeTab, setActiveTab] = useState('home');
  const [aiActive, setAiActive] = useState(false);
  const [voiceMode, setVoiceMode] = useState('browser');
  const [adIndex, setAdIndex] = useState(0);
  const [showAd, setShowAd] = useState(true);
  const [feed, setFeed] = useState([]);
  const [thinking, setThinking] = useState(false);
  
  const [newsFeed, setNewsFeed] = useState(initialNews);
  const [appData, setAppData] = useState(initialMockData);
  const [currentSport, setCurrentSport] = useState('cricket');
  const [activeCricketMatch, setActiveCricketMatch] = useState(null);
  const [backendHealth, setBackendHealth] = useState(null);

  const lastNarratedBallHome = useRef(null);

  useEffect(() => {
    async function loadSportNews() {
      if (['cricket', 'football', 'basketball', 'tennis', 'f1', 'hockey'].includes(activeTab)) {
        const news = await fetchNewsByTopic(activeTab);
        if (news && news.length > 0) {
          setAppData(prev => ({
            ...prev,
            [activeTab]: {
              ...prev[activeTab],
              news: news
            }
          }));
        }
      }
    }
    loadSportNews();
  }, [activeTab]);

  const loadRealData = async () => {
    const news = await fetchSportsNews();
    if (news && news.length > 0) setNewsFeed(news);

    const [footballLive, cricketLive] = await Promise.all([
      fetchFootballLiveMatches(),
      fetchCricketLiveMatches()
    ]);

    let newData = { ...initialMockData };

    if (footballLive && footballLive.length > 0) {
      const topMatch = footballLive[0];
      newData.football = {
        ...newData.football,
        match: {
          ...newData.football.match,
          team1: {
            name: topMatch.teams.home.name,
            short: topMatch.teams.home.name.substring(0, 3).toUpperCase(),
            score: topMatch.goals?.home ?? 0,
            color: '#FF0000',
            overs: `${topMatch.fixture?.status?.elapsed || 0}'`
          },
          team2: {
            name: topMatch.teams.away.name,
            short: topMatch.teams.away.name.substring(0, 3).toUpperCase(),
            score: topMatch.goals?.away ?? 0,
            color: '#0000FF'
          },
          status: `${topMatch.fixture?.status?.elapsed || 0}' — ${topMatch.league?.name || 'Live'}`,
        }
      };
    }

    if (cricketLive && cricketLive.length > 0) {
      const topMatch = cricketLive.find(m => m.matchStarted && !m.matchEnded) || cricketLive[0];
      setActiveCricketMatch(topMatch);
      const team1Score = topMatch.score?.[0];
      const team2Score = topMatch.score?.[1];
      newData.cricket = {
        ...newData.cricket,
        match: {
          ...newData.cricket.match,
          team1: {
            name: topMatch.teams[0],
            short: (topMatch.teamInfo?.[0]?.shortname || topMatch.teams[0].substring(0, 3)).toUpperCase(),
            score: team1Score ? `${team1Score.r}/${team1Score.w}` : '0/0',
            color: '#004BA0',
            overs: team1Score ? `(${team1Score.o} ov)` : ''
          },
          team2: {
            name: topMatch.teams[1],
            short: (topMatch.teamInfo?.[1]?.shortname || topMatch.teams[1].substring(0, 3)).toUpperCase(),
            score: team2Score ? `${team2Score.r}/${team2Score.w}` : (topMatch.matchStarted ? 'YTB' : 'TBD'),
            color: '#E41E26'
          },
          status: topMatch.status,
          id: topMatch.id,
          slug: topMatch.slug
        }
      };

      // Fetch real players for Spotlight
      try {
        const realPlayers = await fetchPlayersByTeam("2"); // India
        if (realPlayers && realPlayers.length > 0) {
          newData.cricket.players = realPlayers.slice(0, 5).map(p => ({
            name: p.title,
            team: "India",
            role: "International",
            stats: "Live Form",
            form: "Hot"
          }));
        }
      } catch (e) {
        console.warn("Spotlight player fetch failed", e);
      }
    }

    setAppData(newData);
  };

  useEffect(() => {
    loadRealData();
    // Auto-refresh live data every 60 seconds
    const refreshInterval = setInterval(loadRealData, 60000);

    // Backend health check
    const checkHealth = async () => {
      const health = await fetchSystemHealth();
      setBackendHealth(health);
    };
    checkHealth();
    const healthInterval = setInterval(checkHealth, 30000);

    return () => {
      clearInterval(refreshInterval);
      clearInterval(healthInterval);
    };
  }, []);

  useEffect(() => {
    if (showAd) {
      const int = setInterval(() => setAdIndex(i => (i + 1) % ads.length), 4000);
      return () => clearInterval(int);
    }
  }, [showAd]);

  useEffect(() => {
    let int;
    if (aiActive && activeTab !== 'home' && activeTab !== 'news' && activeTab !== 'standings') {
      int = setInterval(() => {
        pollMatchData(activeTab);
      }, 15000);
    }
    return () => clearInterval(int);
  }, [aiActive, activeTab]);

  const pollMatchData = async (sportKey) => {
    setThinking(true);
    const sport = appData[sportKey];

    // Real Data Polling for Cricket
    if (sportKey === 'cricket' && activeCricketMatch?.id) {
      try {
        const detail = await fetchCricketMatchDetail(activeCricketMatch.id, activeCricketMatch.slug);
        if (detail) {
          const latestBall = detail.latestCommentary || (detail.commentaryList && detail.commentaryList[0]);
          if (latestBall) {
            const ballKey = latestBall.timestamp ? `${latestBall.overNumber || latestBall.over}-${latestBall.timestamp}` : `${latestBall.over}.${latestBall.ball}-${latestBall.text}`;
            
            if (lastNarratedBallHome.current !== ballKey) {
              lastNarratedBallHome.current = ballKey;
              const over = latestBall.overNumber || latestBall.over || '';
              const ball = latestBall.ball || '';
              const text = latestBall.commText || latestBall.text || '';
              
              if (text) {
                const aiRes = {
                  commentary: `${over}${ball ? '.' + ball : ''}, ${text}`,
                  insight: detail.keyStats?.partnership || detail.status || 'Match in progress',
                  alert: latestBall.event === 'WICKET' || latestBall.event === 'wicket' ? 'WICKET' : null,
                };
                setFeed(prev => [aiRes, ...prev]);
                if (voiceMode === 'hd' && ELEVENLABS_API_KEY) {
                  speak(aiRes.commentary, false, 'hd');
                } else {
                  speak(aiRes.commentary, false, 'browser');
                }
              }
            }
          }
        }
      } catch (e) {
        console.error("Real poll failed:", e);
      }
      setThinking(false);
      return;
    }
    
    // Simulate real delta context for other sports or if real data fails
    const isWicket = Math.random() > 0.8;
    const runs = isWicket ? 0 : Math.floor(Math.random() * 7);
    
    const payload = JSON.stringify({
      matchMetadata: {
        matchName: sport.match.name || `${sport.match.team1.name} vs ${sport.match.team2.name}`,
        matchType: "T20",
        venue: sport.match.venue || "Stadium",
        status: sport.match.status,
        teams: [sport.match.team1.name, sport.match.team2.name],
        persona: "expert"
      },
      previousState: {
        score: sport.match.team1.score,
        overs: sport.match.team1.overs || "15.0"
      },
      currentState: {
        score: sport.match.team1.score + (runs ? runs : 0),
        overs: "15.1"
      },
      delta: {
        runsDelta: runs,
        wicketsDelta: isWicket ? 1 : 0,
        oversDelta: 0.1,
        overCompleted: false
      }
    });
    
    try {
      const res = await generateAICommentary(payload, {
        eventType: "unknown",
        commentary: "It's a tense moment out there in the middle.",
        shortHeadline: "Tense moments",
        momentum: "medium",
        emotion: 5,
        isMajorMoment: false,
        needsAudioEmphasis: false,
        colorHint: "neutral"
      });
      
      setFeed(prev => [res, ...prev]);
      if (voiceMode === 'hd' && ELEVENLABS_API_KEY) {
        speak(res.commentary, false, 'hd');
      } else {
        speak(res.commentary, false, 'browser');
      }
    } catch (e) {
      console.error(e);
    }
    setThinking(false);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (appData[tab]) setCurrentSport(tab);
    setFeed([]); // clear feed on change
    // set theme based on sport
    document.body.className = isDarkMode ? 'dark' : '';
    if (appData[tab]) document.body.style.setProperty('--accent-primary', appData[tab].color);
  };

  return (
    <div className={`min-h-screen bg-bg-primary text-main transition-colors duration-500 flex flex-col font-sans ${isDarkMode ? 'dark' : ''}`}>
      
      {/* Top Ad Banner */}
      {showAd && (
        <div className={`w-full h-16 md:h-24 ${ads[adIndex].bg} flex items-center justify-between px-6 transition-all duration-500 relative`}>
          <div className="flex flex-col">
            <h3 className="font-bold text-xl">{ads[adIndex].brand} — {ads[adIndex].text}</h3>
            <p className="text-sm opacity-80">{ads[adIndex].sub}</p>
          </div>
          <button className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded font-semibold text-sm transition-colors">{ads[adIndex].cta}</button>
          <span className="absolute top-2 right-10 text-[10px] opacity-50 font-bold">AD</span>
          <button onClick={() => setShowAd(false)} className="absolute top-2 right-2 text-white/50 hover:text-white">✕</button>
        </div>
      )}

      {/* Breaking News Ticker */}
      <div className="w-full bg-[#FF6B00] text-white text-sm font-bold flex overflow-hidden whitespace-nowrap py-2">
        <div className="animate-marquee inline-block px-4">
          {newsFeed.map((n, i) => <span key={i} className="mx-4">{n.title || n} &bull;</span>)}
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-grow p-6 md:p-10 max-w-7xl mx-auto w-full">
        <HomeView onSelect={navigate} appData={appData} newsFeed={newsFeed} onLaunchArena={navigate} />
      </main>

      {/* Footer */}
      <footer className="bg-[#050508] text-white py-12 border-t border-white/5 mt-auto">
        <div className="max-w-7xl mx-auto px-6 text-center space-y-6">
          <div className="flex items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-orange-500 flex items-center justify-center">
              <Play size={14} className="text-white ml-0.5" />
            </div>
            <h2 className="font-bold text-xl">SportsMind AI</h2>
          </div>
          <p className="text-sm text-gray-400">Powered by Google Gemini AI | Voice by ElevenLabs | Data by RapidAPI</p>
          <div className="flex justify-center gap-6 text-sm text-gray-500">
            <a href="#" className="hover:text-white">About</a>
            <a href="#" className="hover:text-white">Privacy</a>
            <a href="#" className="hover:text-white">Terms</a>
          </div>
          <p className="text-xs text-gray-600">© 2026 SportsMind AI. All rights reserved. Independent fan platform.</p>
        </div>
      </footer>

      <style>{`
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .animate-marquee { animation: marquee 120s linear infinite; }
      `}</style>
    </div>
  );
}

function HomeView({ onSelect, appData, newsFeed, onLaunchArena }) {
  return (
    <div className="space-y-12 animate-fade-in">
      <section>
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Activity className="text-red-500" /> LIVE NOW</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Object.keys(appData).slice(0,3).map(k => {
            const s = appData[k];
            return (
              <div key={k} className="bg-bg-card border border-border-subtle rounded-xl p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => onLaunchArena ? onLaunchArena(k) : onSelect(k)}>
                <div className="flex justify-between items-center mb-4">
                  <span className="text-xs font-bold px-2 py-1 rounded bg-bg-primary text-muted uppercase tracking-wider" style={{color: s.color}}>{s.name}</span>
                  <span className="flex items-center gap-1 text-xs font-bold text-red-500"><span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span> LIVE</span>
                </div>
                <div className="flex justify-between items-center font-bold text-xl mb-2">
                  <span>{s.match.team1.short}</span>
                  <span className="text-3xl text-main">{s.match.team1.score} - {s.match.team2.score || s.match.team2.short}</span>
                </div>
                {s.match.latestCommentary && (
                  <div className="text-[10px] text-[var(--accent-primary)] font-bold uppercase mb-1 flex items-center gap-1">
                    <Activity size={10} /> Latest: <span className="text-muted font-normal normal-case italic line-clamp-1">"{s.match.latestCommentary}"</span>
                  </div>
                )}
                <p className="text-sm text-muted">{s.match.status}</p>
                <button className="mt-6 w-full py-2 bg-bg-card-hover border border-border-subtle rounded font-semibold text-sm hover:border-main transition-colors flex items-center justify-center gap-2" onClick={(e) => { e.stopPropagation(); onLaunchArena ? onLaunchArena(k) : onSelect(k); }}>
                  <Mic size={14} /> Listen Live
                </button>
              </div>
            );
          })}
        </div>
      </section>
      
      <section>
        <h2 className="text-2xl font-bold mb-6">Top Stories</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {newsFeed.slice(0, 4).map((n, i) => (
            <a key={i} href={n.url} target="_blank" rel="noopener noreferrer" className="bg-bg-card rounded-xl border border-border-subtle overflow-hidden hover:border-orange-500 transition-all group flex flex-col h-full shadow-sm hover:shadow-md">
              {n.urlToImage ? (
                <div className="h-32 overflow-hidden">
                  <img src={n.urlToImage} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
              ) : (
                <div className="h-32 bg-bg-card-hover flex items-center justify-center text-muted">
                  <Activity size={32} className="opacity-20" />
                </div>
              )}
              <div className="p-4 flex flex-col flex-grow">
                <p className="text-sm font-bold line-clamp-2 mb-2 group-hover:text-orange-500 transition-colors">{n.title || n}</p>
                <div className="mt-auto flex items-center justify-between">
                  <span className="text-[10px] text-muted font-bold uppercase tracking-wider">{n.source?.name || 'News'}</span>
                  <ArrowRight size={14} className="text-orange-500 opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0" />
                </div>
              </div>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}

function SportView({ sport, sportKey, aiActive, feed, thinking, onLaunchArena }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
      <div className="lg:col-span-2 space-y-6">

        {/* Scoreboard */}
        <div className="bg-bg-card rounded-2xl border border-border-subtle p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2" style={{ backgroundColor: sport.color }}></div>
          <div className="flex justify-between items-center mb-6">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">{sport.name} Live</span>
            <span className="px-3 py-1 bg-red-500/10 text-red-500 font-bold text-xs rounded-full flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span> {sport.match.status}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-xl text-white" style={{backgroundColor: sport.match.team1.color}}>{sport.match.team1.short}</div>
              <div>
                <h3 className="font-bold text-lg">{sport.match.team1.name}</h3>
                <p className="text-4xl font-bold font-mono tracking-tighter">{sport.match.team1.score} <span className="text-xl text-muted">{sport.match.team1.overs}</span></p>
              </div>
            </div>
            <div className="text-2xl font-bold text-muted">VS</div>
            <div className="flex items-center gap-4 flex-row-reverse text-right">
              <div className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-xl text-white" style={{backgroundColor: sport.match.team2.color}}>{sport.match.team2.short}</div>
              <div>
                <h3 className="font-bold text-lg">{sport.match.team2.name}</h3>
                <p className="text-4xl font-bold font-mono tracking-tighter">{sport.match.team2.score}</p>
              </div>
            </div>
          </div>
          
          <div className="mt-8 pt-6 border-t border-border-subtle grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {sport.match.stats && Object.entries(sport.match.stats).map(([k,v]) => (
               <div key={k}><p className="text-muted capitalize mb-1">{k}</p><p className="font-bold">{v}</p></div>
            ))}
            {sport.match.batsmen && (
              <div className="col-span-2">
                <p className="text-muted mb-1">Batters</p>
                {sport.match.batsmen.map(b => <p key={b.name} className="font-bold">{b.name} {b.runs}({b.balls})</p>)}
              </div>
            )}
            {sport.match.bowler && (
              <div className="col-span-2">
                <p className="text-muted mb-1">Bowler</p>
                <p className="font-bold">{sport.match.bowler.name} {sport.match.bowler.wickets}/{sport.match.bowler.runs} ({sport.match.bowler.overs})</p>
              </div>
            )}
          </div>
        </div>

        {/* AI Commentary Feed */}
        <div className="bg-bg-card rounded-2xl border border-border-subtle p-6">
          <div className="flex items-center justify-between mb-6 border-b border-border-subtle pb-4">
            <h3 className="font-bold text-xl flex items-center gap-2">
              <Mic className={aiActive ? "text-orange-500 animate-pulse" : "text-muted"} /> 
              Live AI Commentary
            </h3>
            {aiActive ? (
               <div className="text-xs font-bold text-orange-500 flex items-center gap-2">
                 LISTENING <div className="flex gap-1 items-end h-3">{[1,2,3,4].map(i => <div key={i} className="w-1 bg-orange-500 animate-sound-bar" style={{animationDelay: `${i*0.1}s`}}></div>)}</div>
               </div>
            ) : (
               <div className="text-xs text-muted">Enable Master Toggle above</div>
            )}
          </div>
          
          <div className="space-y-4">
            {thinking && (
              <div className="p-4 rounded-xl border border-border-subtle bg-bg-card-hover animate-pulse text-muted text-sm font-medium flex items-center gap-2">
                <Activity size={16} /> AI Analyst thinking...
              </div>
            )}
            {feed.length === 0 && !thinking && aiActive && (
              <div className="text-center p-8 text-muted text-sm">Monitoring match data... awaiting next event.</div>
            )}
            {feed.length === 0 && !thinking && !aiActive && (
              <div className="text-center p-8 text-muted text-sm">Commentary inactive. Turn on the AI toggle to begin.</div>
            )}
            {feed.map((item, idx) => (
              <div key={idx} className="p-5 rounded-xl border-l-4 bg-bg-primary" style={{borderColor: sport.color}}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted">Just Now</span>
                  {item.alert && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-500">{item.alert}</span>}
                </div>
                <p className="text-lg font-medium mb-3">{item.commentary}</p>
                {item.insight && (
                  <div className="bg-bg-card-hover p-3 rounded text-sm text-muted border border-border-subtle flex gap-2">
                    <span>💡</span> <span>{item.insight}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-bg-card rounded-2xl border border-border-subtle p-6">
          <h3 className="font-bold text-lg mb-4">Latest News</h3>
          <div className="space-y-3">
            {sport.news.map((n, i) => (
              <a key={i} href={n.url || '#'} target="_blank" rel="noopener noreferrer" className="block text-sm font-medium border-b border-border-subtle pb-3 last:border-0 hover:text-orange-500 cursor-pointer transition-colors">
                {n.title || n}
              </a>
            ))}
          </div>
        </div>

        <div className="bg-bg-card rounded-2xl border border-border-subtle p-6">
          <h3 className="font-bold text-lg mb-4">Player Spotlight</h3>
          <div className="space-y-4">
            {sport.players.map((p, i) => (
              <div key={i} className="flex items-center justify-between">
                <div>
                  <p className="font-bold">{p.name}</p>
                  <p className="text-xs text-muted">{p.team} • {p.role}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">{p.stats}</p>
                  <p className={`text-xs ${p.form === 'Hot' ? 'text-orange-500' : 'text-blue-500'}`}>{p.form}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function NewsView({ newsFeed }) {
  return (
    <div className="space-y-8 animate-fade-in">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Activity className="text-orange-500" /> Latest Sports News</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {newsFeed.map((n, i) => (
          <div key={i} className="bg-bg-card border border-border-subtle rounded-xl overflow-hidden hover:shadow-lg hover:border-orange-500 transition-all cursor-pointer flex flex-col h-full group">
            {n.urlToImage && (
              <div className="h-48 overflow-hidden">
                <img src={n.urlToImage} alt={n.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
            )}
            <div className="p-6 flex flex-col flex-grow">
              <p className="text-base font-bold mb-4 line-clamp-3 group-hover:text-orange-500 transition-colors">{n.title || n}</p>
              <div className="flex justify-between items-center text-[10px] text-muted font-bold mt-auto uppercase tracking-widest">
                <span>{n.source?.name || 'SportsMind'}</span>
                <a href={n.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-orange-500 hover:text-orange-400 transition-colors">
                  Full Story <ArrowRight size={12} />
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StandingsView({ currentSport }) {
  const [viewSport, setViewSport] = useState(currentSport || 'cricket');
  const [standings, setStandings] = useState([]);
  const [liveMatches, setLiveMatches] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    setViewSport(currentSport || 'cricket');
  }, [currentSport]);

  useEffect(() => {
    setStandings([]);
    setLiveMatches([]);
    if (viewSport === 'cricket') {
      fetchCricketStandings().then(data => setStandings(data));
      fetchCricketLiveMatches().then(data => {
        if (!data || data.length === 0) {
          setLiveMatches([
            {
              teams: ["Mumbai Indians", "Royal Challengers Bengaluru"],
              teamInfo: [
                { name: "Mumbai Indians", shortname: "MI", img: "https://g.cricapi.com/iapi/55-637852956181378533.png?w=48" },
                { name: "Royal Challengers Bengaluru", shortname: "RCB", img: "https://g.cricapi.com/iapi/164-637852956181378533.png?w=48" }
              ],
              score: [{ r: 186, w: 8, o: 20.0 }, { r: 156, w: 5, o: 18.2 }],
              status: "MI need 31 runs in 10 balls"
            }
          ]);
        } else {
          setLiveMatches(data.slice(0, 5));
        }
      });
    } else if (viewSport === 'football') {
      fetchFootballStandings().then(data => setStandings(data));
      fetchFootballLiveMatches().then(data => {
        if (!data || data.length === 0) {
          setLiveMatches([
            {
              fixture: { status: { elapsed: 75, short: "2H" } },
              teams: { home: { name: "Arsenal" }, away: { name: "Chelsea" } },
              goals: { home: 2, away: 1 }
            },
            {
              fixture: { status: { elapsed: 45, short: "HT" } },
              teams: { home: { name: "Real Madrid" }, away: { name: "Barcelona" } },
              goals: { home: 0, away: 0 }
            }
          ]);
        } else {
          setLiveMatches(data.slice(0, 5));
        }
      });
    } else if (viewSport === 'basketball') {
      fetchBasketballLiveMatches().then(data => {
        if (!data || data.length === 0) {
          setLiveMatches([
            {
              status: { short: "Q3", timer: "04:12" },
              teams: { home: { name: "Lakers" }, away: { name: "Warriors" } },
              scores: { home: { total: 85 }, away: { total: 80 } }
            },
            {
              status: { short: "Q4", timer: "01:05" },
              teams: { home: { name: "Celtics" }, away: { name: "Suns" } },
              scores: { home: { total: 112 }, away: { total: 109 } }
            }
          ]);
        } else {
          setLiveMatches(data.slice(0, 5));
        }
      });
    } else if (viewSport === 'tennis') {
      fetchTennisLiveMatches().then(data => {
        if (!data || data.length === 0) {
          setLiveMatches([
            {
              status: { short: "S2" },
              teams: { home: { name: "Alcaraz" }, away: { name: "Djokovic" } },
              periods: { first: { home: 6, away: 4 }, second: { home: 2, away: 3 } }
            },
            {
              status: { short: "S3" },
              teams: { home: { name: "Swiatek" }, away: { name: "Sabalenka" } },
              periods: { first: { home: 4, away: 6 }, second: { home: 6, away: 2 }, third: { home: 1, away: 1 } }
            }
          ]);
        } else {
          setLiveMatches(data.slice(0, 5));
        }
      });
    }
  }, [viewSport]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1500);
  };

  const getTeamImg = (m, teamName) => {
    if (!m.teamInfo || !teamName) return null;
    const info = m.teamInfo.find(t => t.name === teamName || t.shortname === teamName || t.name.includes(teamName));
    return info ? info.img : null;
  };

  const renderCricketMatch = (m, i) => (
    <div key={i} className="min-w-[280px] bg-bg-card border border-border-subtle rounded-xl p-4 flex flex-col justify-between hover:border-orange-500 transition-colors">
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs font-bold text-red-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> LIVE</span>
        <span className="text-xs text-muted font-medium truncate max-w-[150px]" title={m.status}>{m.status}</span>
      </div>
      <div className="space-y-2 mb-2">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            {getTeamImg(m, m.teams?.[0]) && <img src={getTeamImg(m, m.teams?.[0])} alt="" className="w-5 h-5 object-contain" />}
            <span className="font-bold truncate max-w-[100px]" title={m.teams?.[0]}>{m.teams?.[0] || 'Team A'}</span>
          </div>
          <span className="font-bold">{m.score?.[0] ? `${m.score[0].r}/${m.score[0].w} (${m.score[0].o})` : 'Yet to bat'}</span>
        </div>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            {getTeamImg(m, m.teams?.[1]) && <img src={getTeamImg(m, m.teams?.[1])} alt="" className="w-5 h-5 object-contain" />}
            <span className="font-bold truncate max-w-[100px]" title={m.teams?.[1]}>{m.teams?.[1] || 'Team B'}</span>
          </div>
          <span className="font-bold">{m.score?.[1] ? `${m.score[1].r}/${m.score[1].w} (${m.score[1].o})` : 'Yet to bat'}</span>
        </div>
      </div>
    </div>
  );

  const renderFootballMatch = (m, i) => (
    <div key={i} className="min-w-[280px] bg-bg-card border border-border-subtle rounded-xl p-4 flex flex-col justify-between hover:border-orange-500 transition-colors">
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs font-bold text-red-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> {m.fixture?.status?.elapsed}'</span>
        <span className="text-xs text-muted font-medium">LIVE</span>
      </div>
      <div className="space-y-2 mb-2">
        <div className="flex justify-between items-center">
          <span className="font-bold truncate max-w-[180px]" title={m.teams?.home?.name}>{m.teams?.home?.name || 'Home'}</span>
          <span className="font-bold text-lg">{m.goals?.home ?? 0}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-bold truncate max-w-[180px]" title={m.teams?.away?.name}>{m.teams?.away?.name || 'Away'}</span>
          <span className="font-bold text-lg">{m.goals?.away ?? 0}</span>
        </div>
      </div>
    </div>
  );

  const renderBasketballMatch = (m, i) => (
    <div key={i} className="min-w-[280px] bg-bg-card border border-border-subtle rounded-xl p-4 flex flex-col justify-between hover:border-orange-500 transition-colors">
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs font-bold text-red-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> {m.status?.short}</span>
        <span className="text-xs text-muted font-medium">{m.status?.timer || 'LIVE'}</span>
      </div>
      <div className="space-y-2 mb-2">
        <div className="flex justify-between items-center">
          <span className="font-bold truncate max-w-[180px]" title={m.teams?.home?.name}>{m.teams?.home?.name || 'Home'}</span>
          <span className="font-bold text-lg">{m.scores?.home?.total ?? 0}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-bold truncate max-w-[180px]" title={m.teams?.away?.name}>{m.teams?.away?.name || 'Away'}</span>
          <span className="font-bold text-lg">{m.scores?.away?.total ?? 0}</span>
        </div>
      </div>
    </div>
  );

  const renderTennisMatch = (m, i) => (
    <div key={i} className="min-w-[280px] bg-bg-card border border-border-subtle rounded-xl p-4 flex flex-col justify-between hover:border-orange-500 transition-colors">
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs font-bold text-red-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> {m.status?.short}</span>
        <span className="text-xs text-muted font-medium">LIVE</span>
      </div>
      <div className="space-y-2 mb-2">
        <div className="flex justify-between items-center">
          <span className="font-bold truncate max-w-[150px]" title={m.teams?.home?.name}>{m.teams?.home?.name || 'Home'}</span>
          <div className="flex gap-2">
            <span className="text-xs text-muted">{m.periods?.first?.home ?? '-'}</span>
            <span className="text-xs text-muted">{m.periods?.second?.home ?? '-'}</span>
            <span className="font-bold text-sm">{m.periods?.third?.home ?? '-'}</span>
          </div>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-bold truncate max-w-[150px]" title={m.teams?.away?.name}>{m.teams?.away?.name || 'Away'}</span>
          <div className="flex gap-2">
            <span className="text-xs text-muted">{m.periods?.first?.away ?? '-'}</span>
            <span className="text-xs text-muted">{m.periods?.second?.away ?? '-'}</span>
            <span className="font-bold text-sm">{m.periods?.third?.away ?? '-'}</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Trophy className="text-orange-500" /> {viewSport === 'cricket' ? 'Cricket Standings & Scores' : viewSport === 'football' ? 'Football Standings & Scores' : viewSport === 'basketball' ? 'Basketball Scores' : viewSport === 'tennis' ? 'Tennis Scores' : 'Global Standings'}
        </h2>
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
          {['cricket', 'football', 'basketball', 'tennis'].map(sport => (
            <button
              key={sport}
              onClick={() => setViewSport(sport)}
              className={`px-4 py-1.5 rounded-full text-sm font-bold capitalize whitespace-nowrap transition-colors ${viewSport === sport ? 'bg-orange-500 text-white shadow-lg' : 'bg-bg-card border border-border-subtle text-muted hover:text-main hover:border-orange-500'}`}
            >
              {sport}
            </button>
          ))}
        </div>
      </div>

      {viewSport && (
        <div className="mb-6">
          <h3 className="text-lg font-bold mb-3">Live Matches</h3>
          <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
            {liveMatches.length > 0 ? (
              viewSport === 'cricket' ? liveMatches.map(renderCricketMatch) : 
              viewSport === 'football' ? liveMatches.map(renderFootballMatch) : 
              viewSport === 'basketball' ? liveMatches.map(renderBasketballMatch) : 
              liveMatches.map(renderTennisMatch)
            ) : (
              <div className="text-muted text-sm italic p-4 border border-border-subtle rounded-xl w-full bg-bg-card">No live matches currently available for {viewSport}.</div>
            )}
          </div>
        </div>
      )}
      
      {viewSport === 'cricket' ? (
        <div className="bg-bg-card rounded-2xl border border-border-subtle overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-bg-card-hover border-b border-border-subtle">
              <tr>
                <th className="p-4 font-bold text-muted">Rank</th>
                <th className="p-4 font-bold text-muted">Team</th>
                <th className="p-4 font-bold text-muted text-center">Played</th>
                <th className="p-4 font-bold text-muted text-center">Won</th>
                <th className="p-4 font-bold text-muted text-center">Lost</th>
                <th className="p-4 font-bold text-muted text-center">Points</th>
                <th className="p-4 font-bold text-muted text-right">NRR</th>
                <th className="p-4 font-bold text-muted text-center">Form</th>
              </tr>
            </thead>
            <tbody>
              {standings.length > 0 ? standings.map((team, i) => (
                <tr key={i} className="border-b border-border-subtle last:border-0 hover:bg-bg-primary transition-colors">
                  <td className="p-4 font-bold">{team.rank}</td>
                  <td className="p-4 font-semibold flex items-center gap-2">
                    {team.img && <img src={team.img} alt={team.team} className="w-5 h-5 object-contain" />}
                    {team.team}
                  </td>
                  <td className="p-4 text-center">{team.played}</td>
                  <td className="p-4 text-center text-green-500">{team.won}</td>
                  <td className="p-4 text-center text-red-500">{team.lost}</td>
                  <td className="p-4 font-bold text-center text-orange-500">{team.points}</td>
                  <td className="p-4 text-right text-muted">{team.nrr}</td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {team.form && team.form.map((f, idx) => (
                        <span key={idx} className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold ${f === 'W' ? 'bg-green-500/20 text-green-500 border border-green-500/50' : 'bg-red-500/20 text-red-500 border border-red-500/50'}`}>
                          {f}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-muted">Loading standings...</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : viewSport === 'football' ? (
        <div className="bg-bg-card rounded-2xl border border-border-subtle overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-bg-card-hover border-b border-border-subtle">
              <tr>
                <th className="p-4 font-bold text-muted">Rank</th>
                <th className="p-4 font-bold text-muted">Team</th>
                <th className="p-4 font-bold text-muted text-center">Played</th>
                <th className="p-4 font-bold text-muted text-center">Won</th>
                <th className="p-4 font-bold text-muted text-center">Draw</th>
                <th className="p-4 font-bold text-muted text-center">Lost</th>
                <th className="p-4 font-bold text-muted text-center">GF</th>
                <th className="p-4 font-bold text-muted text-center">GA</th>
                <th className="p-4 font-bold text-muted text-center">GD</th>
                <th className="p-4 font-bold text-muted text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              {standings.length > 0 ? standings.map((team, i) => (
                <tr key={i} className="border-b border-border-subtle last:border-0 hover:bg-bg-primary transition-colors">
                  <td className="p-4 font-bold">{team.rank}</td>
                  <td className="p-4 font-semibold">{team.team}</td>
                  <td className="p-4 text-center">{team.played}</td>
                  <td className="p-4 text-center text-green-500">{team.won}</td>
                  <td className="p-4 text-center text-yellow-500">{team.draw}</td>
                  <td className="p-4 text-center text-red-500">{team.lost}</td>
                  <td className="p-4 text-center">{team.gf}</td>
                  <td className="p-4 text-center">{team.ga}</td>
                  <td className="p-4 text-center">{team.gd}</td>
                  <td className="p-4 font-bold text-right text-orange-500">{team.points}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="10" className="p-8 text-center text-muted">Loading standings...</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <Trophy size={64} className="text-orange-500 mb-4 opacity-80" />
          <p className="text-muted max-w-md">Detailed league tables for {currentSport} are currently being synced with live global sports databases. Check back soon!</p>
          <button 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={`mt-4 px-6 py-2 text-white font-bold rounded-full transition-all flex items-center gap-2 ${isRefreshing ? 'bg-orange-400 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600'}`}
          >
            {isRefreshing ? <Activity size={16} className="animate-spin" /> : null}
            {isRefreshing ? 'Syncing...' : 'Refresh Data'}
          </button>
        </div>
      )}
    </div>
  );
}
