import React from 'react';
import { Check, X, Cpu, ShieldCheck, Zap, Activity } from 'lucide-react';

export const AlgorithmMatrix: React.FC = () => {
  const rows = [
    {
      feature: 'Route Selection Metric',
      aodv: 'Route selection based on first reply (minimum hop count / earliest arrival)',
      aodvType: 'limitation',
      eaodv: 'Hybrid Normalized Cost: Jointly balances hops, bottleneck battery & drain rate',
      eaodvType: 'improvement',
    },
    {
      feature: 'Energy Awareness & Modeling',
      aodv: 'Zero energy awareness — routes blindly through dying nodes until link collapse',
      aodvType: 'limitation',
      eaodv: 'Dynamic NS-3 BasicEnergySource inspection on every intermediate forwarding node',
      eaodvType: 'improvement',
    },
    {
      feature: 'Node Selection & Mobility',
      aodv: 'Frequent route breaks under high mobility → heavy global RREQ flooding storms',
      aodvType: 'limitation',
      eaodv: 'Penalises depleted candidate nodes; steers forwarding paths through resilient energy hubs',
      eaodvType: 'improvement',
    },
    {
      feature: 'Route Maintenance & Repair',
      aodv: 'Reactive re-discovery delay spikes and packet loss when active route breaks',
      aodvType: 'limitation',
      eaodv: 'Proactive local repair trigger when node residual energy drops below threshold (\theta_E = 20%)',
      eaodvType: 'improvement',
    },
    {
      feature: 'Battery Load & Network Lifetime',
      aodv: 'Battery depletion concentrated on topological bottleneck nodes (early partition)',
      aodvType: 'limitation',
      eaodv: 'Balanced battery dissipation across ad-hoc nodes, extending network partition lifetime',
      eaodvType: 'improvement',
    },
    {
      feature: 'Routing Control Overhead',
      aodv: 'Elevated control overhead (NRL) under high node mobility (>15 m/s)',
      aodvType: 'limitation',
      eaodv: 'Stable energy-aware routes endure longer; reduces repetitive global route discovery floods',
      eaodvType: 'improvement',
    },
  ];

  return (
    <section id="algorithm" className="px-6 sm:px-10 py-8 border-b border-slate-100">
      {/* Section Header */}
      <div className="mb-7">
        <div className="flex items-center gap-2.5">
          <h2 className="text-xl sm:text-2xl font-extrabold text-[#13141F] tracking-tight">
            Algorithm Design &amp; Architectural Matrix
          </h2>
          <span className="text-[11px] font-bold px-3 py-0.5 rounded-full bg-indigo-50 text-[#635BFF] border border-indigo-100">
            eAODV-CEH Model C
          </span>
        </div>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Comparative technical analysis: Standard RFC 3561 AODV vs Energy-Aware Composite AODV (eAODV-CEH)
        </p>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-[28px] border border-slate-200/90 shadow-[0_4px_24px_rgba(0,0,0,0.03)] overflow-hidden mb-8">
        {/* Table for Tablet and Desktop */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/70 border-b border-slate-200/80 text-slate-600 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-4 px-6 w-1/4">Protocol Dimension</th>
                <th className="py-4 px-6 w-3/8 border-l border-slate-200/60">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold">
                      BASELINE
                    </span>
                    <span className="text-slate-800 font-extrabold">Standard AODV</span>
                  </div>
                </th>
                <th className="py-4 px-6 w-3/8 border-l border-slate-200/60 bg-indigo-50/20">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#635BFF] text-white text-[10px] font-bold shadow-xs">
                      PROPOSED
                    </span>
                    <span className="text-[#635BFF] font-extrabold">eAODV (Composite Energy-Aware)</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-4 px-6 font-bold text-slate-800">{row.feature}</td>
                  <td className="py-4 px-6 text-slate-600 border-l border-slate-100">
                    <div className="flex items-start gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
                        <X className="w-3 h-3 stroke-[3]" />
                      </div>
                      <span className="leading-relaxed">{row.aodv}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-slate-900 border-l border-slate-100 font-medium bg-indigo-50/15">
                    <div className="flex items-start gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                      <span className="leading-relaxed font-semibold text-slate-900">{row.eaodv}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Card Layout for Mobile */}
        <div className="block md:hidden p-5 space-y-4">
          {rows.map((row, idx) => (
            <div key={idx} className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200 space-y-3">
              <div className="text-sm font-bold text-slate-900 border-b border-slate-200/80 pb-2">
                {row.feature}
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="text-[10px] font-bold text-slate-500 uppercase">Standard AODV</div>
                <div className="flex items-start gap-2 text-slate-600">
                  <X className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <span>{row.aodv}</span>
                </div>
              </div>
              <div className="space-y-1.5 text-xs bg-indigo-50/60 p-3 rounded-xl border border-indigo-100">
                <div className="text-[10px] font-bold text-[#635BFF] uppercase">Enhanced eAODV-CEH</div>
                <div className="flex items-start gap-2 text-slate-900 font-semibold">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{row.eaodv}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FINNOVA Signature Bottom Dark Container: Mathematical Model Formulation */}
      <div className="bg-[#13141F] rounded-[28px] text-white p-7 sm:p-8 border border-slate-800 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2.5">
              <Zap className="w-5 h-5 text-[#635BFF]" />
              <h3 className="text-lg font-extrabold text-white tracking-tight">
                Model C Hybrid Normalized Cost Function
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Mathematical formulation for route scoring evaluated at destination or intermediate nodes in genuine eAODV
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono px-3 py-1 rounded-full bg-[#1E2033] border border-slate-700 text-slate-300">
              Weights: α = 0.40 · β = 0.40 · γ = 0.20
            </span>
          </div>
        </div>

        {/* Formula Display Card */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-7 bg-[#1E2033] rounded-[22px] p-6 border border-slate-800 flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#7B61FF] block mb-2">
                Unified Composite Path Cost
              </span>
              <div className="font-mono text-sm sm:text-base bg-[#13141F] p-4 rounded-xl border border-slate-800 text-slate-100 overflow-x-auto leading-relaxed">
                C(p) = α · [ H / H_max ] + β · [ 1 - (E_min / E_init) ] + γ · [ (1/H) · Σ (D_i / E_init) ]
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-4 text-[11px] font-mono text-slate-300">
              <div className="bg-[#13141F] p-2.5 rounded-xl border border-slate-800/60">
                <span className="text-slate-500 block text-[10px]">Term 1 (α=0.4)</span>
                <span className="font-bold text-white">Hop Normalization</span>
              </div>
              <div className="bg-[#13141F] p-2.5 rounded-xl border border-slate-800/60">
                <span className="text-slate-500 block text-[10px]">Term 2 (β=0.4)</span>
                <span className="font-bold text-white">Bottleneck Battery</span>
              </div>
              <div className="bg-[#13141F] p-2.5 rounded-xl border border-slate-800/60">
                <span className="text-slate-500 block text-[10px]">Term 3 (γ=0.2)</span>
                <span className="font-bold text-white">Mean Drain Rate</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 bg-[#635BFF] rounded-[22px] p-6 text-white flex flex-col justify-between shadow-lg shadow-indigo-900/30">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="w-5 h-5 text-indigo-200" />
                <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-100">
                  Routing Loop Safety Guarantee
                </span>
              </div>
              <p className="text-xs text-indigo-100 leading-relaxed">
                Strict sequence number ordering is enforced prior to cost comparison. If <code className="bg-black/20 px-1 py-0.5 rounded font-mono">seq_cand &gt; seq_curr</code>, route updates unconditionally. When sequence numbers match, candidate route is accepted only if <code className="bg-black/20 px-1 py-0.5 rounded font-mono">C(cand) &lt; C(curr)</code>.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-indigo-400/30 flex items-center justify-between text-[11px] text-indigo-100 font-medium">
              <span>RFC 3561 Safety Preserved</span>
              <span className="font-bold">Zero Routing Loops</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
