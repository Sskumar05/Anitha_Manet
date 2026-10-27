import React from 'react';
import { HeroNetCanvas } from './HeroNetCanvas';
import { Cpu } from 'lucide-react';

export const HeroSection: React.FC = () => {
  return (
    <section id="overview" className="px-6 sm:px-9 py-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center border-b border-slate-100">
      {/* Left Text */}
      <div className="lg:col-span-7">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/60 text-primary text-xs font-bold mb-4">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
          <span>Final Year Research Project · Phase II Full-Stack Implementation</span>
        </div>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-navy-900 tracking-tight leading-[1.15] mb-4">
          Reliable Routing in <br />
          <span className="bg-gradient-to-r from-primary to-secondary-blue bg-clip-text text-transparent">
            Dynamic MANETs
          </span>
        </h2>

        <p className="text-sm sm:text-base text-navy-500 leading-relaxed max-w-xl">
          Designing an <strong className="text-navy-900 font-semibold">Energy-Aware AODV (eAODV)</strong> protocol that outperforms standard AODV on Packet Delivery Ratio, End-to-End Delay, Routing Overhead, and Energy Consumption across highly mobile wireless topologies — validated via <strong className="text-navy-900 font-semibold">NS-3 v3.41 simulation engine</strong>.
        </p>
      </div>

      {/* Right: Signature Royal Blue Card */}
      <div className="lg:col-span-5 bg-gradient-to-br from-[#2864E8] to-[#1A4EB8] text-white rounded-card p-6 shadow-xl shadow-blue-600/20 flex flex-col gap-4 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="w-9 h-9 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20">
            <Cpu className="w-4 h-4 text-white" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/15 text-blue-100 border border-white/20">
            Protocol Core
          </span>
        </div>

        <div>
          <h3 className="text-lg font-bold tracking-tight">eAODV Optimization Engine</h3>
          <p className="text-xs text-blue-100/90 mt-1 leading-relaxed">
            Scoring route replies via remaining node battery level, preventing link failures before they happen and extending network lifetime by ~22%.
          </p>
        </div>

        {/* Embedded Canvas */}
        <div className="mt-1">
          <HeroNetCanvas />
        </div>

        {/* Progress dashes */}
        <div className="flex items-center gap-1.5 pt-1">
          <span className="w-6 h-1 rounded-full bg-white"></span>
          <span className="w-1.5 h-1 rounded-full bg-white/40"></span>
          <span className="w-1.5 h-1 rounded-full bg-white/40"></span>
          <span className="w-1.5 h-1 rounded-full bg-white/40"></span>
        </div>
      </div>
    </section>
  );
};
