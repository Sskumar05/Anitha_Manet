import React, { useEffect, useRef } from 'react';
import { ProtocolType } from '../types/simulation';

interface SimNode {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  energy: number;
  isSource: boolean;
  isDest: boolean;
}

interface SimPacket {
  route: SimNode[];
  progress: number;
  speed: number;
  color: string;
  delivered: boolean;
}

interface SimCanvasProps {
  isRunning: boolean;
  nodeCount: number;
  speed: number;
  protocol: ProtocolType;
  onPacketDelivered?: () => void;
  onLogGenerated?: (log: string) => void;
}

export const SimCanvas: React.FC<SimCanvasProps> = ({
  isRunning,
  nodeCount,
  speed,
  protocol,
  onPacketDelivered,
  onLogGenerated,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const packetsRef = useRef<SimPacket[]>([]);
  const timeRef = useRef<number>(0);
  const animRef = useRef<number | null>(null);

  const toDist = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const buildNodes = (count: number, width: number, height: number): SimNode[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: 30 + Math.random() * (width - 60),
      y: 30 + Math.random() * (height - 60),
      vx: (Math.random() - 0.5) * (speed / 8),
      vy: (Math.random() - 0.5) * (speed / 8),
      energy: 0.35 + Math.random() * 0.65,
      isSource: i === 0,
      isDest: i === count - 1,
    }));
  };

  const spawnPacket = (nodes: SimNode[], proto: ProtocolType): SimPacket => {
    const src = nodes.find((n) => n.isSource) || nodes[0];
    const dst = nodes.find((n) => n.isDest) || nodes[nodes.length - 1];
    const route: SimNode[] = [src];
    let current = src;

    for (let step = 0; step < 5; step++) {
      let best: SimNode | null = null;
      let bestScore = Infinity;

      nodes.forEach((n) => {
        if (route.includes(n)) return;
        const dist = toDist(n, current);
        const toDst = toDist(n, dst);
        let score = dist + toDst;
        if (proto === 'eAODV') {
          score += (1 - n.energy) * 200; // Energy-aware penalty
        }
        if (score < bestScore) {
          bestScore = score;
          best = n;
        }
      });

      if (!best) break;
      route.push(best);
      current = best;
      if (current === dst || toDist(current, dst) < 50) {
        if (!route.includes(dst)) route.push(dst);
        break;
      }
    }

    if (!route.includes(dst)) route.push(dst);
    return { route, progress: 0, speed: 0.015, color: '#2864E8', delivered: false };
  };

  // Rebuild nodes when count changes or on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    nodesRef.current = buildNodes(nodeCount, canvas.width, canvas.height);
    packetsRef.current = [spawnPacket(nodesRef.current, protocol)];
  }, [nodeCount]);

  // Update speeds dynamically
  useEffect(() => {
    const sFactor = speed / 8;
    nodesRef.current.forEach((n) => {
      n.vx = (Math.random() - 0.5) * sFactor;
      n.vy = (Math.random() - 0.5) * sFactor;
    });
  }, [speed]);

  // Canvas loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    const render = () => {
      ctx.clearRect(0, 0, W, H);

      // Background Grid Dots
      ctx.fillStyle = 'rgba(36, 50, 74, 0.06)';
      for (let gx = 30; gx < W; gx += 40) {
        for (let gy = 30; gy < H; gy += 40) {
          ctx.beginPath();
          ctx.arc(gx, gy, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      timeRef.current++;

      const nodes = nodesRef.current;

      // Draw links between nodes within range
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const d = toDist(nodes[i], nodes[j]);
          if (d < 130) {
            const alpha = (1 - d / 130) * 0.22;
            ctx.strokeStyle = `rgba(40, 100, 232, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }

      // Highlight active route links
      packetsRef.current.forEach((pkt) => {
        for (let k = 0; k < pkt.route.length - 1; k++) {
          const a = pkt.route[k];
          const b = pkt.route[k + 1];
          ctx.strokeStyle = 'rgba(40, 100, 232, 0.65)';
          ctx.lineWidth = 2.2;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });

      // Draw nodes
      nodes.forEach((n) => {
        const color = n.isSource
          ? '#2864E8'
          : n.isDest
          ? '#F59E0B'
          : n.energy > 0.35
          ? '#10B981'
          : '#EF4444';

        // Glow
        const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 16);
        glow.addColorStop(
          0,
          color === '#2864E8'
            ? 'rgba(40, 100, 232, 0.3)'
            : color === '#10B981'
            ? 'rgba(16, 185, 129, 0.3)'
            : 'rgba(239, 68, 68, 0.3)'
        );
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 16, 0, Math.PI * 2);
        ctx.fill();

        // Node center
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 5.5, 0, Math.PI * 2);
        ctx.fill();

        // Battery Ring
        ctx.strokeStyle = color + 'aa';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 8.5, 0, Math.PI * 2 * n.energy);
        ctx.stroke();

        // Label for SRC/DST
        if (n.isSource || n.isDest) {
          ctx.fillStyle = '#24324A';
          ctx.font = 'bold 10px "Plus Jakarta Sans", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(n.isSource ? 'SRC' : 'DST', n.x, n.y - 14);
        }

        // Movement
        if (isRunning) {
          n.x += n.vx;
          n.y += n.vy;
          if (n.x < 20 || n.x > W - 20) n.vx *= -1;
          if (n.y < 20 || n.y > H - 20) n.vy *= -1;

          // Energy drain
          if (protocol === 'eAODV') n.energy = Math.max(0.1, n.energy - 0.0001);
          else n.energy = Math.max(0.1, n.energy - 0.0003);
        }
      });

      // Packet animation
      if (isRunning) {
        packetsRef.current = packetsRef.current.filter((pkt) => !pkt.delivered);
        packetsRef.current.forEach((pkt) => {
          pkt.progress += pkt.speed;
          const totalSeg = pkt.route.length - 1;
          const seg = Math.floor(pkt.progress * totalSeg);
          if (seg >= totalSeg) {
            pkt.delivered = true;
            if (onPacketDelivered) onPacketDelivered();
            return;
          }
          const t = pkt.progress * totalSeg - seg;
          const a = pkt.route[seg];
          const b = pkt.route[seg + 1];
          const px = a.x + (b.x - a.x) * t;
          const py = a.y + (b.y - a.y) * t;

          const glow2 = ctx.createRadialGradient(px, py, 0, px, py, 12);
          glow2.addColorStop(0, 'rgba(40, 100, 232, 0.4)');
          glow2.addColorStop(1, 'transparent');
          ctx.fillStyle = glow2;
          ctx.beginPath();
          ctx.arc(px, py, 12, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#2864E8';
          ctx.beginPath();
          ctx.arc(px, py, 4.5, 0, Math.PI * 2);
          ctx.fill();
        });

        // Spawn packets every 120 ticks
        if (timeRef.current % 120 === 0) {
          packetsRef.current.push(spawnPacket(nodes, protocol));
          // Drain random node energy
          nodes.forEach((n) => {
            n.energy = Math.max(0.05, n.energy - Math.random() * 0.02);
          });
          if (onLogGenerated) {
            const randomId = Math.floor(Math.random() * nodes.length);
            const rMsg =
              protocol === 'eAODV'
                ? `[eAODV] Next hop selected via node #${randomId} (residual battery: ${(nodes[randomId]?.energy * 100).toFixed(0)}%)`
                : `[AODV] Next hop selected via node #${randomId} (min delay)`;
            onLogGenerated(rMsg);
          }
        }
      }

      animRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isRunning, protocol, onPacketDelivered, onLogGenerated]);

  return (
    <div className="w-full flex flex-col items-center">
      <canvas
        ref={canvasRef}
        width={660}
        height={400}
        className="w-full max-w-[660px] h-[340px] sm:h-[400px] bg-slate-50 rounded-2xl border border-slate-200 shadow-inner"
      />

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 mt-3 text-xs font-semibold text-navy-500">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-emerald-200"></span>
          <span>Normal Node (high energy)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-rose-500 ring-2 ring-rose-200"></span>
          <span>Low Energy Node</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-blue-600 ring-2 ring-blue-200"></span>
          <span>Active Route</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-primary animate-ping"></span>
          <span>Data Packet</span>
        </div>
      </div>
    </div>
  );
};
