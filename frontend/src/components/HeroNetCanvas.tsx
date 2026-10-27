import React, { useEffect, useRef } from 'react';

export const HeroNetCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const W = canvas.width;
    const H = canvas.height;
    const NODE_COUNT = 14;

    const nodes = Array.from({ length: NODE_COUNT }, () => ({
      x: 30 + Math.random() * (W - 60),
      y: 30 + Math.random() * (H - 60),
      vx: (Math.random() - 0.5) * 0.8,
      vy: (Math.random() - 0.5) * 0.8,
      energy: 0.4 + Math.random() * 0.6,
      radius: 4.5 + Math.random() * 3,
    }));

    const render = () => {
      ctx.clearRect(0, 0, W, H);

      // Draw proximity links
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            const alpha = (1 - dist / 120) * 0.45;
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.5})`;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw nodes
      nodes.forEach((n) => {
        const color = n.energy > 0.5 ? '#10B981' : '#EF4444';

        // Glow
        const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.radius * 2.8);
        glow.addColorStop(0, n.energy > 0.5 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.35)');
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius * 2.8, 0, Math.PI * 2);
        ctx.fill();

        // Core dot
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fill();

        // Move
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 15 || n.x > W - 15) n.vx *= -1;
        if (n.y < 15 || n.y > H - 15) n.vy *= -1;
        n.energy = Math.max(0.1, Math.min(1, n.energy + (Math.random() - 0.5) * 0.002));
      });

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={340}
      height={140}
      className="w-full h-[140px] rounded-xl bg-blue-950/20 backdrop-blur-sm border border-white/10"
    />
  );
};
