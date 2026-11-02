import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Filter, SlidersHorizontal, HelpCircle, LayoutGrid, ChevronDown, Search } from 'lucide-react';

interface ToolbarProps {
  onScrollTo?: (id: string) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ onScrollTo }) => {
  const navigate = useNavigate();

  const handleNav = (path: string, id: string) => {
    navigate(path);
    if (onScrollTo) {
      onScrollTo(id);
    }
  };

  return (
    <div className="px-6 sm:px-8 py-4 flex flex-wrap items-center justify-between gap-3 text-xs border-b border-slate-100 bg-[#FAFAFD]">
      {/* Left: Active Filters & Dropdown Pills matching FINNOVA */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Active Filter Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 text-white font-bold text-xs shadow-2xs">
          <span>Active Protocol</span>
          <span className="w-5 h-5 rounded-full bg-[#635BFF] text-white flex items-center justify-center text-[10px] font-black">
            2
          </span>
        </div>

        {/* Protocol Selector Pill */}
        <button
          onClick={() => handleNav('/analysis', 'analysis')}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-slate-50 text-slate-700 font-semibold border border-slate-200/80 transition-all shadow-2xs"
        >
          <span>eAODV vs AODV</span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </button>

        {/* Node Count Pill */}
        <button
          onClick={() => handleNav('/simulation', 'simulation')}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-slate-50 text-slate-700 font-semibold border border-slate-200/80 transition-all shadow-2xs"
        >
          <span>Topology: 50 Nodes</span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </button>

        {/* Mobility Pill */}
        <button
          onClick={() => handleNav('/simulation', 'simulation')}
          className="hidden md:flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-slate-50 text-slate-700 font-semibold border border-slate-200/80 transition-all shadow-2xs"
        >
          <span>Speed: 10 m/s RWP</span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </button>
      </div>

      {/* Right: Quick Navigation Pills & Search Bar matching FINNOVA */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => handleNav('/topology', 'topology')}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-slate-50 text-slate-700 font-semibold border border-slate-200/80 transition-all shadow-2xs"
        >
          <LayoutGrid className="w-3.5 h-3.5 text-purple-600" />
          <span>Topology Layout</span>
        </button>

        <button
          onClick={() => handleNav('/algorithm', 'algorithm')}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-slate-50 text-slate-700 font-semibold border border-slate-200/80 transition-all shadow-2xs"
        >
          <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
          <span>Cost Model</span>
        </button>

        {/* Search Input Pill */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200/80 text-slate-400 shadow-2xs">
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400 font-normal pr-2">Search run ID...</span>
        </div>
      </div>
    </div>
  );
};
