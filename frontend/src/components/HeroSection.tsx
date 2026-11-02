import React from 'react';
import { HeroNetCanvas } from './HeroNetCanvas';
import { Cpu, Zap, ArrowRight, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const HeroSection: React.FC = () => {
  const navigate = useNavigate();

  return (
    <section id="overview" className="px-6 sm:px-8 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center border-b border-slate-100">
      {/* Left Text — Bold Modern Typography */}
      <div className="lg:col-span-7">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-200/60 text-[#635BFF] text-xs font-extrabold mb-4 shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-[#635BFF] animate-pulse"></span>
          <span>Final Year Research · MANET Routing Protocol Engine</span>
        </div>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-[1.12] mb-4">
          Reliable & Energy-Aware <br />
          <span className="bg-gradient-to-r from-[#635BFF] via-[#7B61FF] to-[#3B82F6] bg-clip-text text-transparent">
            Routing in MANETs
          </span>
        </h2>

        <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl font-normal">
          Comparing Standard AODV against our proposed <strong className="text-slate-900 font-bold">Energy-Aware AODV (eAODV-CEH v2)</strong> protocol across Packet Delivery Ratio, Delay, Routing Overhead, and Energy Longevity — natively executed inside <strong className="text-slate-900 font-bold">NS-3.41</strong>.
        </p>

        <div className="flex flex-wrap items-center gap-3 mt-6">
          <button
            onClick={() => navigate('/simulation')}
            className="px-6 py-2.5 rounded-full bg-[#635BFF] hover:bg-[#5349EE] text-white text-xs font-bold tracking-tight shadow-lg shadow-indigo-500/25 flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>Launch Simulation Studio</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => navigate('/analysis')}
            className="px-5 py-2.5 rounded-full bg-[#F4F5FA] hover:bg-slate-200/80 text-slate-700 text-xs font-bold border border-slate-200/80 transition-all shadow-2xs"
          >
            <span>View Performance Charts</span>
          </button>
        </div>
      </div>

      {/* Right: Signature FINNOVA-Styled Deep Card */}
      <div className="lg:col-span-5 bg-gradient-to-br from-[#1E2033] via-[#161726] to-[#0F101A] text-white rounded-[28px] p-6 sm:p-7 shadow-xl shadow-slate-900/15 border border-slate-800/80 flex flex-col gap-4 relative overflow-hidden">
        {/* Soft background glow */}
        <div className="absolute -top-16 -right-16 w-44 h-44 bg-[#635BFF]/20 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex items-center justify-between relative z-10">
          <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/15">
            <Cpu className="w-5 h-5 text-indigo-400 stroke-[2]" />
          </div>
          <span className="text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full bg-[#635BFF]/30 text-indigo-200 border border-indigo-400/30">
            eAODV-CEH v2 Engine
          </span>
        </div>

        <div className="relative z-10">
          <h3 className="text-lg font-extrabold tracking-tight text-white">
            Composite Energy-Drain Routing
          </h3>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            Multi-factor path cost combining normalized hop length, bottleneck battery cutoff (15%), and path-average residual energy.
          </p>
        </div>

        {/* Embedded Interactive Topology Canvas */}
        <div className="mt-1 relative z-10 rounded-xl overflow-hidden border border-white/10 shadow-inner">
          <HeroNetCanvas />
        </div>

        {/* Status Pills Row */}
        <div className="flex items-center justify-between pt-2 text-xs relative z-10 border-t border-white/10">
          <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px]">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>RFC 3561 Loop-Free</span>
          </div>
          <span className="text-[11px] font-semibold text-slate-400">
            Model C Validated
          </span>
        </div>
      </div>
    </section>
  );
};
