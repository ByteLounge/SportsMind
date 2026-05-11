import React, { useState, useEffect } from 'react';
import NavHeader from './components/NavHeader';
import SportsMind from './components/SportsMind';
import CricketBoard from './components/CricketBoard';
import { NewsView, StandingsView } from './components/SportsMind';
import { fetchSystemHealth, fetchSportsNews } from './utils/apiData';
import { Trophy } from 'lucide-react';

const ComingSoon = () => (
  <div className="flex-grow flex flex-col items-center justify-center p-10 text-center min-h-[60vh]">
    <Trophy size={64} className="text-[var(--accent-primary)] mb-6 opacity-80" />
    <h1 className="text-4xl font-bold mb-4">Coming Soon</h1>
    <p className="text-muted max-w-lg text-lg">We are currently integrating live data feeds and AI models for this sport. Check back soon for the ultimate broadcast experience!</p>
  </div>
);

const SPORT_PAGES = {
  cricket: CricketBoard,
  football: ComingSoon,
  basketball: ComingSoon,
  tennis: ComingSoon,
  f1: ComingSoon,
  hockey: ComingSoon,
};

const App = () => {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [currentPage, setCurrentPage] = useState('home');
  const [backendHealth, setBackendHealth] = useState(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  useEffect(() => {
    const check = async () => setBackendHealth(await fetchSystemHealth());
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  const toggleTheme = () => setIsDarkMode(d => !d);
  const navigate = (page) => setCurrentPage(page);

  const sharedProps = { isDarkMode, toggleTheme, navigate };

  const renderPage = () => {
    if (currentPage === 'home') return <SportsMind {...sharedProps} />;
    if (currentPage === 'news') return <NewsPageWrapper />;
    if (currentPage === 'standings') return <StandingsPageWrapper />;
    const SportPage = SPORT_PAGES[currentPage];
    if (SportPage) return <SportPage {...sharedProps} />;
    return <SportsMind {...sharedProps} />;
  };

  return (
    <div className={`min-h-screen bg-bg-primary text-main flex flex-col font-sans ${isDarkMode ? 'dark' : ''}`}>
      <NavHeader
        currentPage={currentPage}
        navigate={navigate}
        isDarkMode={isDarkMode}
        toggleTheme={toggleTheme}
        backendHealth={backendHealth}
      />
      {renderPage()}
    </div>
  );
};

function NewsPageWrapper() {
  const [newsFeed, setNewsFeed] = useState([]);
  useEffect(() => {
    fetchSportsNews().then(data => { if (data?.length) setNewsFeed(data); });
  }, []);
  return (
    <div className="flex-grow p-6 md:p-10 max-w-7xl mx-auto w-full">
      <NewsView newsFeed={newsFeed} />
    </div>
  );
}

function StandingsPageWrapper() {
  return (
    <div className="flex-grow p-6 md:p-10 max-w-7xl mx-auto w-full">
      <StandingsView currentSport="cricket" />
    </div>
  );
}

export default App;
