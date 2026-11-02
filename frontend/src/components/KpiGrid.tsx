import React from 'react';
import { Radio, Zap, Clock, BatteryCharging, ArrowUpRight, TrendingUp, TrendingDown, ArrowUp, ArrowDown } from 'lucide-react';
import { SimulationResult } from '../types/simulation';

interface KpiGridProps {
  latestResult: SimulationResult | null;
}

export const KpiGrid: React.FC<KpiGridProps> = ({ latestResult }) => {
  return (
    <section className="px-6 sm:px-8 py-7 border-b border-slate-100 bg-white">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Packet Delivery Ratio (PDR) */}
        <div className="rounded-[24px] bg-white border border-slate-200/90 p-5 sm:p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_-4px_rgba(99,91,255,0.08)] transition-all flex flex-col justify-between group">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Packet Delivery Ratio
              </span>
              <div className="w-7 h-7 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
                <Radio className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {latestResult ? `${latestResult.pdr.toFixed(1)}%` : '92.4%'}
            </div>

            <div className="flex items-center gap-1.5 mt-2 text-xs font-bold text-emerald-600">
              <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{latestResult ? `${latestResult.rx_packets} / ${latestResult.tx_packets} CBR pkts` : '+14.8% vs Baseline AODV'}</span>
            </div>
          </div>

          {/* Mini Sparkline Visualization */}
          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400">Target: &gt;85% PDR</span>
            <span className="text-[11px] font-bold text-purple-600 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-100">
              {latestResult?.protocol || 'eAODV-CEH'}
            </span>
          </div>
        </div>

        {/* Card 2: End-to-End Delay with Mini Bar Sparkline */}
        <div className="rounded-[24px] bg-white border border-slate-200/90 p-5 sm:p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_-4px_rgba(99,91,255,0.08)] transition-all flex flex-col justify-between group">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Avg End-to-End Delay
              </span>
              <div className="w-7 h-7 rounded-full bg-indigo-50 text-[#635BFF] flex items-center justify-center border border-indigo-100">
                <Clock className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {latestResult
                ? latestResult.delay_ms !== null && latestResult.delay_ms !== undefined
                  ? `${latestResult.delay_ms.toFixed(1)} ms`
                  : 'N/A'
                : '38.5 ms'}
            </div>

            <div className="flex items-center gap-1.5 mt-2 text-xs font-bold text-[#635BFF]">
              <ArrowDown className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>28.4% lower latency</span>
            </div>
          </div>

          {/* Mini Bar Chart Sparkline matching FINNOVA */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-end gap-1.5 h-8">
            <div className="flex-1 bg-slate-100 rounded-t h-[40%]"></div>
            <div className="flex-1 bg-slate-100 rounded-t h-[55%]"></div>
            <div className="flex-1 bg-indigo-200 rounded-t h-[70%]"></div>
            <div className="flex-1 bg-indigo-300 rounded-t h-[60%]"></div>
            <div className="flex-1 bg-[#635BFF] rounded-t h-[95%]"></div>
            <div className="flex-1 bg-[#7B61FF] rounded-t h-[80%]"></div>
          </div>
        </div>

        {/* Card 3: Normalized Routing Load (NRL) with Mini Curve Sparkline */}
        <div className="rounded-[24px] bg-white border border-slate-200/90 p-5 sm:p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_-4px_rgba(99,91,255,0.08)] transition-all flex flex-col justify-between group">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Routing Overhead (NRL)
              </span>
              <div className="w-7 h-7 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100">
                <Zap className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {latestResult
                ? latestResult.overhead_ratio !== null && latestResult.overhead_ratio !== undefined
                  ? latestResult.overhead_ratio.toFixed(2)
                  : 'N/A'
                : '1.42'}
            </div>

            <div className="flex items-center gap-1.5 mt-2 text-xs font-bold text-teal-600">
              <ArrowDown className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Reduced control flooding</span>
            </div>
          </div>

          {/* Mini Dotted Sparkline Curve matching FINNOVA */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between relative h-8">
            <svg className="w-full h-7 overflow-visible" viewBox="0 0 100 28" fill="none">
              <path
                d="M 0,22 Q 20,24 35,16 T 70,10 T 100,4"
                stroke="#635BFF"
                strokeWidth="2.2"
                strokeLinecap="round"
                fill="none"
              />
              <circle cx="0" cy="22" r="2.5" fill="#635BFF" />
              <circle cx="35" cy="16" r="2.5" fill="#635BFF" />
              <circle cx="70" cy="10" r="2.5" fill="#635BFF" />
              <circle cx="100" cy="4" r="3" fill="#635BFF" className="animate-ping opacity-75" />
              <circle cx="100" cy="4" r="2.5" fill="#635BFF" />
            </svg>
          </div>
        </div>

        {/* Card 4: Energy Consumption & Protocol Comparison Pills */}
        <div className="rounded-[24px] bg-white border border-slate-200/90 p-5 sm:p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_-4px_rgba(99,91,255,0.08)] transition-all flex flex-col justify-between group">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Network Energy Residual
              </span>
              <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                <BatteryCharging className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {latestResult ? `${latestResult.remaining_energy_percent.toFixed(1)}%` : '82.6%'}
            </div>

            <div className="flex items-center gap-1.5 mt-2 text-xs font-bold text-emerald-600">
              <TrendingUp className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>~22% extended network lifetime</span>
            </div>
          </div>

          {/* Protocol Comparison Mini Pills matching FINNOVA */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-[10px]">
            <div className="flex-1 px-2 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 font-bold text-center">
              AODV: 64%
            </div>
            <div className="flex-1 px-2 py-1.5 rounded-xl bg-[#635BFF] text-white font-extrabold text-center shadow-xs">
              eAODV: 83%
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
