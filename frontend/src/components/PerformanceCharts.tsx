import React, { useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { ScenariosMap, ScenarioDataset } from '../types/simulation';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const DEFAULT_SCENARIOS: ScenariosMap = {
  speed: {
    labels: ['2 m/s', '5 m/s', '10 m/s', '15 m/s', '20 m/s', '25 m/s'],
    pdr: { aodv: [87, 84, 78, 70, 62, 53], eaodv: [94, 92, 91, 88, 84, 79] },
    delay: { aodv: [28, 36, 54, 72, 91, 118], eaodv: [18, 24, 42, 56, 68, 84] },
    overhead: { aodv: [0.22, 0.3, 0.44, 0.58, 0.72, 0.88], eaodv: [0.16, 0.22, 0.31, 0.4, 0.51, 0.63] },
    energy: { aodv: [1.2, 1.5, 1.8, 2.2, 2.6, 3.1], eaodv: [0.9, 1.1, 1.24, 1.5, 1.8, 2.2] },
    xTitle: 'Node Speed (m/s)',
  },
  nodes: {
    labels: ['20', '30', '50', '70', '100'],
    pdr: { aodv: [82, 79, 73, 68, 61], eaodv: [91, 89, 86, 83, 79] },
    delay: { aodv: [32, 45, 58, 75, 98], eaodv: [22, 31, 42, 54, 70] },
    overhead: { aodv: [0.19, 0.28, 0.44, 0.6, 0.78], eaodv: [0.14, 0.21, 0.31, 0.43, 0.58] },
    energy: { aodv: [0.9, 1.2, 1.6, 2.1, 2.8], eaodv: [0.7, 0.9, 1.2, 1.5, 2.0] },
    xTitle: 'Number of Nodes',
  },
  traffic: {
    labels: ['5 flows', '10 flows', '20 flows', '30 flows', '50 flows'],
    pdr: { aodv: [88, 82, 74, 64, 54], eaodv: [95, 91, 87, 80, 72] },
    delay: { aodv: [25, 40, 62, 88, 122], eaodv: [18, 30, 46, 65, 90] },
    overhead: { aodv: [0.18, 0.3, 0.5, 0.72, 0.95], eaodv: [0.14, 0.23, 0.37, 0.54, 0.72] },
    energy: { aodv: [0.8, 1.2, 1.7, 2.3, 3.0], eaodv: [0.6, 0.9, 1.3, 1.7, 2.3] },
    xTitle: 'Traffic Load (flows)',
  },
};

export const PerformanceCharts: React.FC = () => {
  const [activeScenario, setActiveScenario] = useState<'speed' | 'nodes' | 'traffic'>('speed');
  const d: ScenarioDataset = DEFAULT_SCENARIOS[activeScenario];

  const getChartOptions = (yTitle: string) => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 800, easing: 'easeInOutQuart' as const },
    plugins: {
      legend: {
        labels: {
          boxWidth: 12,
          padding: 14,
          font: { size: 11, family: "'Plus Jakarta Sans', sans-serif", weight: 'bold' as const },
          color: '#24324A',
        },
      },
      tooltip: {
        backgroundColor: '#24324A',
        borderColor: '#E8ECF2',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        titleFont: { family: "'Plus Jakarta Sans', sans-serif", size: 11, weight: 'bold' as const },
        bodyFont: { family: "'Plus Jakarta Sans', sans-serif", size: 11 },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(232, 236, 242, 0.8)' },
        ticks: { color: '#77839A', font: { family: "'Plus Jakarta Sans', sans-serif", size: 10 } },
        title: {
          display: true,
          text: d.xTitle || 'Parameter',
          color: '#77839A',
          font: { family: "'Plus Jakarta Sans', sans-serif", size: 10, weight: 'bold' as const },
        },
      },
      y: {
        grid: { color: 'rgba(232, 236, 242, 0.8)' },
        ticks: { color: '#77839A', font: { family: "'Plus Jakarta Sans', sans-serif", size: 10 } },
        title: {
          display: true,
          text: yTitle,
          color: '#77839A',
          font: { family: "'Plus Jakarta Sans', sans-serif", size: 10, weight: 'bold' as const },
        },
      },
    },
  });

  const makeDataset = (label: string, data: number[], color: string) => ({
    label,
    data,
    borderColor: color,
    backgroundColor: color === '#2864E8' ? 'rgba(40, 100, 232, 0.08)' : 'rgba(148, 163, 184, 0.08)',
    pointBackgroundColor: color,
    pointBorderColor: '#FFFFFF',
    pointBorderWidth: 2,
    pointRadius: 4,
    borderWidth: 2.5,
    fill: true,
    tension: 0.35,
  });

  const chartsData = [
    {
      id: 'pdr',
      title: '📡 Packet Delivery Ratio (%)',
      tag: 'eAODV +18%',
      tagColor: 'bg-blue-50 text-primary border-blue-200',
      data: {
        labels: d.labels,
        datasets: [
          makeDataset('AODV (Baseline)', d.pdr.aodv, '#94A3B8'),
          makeDataset('eAODV (Enhanced)', d.pdr.eaodv, '#2864E8'),
        ],
      },
      yLabel: 'PDR (%)',
    },
    {
      id: 'delay',
      title: '⚡ End-to-End Delay (ms)',
      tag: '−38.5% Latency',
      tagColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      data: {
        labels: d.labels,
        datasets: [
          makeDataset('AODV (Baseline)', d.delay.aodv, '#94A3B8'),
          makeDataset('eAODV (Enhanced)', d.delay.eaodv, '#10B981'),
        ],
      },
      yLabel: 'Delay (ms)',
    },
    {
      id: 'overhead',
      title: '📶 Routing Overhead (ratio)',
      tag: '−29% Overhead',
      tagColor: 'bg-amber-50 text-amber-700 border-amber-200',
      data: {
        labels: d.labels,
        datasets: [
          makeDataset('AODV (Baseline)', d.overhead.aodv, '#94A3B8'),
          makeDataset('eAODV (Enhanced)', d.overhead.eaodv, '#F59E0B'),
        ],
      },
      yLabel: 'Overhead Ratio',
    },
    {
      id: 'energy',
      title: '🔋 Energy Consumption (J)',
      tag: '−22% Energy',
      tagColor: 'bg-blue-50 text-blue-700 border-blue-200',
      data: {
        labels: d.labels,
        datasets: [
          makeDataset('AODV (Baseline)', d.energy.aodv, '#94A3B8'),
          makeDataset('eAODV (Enhanced)', d.energy.eaodv, '#2864E8'),
        ],
      },
      yLabel: 'Energy (J)',
    },
  ];

  return (
    <section id="analysis" className="px-6 sm:px-9 py-8 border-b border-slate-100">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-navy-900 tracking-tight">
            📈 Performance Analysis
          </h2>
          <p className="text-xs sm:text-sm text-navy-500 mt-0.5">
            AODV vs eAODV comparative evaluation across node speeds, densities, and traffic loads
          </p>
        </div>

        <div className="flex items-center bg-slate-100 p-1 rounded-full border border-slate-200 text-xs gap-1">
          {(['speed', 'nodes', 'traffic'] as const).map((scen) => (
            <button
              key={scen}
              onClick={() => setActiveScenario(scen)}
              className={`px-3.5 py-1.5 rounded-full font-bold transition-all ${
                activeScenario === scen
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-navy-500 hover:text-navy-900 hover:bg-slate-200/60'
              }`}
            >
              vs {scen.charAt(0).toUpperCase() + scen.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {chartsData.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-card p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-navy-900">{item.title}</span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${item.tagColor}`}>
                {item.tag}
              </span>
            </div>
            <div className="h-[210px] w-full">
              <Line data={item.data} options={getChartOptions(item.yLabel)} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
