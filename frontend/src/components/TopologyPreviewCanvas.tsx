import React, { useEffect, useRef } from 'react';

interface TopologyPreviewCanvasProps {
  nodeCount?: number;
}

export const TopologyPreviewCanvas: React.FC<TopologyPreviewCanvasProps> = ({ nodeCount = 18 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const W = canvas.width;
    const H = canvas.height;

    const nodes = Array.from({ length: nodeCount }, (_, i) => ({
      x: 20 + Math.random() * (W - 40),
      y: 20 + Math.random() * (H - 40),
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.6,
      isSource: i === 0,
      isDest: i === 1,
      energy: 0.35 + Math.random() * 0.65,
      radius: i === 0 || i === 1 ? 5 : 3.5,
    }));

    const render = () => {
      ctx.clearRect(0, 0, W, H);

      // Clean, light background
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(0, 0, W, H);

      // Subtle grid dots
      ctx.fillStyle = '#E2E8F0';
      for (let x = 15; x < W; x += 25) {
        for (let y = 15; y < H; y += 25) {
          ctx.beginPath();
          ctx.arc(x, y, 0.9, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Proximity wireless links
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 75) {
            const alpha = (1 - dist / 75) * 0.4;
            ctx.strokeStyle = `rgba(99, 91, 255, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }

      // Render nodes
      nodes.forEach((n) => {
        // Node color
        let nodeColor = '#64748B';
        if (n.isSource) nodeColor = '#635BFF'; // Source Purple
        else if (n.isDest) nodeColor = '#F59E0B'; // Dest Amber
        else if (n.energy > 0.5) nodeColor = '#10B981'; // Healthy Green
        else nodeColor = '#EF4444'; // Depleted Red

        // Outer glow
        ctx.fillStyle = n.isSource
          ? 'rgba(99, 91, 255, 0.15)'
          : n.isDest
          ? 'rgba(245, 158, 11, 0.15)'
          : 'rgba(16, 185, 129, 0.12)';
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius * 2.2, 0, Math.PI * 2);
        ctx.fill();

        // Node center
        ctx.fillStyle = nodeColor;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fill();

        // Move
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 15 || n.x > W - 15) n.vx *= -1;
        if (n.y < 15 || n.y > H - 15) n.vy *= -1;
      });

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [nodeCount]);

  return (
    <div className="w-full flex flex-col items-center">
      <canvas
        ref={canvasRef}
        width={480}
        height={180}
        className="w-full h-[180px] rounded-xl border border-slate-200/90 shadow-inner"
      />
      <div className="flex items-center justify-between w-full mt-2.5 px-1 text-[11px] text-slate-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-2 h-2 rounded-full bg-[#635BFF]"></span> Source
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span> Destination
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Energy-Rich
          </span>
        </div>
        <span className="font-mono text-[10px] text-slate-400">Random Walk 2D</span>
      </div>
    </div>
  );
};

