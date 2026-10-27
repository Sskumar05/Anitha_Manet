import React, { useEffect, useRef, useState } from 'react';

interface TopoNode {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  energy: number;
  isSource: boolean;
  isDest: boolean;
}

export const TopologyVisualizer: React.FC = () => {
  const [mode, setMode] = useState<'static' | 'dynamic' | 'route'>('static');
  const [stats, setStats] = useState({
    nodes: 50,
    links: 127,
    routes: 4,
    pdr: '91.4%',
    energy: '87%',
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<TopoNode[]>([]);
  const linksRef = useRef<[number, number][]>([]);
  const routeRef = useRef<TopoNode[]>([]);
  const animRef = useRef<number | null>(null);

  const toDist = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const initTopo = (W: number, H: number) => {
    const count = 50;
    const nodes: TopoNode[] = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: 30 + Math.random() * (W - 60),
      y: 30 + Math.random() * (H - 60),
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.6,
      energy: 0.35 + Math.random() * 0.65,
      isSource: i === 0,
      isDest: i === count - 1,
    }));
    nodesRef.current = nodes;

    // Links
    const links: [number, number][] = [];
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        if (toDist(nodes[i], nodes[j]) < 130) {
          links.push([i, j]);
        }
      }
    }
    linksRef.current = links;

    // Pick Route
    const src = nodes[0];
    const dst = nodes[count - 1];
    const route = [src];
    let cur = src;
    for (let s = 0; s < 6; s++) {
      let best: TopoNode | null = null;
      let bestScore = Infinity;
      nodes.forEach((n) => {
        if (route.includes(n)) return;
        const score = toDist(n, cur) + toDist(n, dst) + (1 - n.energy) * 150;
        if (score < bestScore) {
          bestScore = score;
          best = n;
        }
      });
      if (!best) break;
      route.push(best);
      cur = best;
      if (toDist(cur, dst) < 60) break;
    }
    route.push(dst);
    routeRef.current = route;

    updateStats(links.length, nodes);
  };

  const updateStats = (linkCount: number, nodes: TopoNode[]) => {
    const avgE = (nodes.reduce((s, n) => s + n.energy, 0) / nodes.length) * 100;
    setStats({
      nodes: nodes.length,
      links: linkCount,
      routes: routeRef.current.length > 2 ? 3 : 1,
      pdr: `${(88 + Math.random() * 6).toFixed(1)}%`,
      energy: `${avgE.toFixed(0)}%`,
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.clientWidth;
    }
    initTopo(canvas.width, canvas.height);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      // Grid background dots
      ctx.fillStyle = 'rgba(36, 50, 74, 0.05)';
      for (let gx = 30; gx < W; gx += 50) {
        for (let gy = 30; gy < H; gy += 50) {
          ctx.beginPath();
          ctx.arc(gx, gy, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const nodes = nodesRef.current;
      if (nodes.length === 0) return;

      // Transmission Range for Source
      const src = nodes[0];
      ctx.strokeStyle = 'rgba(40, 100, 232, 0.18)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.arc(src.x, src.y, 130, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Links
      if (mode === 'static' || mode === 'dynamic') {
        linksRef.current.forEach(([i, j]) => {
          const a = nodes[i];
          const b = nodes[j];
          if (!a || !b) return;
          const d = toDist(a, b);
          if (d > 130) return;
          ctx.strokeStyle = `rgba(40, 100, 232, ${(1 - d / 130) * 0.18})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        });
      }

      // Highlighted Route
      if (mode === 'route') {
        const route = routeRef.current;
        for (let k = 0; k < route.length - 1; k++) {
          const a = route[k];
          const b = route[k + 1];
          ctx.strokeStyle = 'rgba(40, 100, 232, 0.75)';
          ctx.lineWidth = 2.5;
          ctx.setLineDash([8, 4]);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // Nodes
      nodes.forEach((n) => {
        const onRoute = mode === 'route' && routeRef.current.includes(n);
        const color = n.isSource
          ? '#2864E8'
          : n.isDest
          ? '#F59E0B'
          : onRoute
          ? '#2864E8'
          : n.energy > 0.4
          ? '#10B981'
          : '#EF4444';
        const r = n.isSource || n.isDest ? 7 : onRoute ? 6 : 4.5;

        // Glow
        const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 3);
        glow.addColorStop(0, color === '#2864E8' ? 'rgba(40, 100, 232, 0.35)' : 'rgba(16, 185, 129, 0.35)');
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r * 3, 0, Math.PI * 2);
        ctx.fill();

        // Node
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fill();

        // Label
        if (n.isSource || n.isDest) {
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 9px "Plus Jakarta Sans", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(n.isSource ? 'S' : 'D', n.x, n.y - r - 6);
        }
      });
    };

    if (mode === 'dynamic') {
      const loop = () => {
        const nodes = nodesRef.current;
        nodes.forEach((n) => {
          n.x += n.vx;
          n.y += n.vy;
          if (n.x < 20 || n.x > W - 20) n.vx *= -1;
          if (n.y < 20 || n.y > H - 20) n.vy *= -1;
          n.energy = Math.max(0.05, n.energy - 0.0001);
        });

        // Rebuild links
        const links: [number, number][] = [];
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            if (toDist(nodes[i], nodes[j]) < 130) {
              links.push([i, j]);
            }
          }
        }
        linksRef.current = links;

        draw();
        updateStats(links.length, nodes);
        animRef.current = requestAnimationFrame(loop);
      };

      loop();
    } else {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      draw();
    }

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [mode]);

  return (
    <section id="topology" className="px-6 sm:px-9 py-8 border-b border-slate-100">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-navy-900 tracking-tight">
            🗺️ Network Topology Visualizer
          </h2>
          <p className="text-xs sm:text-sm text-navy-500 mt-0.5">
            Interactive MANET node distribution with transmission range overlay & multi-hop links
          </p>
        </div>

        <div className="flex items-center bg-slate-100 p-1 rounded-full border border-slate-200 text-xs gap-1">
          <button
            onClick={() => setMode('static')}
            className={`px-4 py-1.5 rounded-full font-bold transition-all ${
              mode === 'static' ? 'bg-primary text-white shadow-sm' : 'text-navy-500 hover:text-navy-900'
            }`}
          >
            Static
          </button>
          <button
            onClick={() => setMode('dynamic')}
            className={`px-4 py-1.5 rounded-full font-bold transition-all ${
              mode === 'dynamic' ? 'bg-primary text-white shadow-sm' : 'text-navy-500 hover:text-navy-900'
            }`}
          >
            Dynamic
          </button>
          <button
            onClick={() => setMode('route')}
            className={`px-4 py-1.5 rounded-full font-bold transition-all ${
              mode === 'route' ? 'bg-primary text-white shadow-sm' : 'text-navy-500 hover:text-navy-900'
            }`}
          >
            Show Routes
          </button>
        </div>
      </div>

      <div className="bg-white rounded-card p-4 sm:p-6 border border-slate-200/80 shadow-sm flex flex-col gap-4">
        <canvas
          ref={canvasRef}
          height={380}
          className="w-full h-[320px] sm:h-[380px] bg-slate-50/70 rounded-2xl border border-slate-200 shadow-inner"
        />

        {/* Live Topology Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 border-t border-slate-100 text-center">
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
            <div className="text-lg sm:text-xl font-extrabold text-navy-900">{stats.nodes}</div>
            <div className="text-[11px] font-bold text-navy-400 uppercase tracking-wider">Active Nodes</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
            <div className="text-lg sm:text-xl font-extrabold text-navy-900">{stats.links}</div>
            <div className="text-[11px] font-bold text-navy-400 uppercase tracking-wider">Active Links</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
            <div className="text-lg sm:text-xl font-extrabold text-navy-900">{stats.routes}</div>
            <div className="text-[11px] font-bold text-navy-400 uppercase tracking-wider">Active Routes</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
            <div className="text-lg sm:text-xl font-extrabold text-emerald-600">{stats.pdr}</div>
            <div className="text-[11px] font-bold text-navy-400 uppercase tracking-wider">Live PDR</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 col-span-2 sm:col-span-1">
            <div className="text-lg sm:text-xl font-extrabold text-primary">{stats.energy}</div>
            <div className="text-[11px] font-bold text-navy-400 uppercase tracking-wider">Avg Energy</div>
          </div>
        </div>
      </div>
    </section>
  );
};
