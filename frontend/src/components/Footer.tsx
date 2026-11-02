import React from 'react';
import { Network } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="px-6 sm:px-10 py-8 bg-slate-50 border-t border-slate-200/80 text-xs text-navy-500 w-full">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary text-white flex items-center justify-center">
            <Network className="w-4 h-4" />
          </div>
          <span className="font-bold text-navy-900 tracking-tight text-sm">
            MANET Research Lab — CS2708
          </span>
        </div>

        <div className="text-left sm:text-right space-y-1">
          <p className="font-medium text-navy-700">
            Department of Computer Science &amp; Engineering · Anitha G · Elanthalir K · Harini G.P · Guide: Dr. Sugumaran V.R
          </p>
          <p className="text-[11px] text-slate-400">
            Simulation Engine: NS-3 v3.41 | Backend: Python FastAPI | Frontend: React.js, Vite, TypeScript | Metrics: PDR, Delay, Overhead, Energy
          </p>
        </div>
      </div>
    </footer>
  );
};
