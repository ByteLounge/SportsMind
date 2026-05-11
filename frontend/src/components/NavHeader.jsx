import React, { useState } from 'react';
import { Play, Sun, Moon, Activity, Menu, X } from 'lucide-react';

const NAV_ITEMS = [
  { key: 'home', label: 'Home' },
  { key: 'cricket', label: 'Cricket' },
  { key: 'football', label: 'Football' },
  { key: 'basketball', label: 'Basketball' },
  { key: 'tennis', label: 'Tennis' },
  { key: 'f1', label: 'F1' },
  { key: 'hockey', label: 'Hockey' },
  { key: 'news', label: 'News' },
  { key: 'standings', label: 'Standings' },
];

const NavHeader = ({ currentPage, navigate, isDarkMode, toggleTheme, backendHealth }) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNav = (key) => {
    navigate(key);
    setMobileOpen(false);
  };

  return (
    <header className="h-16 bg-[#080810] text-white border-b border-white/10 flex items-center justify-between px-6 sticky top-0 z-50">
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleNav('home')}>
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-orange-500 flex items-center justify-center flex-shrink-0">
          <Play size={18} className="text-white ml-0.5" />
        </div>
        <div className="hidden sm:block">
          <h1 className="font-bold text-lg tracking-tight leading-none">SportsMind AI</h1>
          <p className="text-[9px] text-gray-400 leading-none mt-0.5">Every Sport. Every Moment. AI Powered.</p>
        </div>
      </div>

      <nav className="hidden lg:flex gap-4 font-semibold text-xs">
        {NAV_ITEMS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleNav(key)}
            className={`uppercase tracking-wider transition-colors px-1 py-0.5 ${
              currentPage === key
                ? 'text-orange-500 border-b-2 border-orange-500'
                : 'text-gray-300 hover:text-orange-400'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
        >
          {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        {backendHealth !== undefined && (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10">
            <Activity size={12} className={backendHealth?.ok ? 'text-green-500' : 'text-red-500'} />
            <div className="flex flex-col">
              <span className="text-[7px] uppercase tracking-tighter text-gray-400 leading-none">System</span>
              <span className="text-[9px] font-bold leading-none">{backendHealth?.ok ? 'ONLINE' : 'OFFLINE'}</span>
            </div>
          </div>
        )}

        <button
          className="lg:hidden p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
          onClick={() => setMobileOpen(o => !o)}
        >
          {mobileOpen ? <X size={15} /> : <Menu size={15} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="lg:hidden absolute top-16 left-0 right-0 bg-[#080810] border-b border-white/10 px-6 py-4 flex flex-col gap-3 z-50">
          {NAV_ITEMS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => handleNav(key)}
              className={`text-left text-sm font-semibold uppercase tracking-wider transition-colors ${
                currentPage === key ? 'text-orange-500' : 'text-gray-300 hover:text-orange-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </header>
  );
};

export default NavHeader;
