import React from 'react';
import { Check, X } from 'lucide-react';

export const AlgorithmMatrix: React.FC = () => {
  const rows = [
    {
      feature: 'Route Selection Metric',
      aodv: 'Route selection based on first reply (lowest latency)',
      aodvType: 'limitation',
      eaodv: 'Route selection via energy-weighted RREP scoring',
      eaodvType: 'improvement',
    },
    {
      feature: 'Energy Awareness & Modeling',
      aodv: 'No energy awareness — routes through dying nodes',
      aodvType: 'limitation',
      eaodv: 'Attaches BasicEnergySource model to each NS-3 node',
      eaodvType: 'improvement',
    },
    {
      feature: 'Node Selection & Mobility',
      aodv: 'Frequent route breaks under high mobility → heavy RREQ flooding',
      aodvType: 'limitation',
      eaodv: 'Penalises low-battery next-hops; prefers energy-rich nodes',
      eaodvType: 'improvement',
    },
    {
      feature: 'Route Maintenance & Repair',
      aodv: 'Re-discovery delay spikes when a route collapses',
      aodvType: 'limitation',
      eaodv: 'Energy threshold triggers proactive local route repair',
      eaodvType: 'improvement',
    },
    {
      feature: 'Battery Load & Network Lifetime',
      aodv: 'Battery drain concentrated on few hub nodes',
      aodvType: 'limitation',
      eaodv: 'Balanced battery load extends network lifetime by ~22%',
      eaodvType: 'improvement',
    },
    {
      feature: 'High-Speed Routing Overhead',
      aodv: 'High routing overhead at speeds > 10 m/s',
      aodvType: 'limitation',
      eaodv: 'Lower re-discovery cost → reduced overhead at all speeds',
      eaodvType: 'improvement',
    },
  ];

  return (
    <section id="algorithm" className="px-6 sm:px-9 py-8 border-b border-slate-100">
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-extrabold text-navy-900 tracking-tight">
          ⚙️ Algorithm Design &amp; Architectural Comparison
        </h2>
        <p className="text-xs sm:text-sm text-navy-500 mt-0.5">
          Standard AODV vs Energy-Aware AODV (eAODV) across foundational routing dimensions
        </p>
      </div>

      <div className="bg-white rounded-card border border-slate-200/80 shadow-sm overflow-hidden">
        {/* Table for Tablet and Desktop */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-navy-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-4 px-6 w-1/4">Feature / Protocol Dimension</th>
                <th className="py-4 px-6 w-3/8 border-l border-slate-200/60">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold">
                      STANDARD
                    </span>
                    <span>AODV Protocol</span>
                  </div>
                </th>
                <th className="py-4 px-6 w-3/8 border-l border-slate-200/60">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-blue-100 text-primary text-[10px] font-bold">
                      ENHANCED
                    </span>
                    <span>eAODV (Energy-Aware AODV)</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-4 px-6 font-bold text-navy-800">{row.feature}</td>
                  <td className="py-4 px-6 text-slate-600 border-l border-slate-100">
                    <div className="flex items-start gap-2">
                      <div className="w-4 h-4 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <X className="w-3 h-3 stroke-[3]" />
                      </div>
                      <span>{row.aodv}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-navy-900 border-l border-slate-100 font-medium bg-blue-50/20">
                    <div className="flex items-start gap-2">
                      <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                      <span>{row.eaodv}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Card Layout for Mobile */}
        <div className="block md:hidden p-4 space-y-4">
          {rows.map((row, idx) => (
            <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="text-sm font-bold text-navy-900 border-b border-slate-200 pb-2">
                {row.feature}
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="text-[10px] font-bold text-slate-500 uppercase">Standard AODV</div>
                <div className="flex items-start gap-2 text-slate-600">
                  <X className="w-4 h-4 text-rose-500 flex-shrink-0" />
                  <span>{row.aodv}</span>
                </div>
              </div>
              <div className="space-y-1.5 text-xs bg-blue-50/60 p-2.5 rounded-lg border border-blue-100">
                <div className="text-[10px] font-bold text-primary uppercase">Enhanced eAODV</div>
                <div className="flex items-start gap-2 text-navy-900 font-medium">
                  <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{row.eaodv}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
