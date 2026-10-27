import React from 'react';
import { Play, Sparkles } from 'lucide-react';

interface HeaderBarProps {
  onRunClick: () => void;
  isRunning: boolean;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({ onRunClick, isRunning }) => {
  return (
    <header className="px-6 sm:px-9 pt-7 pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight flex items-center gap-2">
          <span>Good Morning, Researcher!</span>
          <Sparkles className="w-5 h-5 text-amber-500 fill-amber-400 hidden sm:inline" />
        </h1>
        <p className="text-sm font-medium text-navy-500 mt-1">
          Reliable and Energy-Aware Routing in Dynamic MANETs — Phase II Research
        </p>
      </div>

      <button
        onClick={onRunClick}
        className={`px-5 py-2.5 rounded-full text-xs font-bold tracking-tight shadow-md flex items-center gap-2 transition-all transform hover:scale-[1.02] ${
          isRunning
            ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-500/20'
            : 'bg-primary hover:bg-primary-hover text-white shadow-blue-500/25'
        }`}
      >
        <Play className={`w-3.5 h-3.5 fill-current ${isRunning ? 'animate-spin' : ''}`} />
        <span>{isRunning ? 'Simulation Running...' : 'Run Simulation'}</span>
      </button>
    </header>
  );
};
