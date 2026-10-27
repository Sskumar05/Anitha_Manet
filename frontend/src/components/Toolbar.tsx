import React from 'react';
import { Filter, SlidersHorizontal, HelpCircle, LayoutGrid } from 'lucide-react';

interface ToolbarProps {
  onScrollTo: (id: string) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ onScrollTo }) => {
  return (
    <div className="px-6 sm:px-9 pb-5 flex flex-wrap items-center justify-between gap-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => onScrollTo('simulation')}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200/80 text-navy-700 font-semibold border border-slate-200 transition-colors"
        >
          <Filter className="w-3.5 h-3.5" />
          <span>Filter Parameters</span>
        </button>

        <button
          onClick={() => onScrollTo('analysis')}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200/80 text-navy-700 font-semibold border border-slate-200 transition-colors"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>eAODV vs AODV</span>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onScrollTo('algorithm')}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200/80 text-navy-700 font-semibold border border-slate-200 transition-colors"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Algorithm Support</span>
        </button>

        <button
          onClick={() => onScrollTo('topology')}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200/80 text-navy-700 font-semibold border border-slate-200 transition-colors"
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span>Topology Layout</span>
        </button>
      </div>
    </div>
  );
};
