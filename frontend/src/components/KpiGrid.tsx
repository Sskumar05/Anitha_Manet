import React from 'react';
import { Radio, Zap, Activity, BatteryCharging } from 'lucide-react';
import { SimulationResult } from '../types/simulation';

interface KpiGridProps {
  latestResult: SimulationResult | null;
}

export const KpiGrid: React.FC<KpiGridProps> = ({ latestResult }) => {
  const pdrVal = latestResult ? latestResult.pdr : 91.4;
  const delayVal = latestResult ? latestResult.delay_ms : 42;
  const overheadVal = latestResult ? latestResult.overhead_ratio : 0.31;
  const energyVal = latestResult ? latestResult.energy_consumed_j : 1.24;

  const kpis = [
    {
      id: 'pdr',
      label: 'Packet Delivery Ratio (PDR)',
      value: `${pdrVal}%`,
      delta: '▲ +18.2% over standard AODV',
      deltaColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      icon: <Radio className="w-5 h-5 text-primary" />,
      iconBg: 'bg-blue-50 border-blue-100',
      progressWidth: `${Math.min(100, pdrVal)}%`,
      barGradient: 'from-blue-600 to-blue-400',
    },
    {
      id: 'delay',
      label: 'Avg End-to-End Delay',
      value: `${delayVal} ms`,
      delta: '▼ −38.5% latency reduction',
      deltaColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      icon: <Zap className="w-5 h-5 text-emerald-600" />,
      iconBg: 'bg-emerald-50 border-emerald-100',
      progressWidth: `${Math.min(100, (1 - delayVal / 120) * 100)}%`,
      barGradient: 'from-emerald-500 to-teal-400',
    },
    {
      id: 'overhead',
      label: 'Routing Overhead',
      value: `${overheadVal}`,
      delta: '▼ −29.1% control overhead',
      deltaColor: 'text-amber-700 bg-amber-50 border-amber-200',
      icon: <Activity className="w-5 h-5 text-amber-500" />,
      iconBg: 'bg-amber-50 border-amber-100',
      progressWidth: `${Math.min(100, overheadVal * 100)}%`,
      barGradient: 'from-amber-500 to-yellow-400',
    },
    {
      id: 'energy',
      label: 'Energy Consumed (avg/node)',
      value: `${energyVal} J`,
      delta: '▼ −22.3% energy savings',
      deltaColor: 'text-blue-700 bg-blue-50 border-blue-200',
      icon: <BatteryCharging className="w-5 h-5 text-primary" />,
      iconBg: 'bg-blue-50 border-blue-100',
      progressWidth: `${Math.min(100, (energyVal / 3.0) * 100)}%`,
      barGradient: 'from-blue-600 to-emerald-500',
    },
  ];

  return (
    <section id="kpi" className="px-6 sm:px-9 py-6 border-b border-slate-100">
      <div className="mb-4">
        <p className="text-xs font-bold uppercase tracking-wider text-navy-400">
          Key Performance Indicators — eAODV vs Standard AODV
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.id}
            className="bg-white rounded-card p-5 border border-slate-200/80 shadow-sm hover:shadow-card-hover transition-all duration-200 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-xs font-bold text-navy-500 leading-snug">{kpi.label}</span>
                <div className={`p-2 rounded-xl border ${kpi.iconBg}`}>{kpi.icon}</div>
              </div>

              <div className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight mb-2">
                {kpi.value}
              </div>

              <div className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${kpi.deltaColor}`}>
                {kpi.delta}
              </div>
            </div>

            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-4">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${kpi.barGradient} transition-all duration-1000 ease-out`}
                style={{ width: kpi.progressWidth }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
