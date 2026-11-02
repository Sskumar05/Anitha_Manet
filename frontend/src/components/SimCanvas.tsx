import React, { useEffect, useRef, useMemo, useState } from 'react';
import {
  ProtocolType,
  SimulationResult,
  SimulationMobilityTrace,
  SimulationRoutingTrace,
  NodeMobility,
  RoutingHopEvent,
} from '../types/simulation';
import { apiService } from '../services/api';
import { Activity } from 'lucide-react';

interface SimCanvasProps {
  isRunning: boolean;
  activeRunId?: string | null;
  nodeCount: number;
  speed: number;
  protocol: ProtocolType;
  latestResult?: SimulationResult | null;
}

// Linear interpolation between two recorded NS-3 positions
function getInterpolatedPosition(
  node: NodeMobility,
  t: number
): { x: number; y: number; z: number } {
  const positions = node.positions;
  if (!positions || positions.length === 0) return { x: 0, y: 0, z: 0 };
  if (positions.length === 1 || t <= positions[0].time) {
    return { x: positions[0].x, y: positions[0].y, z: positions[0].z };
  }
  const last = positions[positions.length - 1];
  if (t >= last.time) {
    return { x: last.x, y: last.y, z: last.z };
  }

  // Binary search for interval [k, k+1]
  let low = 0;
  let high = positions.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (positions[mid].time <= t) {
      if (mid === positions.length - 1 || positions[mid + 1].time > t) {
        const p0 = positions[mid];
        const p1 = positions[mid + 1];
        const dt = p1.time - p0.time;
        const alpha = dt > 0 ? (t - p0.time) / dt : 0;
        return {
          x: p0.x + alpha * (p1.x - p0.x),
          y: p0.y + alpha * (p1.y - p0.y),
          z: p0.z + alpha * (p1.z - p0.z),
        };
      }
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return { x: last.x, y: last.y, z: last.z };
}

interface ConfirmedRoute {
  packetUid: number;
  time: number;
  srcId: number;
  dstId: number;
  hops: Array<{ from: number; to: number }>;
}

// Parse node ID from IPv4 address (e.g. "10.1.1.1" -> Node 0)
const parseNodeIdFromIp = (ip?: string): number | null => {
  if (!ip || typeof ip !== 'string') return null;
  const parts = ip.split('.');
  if (parts.length === 4) {
    const last = parseInt(parts[3], 10);
    return !isNaN(last) && last >= 1 ? last - 1 : null;
  }
  return null;
};

// Extract actual forwarding routes from NS-3 routing trace (cbr_forward, data_forward, data_delivered)
function extractConfirmedRoutes(
  events: RoutingHopEvent[] | undefined,
  totalNodes: number
): ConfirmedRoute[] {
  if (!events || events.length === 0) return [];

  const packets = new Map<number, RoutingHopEvent[]>();
  for (const ev of events) {
    const isForward =
      ev.event_type === 'data_send' ||
      ev.event_type === 'data_forward' ||
      ev.event_type === 'data_delivered' ||
      (typeof ev.details === 'string' &&
        (ev.details.includes('cbr_forward') || ev.details.includes('cbr_delivered')));

    if (isForward && ev.packet_uid !== null && ev.packet_uid !== undefined) {
      if (!packets.has(ev.packet_uid)) {
        packets.set(ev.packet_uid, []);
      }
      packets.get(ev.packet_uid)!.push(ev);
    }
  }

  const routes: ConfirmedRoute[] = [];
  for (const [pUid, pEvents] of packets.entries()) {
    pEvents.sort((a, b) => a.time - b.time);

    let srcId: number | null = null;
    let dstId: number | null = null;

    for (const ev of pEvents) {
      if (srcId === null && ev.source_ip) {
        srcId = parseNodeIdFromIp(ev.source_ip);
      }
      if (dstId === null && ev.dest_ip) {
        dstId = parseNodeIdFromIp(ev.dest_ip);
      }
    }

    const hops: Array<{ from: number; to: number }> = [];
    for (const ev of pEvents) {
      if (
        ev.prev_hop !== null &&
        ev.prev_hop !== undefined &&
        ev.node_id !== null &&
        ev.node_id !== undefined &&
        ev.prev_hop !== ev.node_id
      ) {
        const lastHop = hops[hops.length - 1];
        if (!lastHop || lastHop.from !== ev.prev_hop || lastHop.to !== ev.node_id) {
          hops.push({ from: ev.prev_hop, to: ev.node_id });
        }
      }
    }

    if (hops.length > 0) {
      if (srcId === null) srcId = hops[0].from;
      if (dstId === null) dstId = hops[hops.length - 1].to;

      // Verify that path starts at srcId and terminates at dstId
      if (
        hops[0].from === srcId &&
        hops[hops.length - 1].to === dstId &&
        srcId >= 0 &&
        srcId < totalNodes &&
        dstId >= 0 &&
        dstId < totalNodes
      ) {
        routes.push({
          packetUid: pUid,
          time: pEvents[pEvents.length - 1].time,
          srcId,
          dstId,
          hops,
        });
      }
    }
  }

  routes.sort((a, b) => a.time - b.time);
  return routes;
}

// Deterministic pseudo-random number generator for consistent pre-run preview
function seededRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export const SimCanvas: React.FC<SimCanvasProps> = ({
  isRunning,
  activeRunId = null,
  nodeCount,
  protocol,
  latestResult = null,
}) => {
  const isConfirmedLiveRun = Boolean(
    isRunning &&
    activeRunId &&
    typeof activeRunId === 'string' &&
    activeRunId.trim().length > 0
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);
  const scanAngleRef = useRef<number>(0);
  const playbackTimeRef = useRef<number>(0);
  const pulseTimeRef = useRef<number>(0);
  const lastTimestampRef = useRef<number>(performance.now());

  const [mobilityTrace, setMobilityTrace] = useState<SimulationMobilityTrace | null>(null);
  const [routingTrace, setRoutingTrace] = useState<SimulationRoutingTrace | null>(null);
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState<number>(0);

  const targetRunId = activeRunId || latestResult?.run_id || null;

  // Retrieve actual NS-3 mobility and routing trace data from backend
  useEffect(() => {
    let isMounted = true;

    const loadTraces = async (runId: string) => {
      try {
        const [mob, route] = await Promise.all([
          apiService.getSimulationMobility(runId).catch(() => null),
          apiService.getSimulationRoutingTrace(runId).catch(() => null),
        ]);
        if (isMounted) {
          setMobilityTrace(mob);
          setRoutingTrace(route);
          playbackTimeRef.current = 0;
        }
      } catch {
        if (isMounted) {
          setMobilityTrace(null);
          setRoutingTrace(null);
        }
      }
    };

    if (targetRunId) {
      loadTraces(targetRunId);
    } else {
      apiService
        .getSimulationHistory(10)
        .then((hist) => {
          if (hist && hist.length > 0 && isMounted) {
            const completedRun = hist.find((h) => h.status === 'completed');
            if (completedRun) {
              loadTraces(completedRun.run_id);
            }
          }
        })
        .catch(() => {});
    }

    return () => {
      isMounted = false;
    };
  }, [targetRunId, isRunning]);

  // Extract confirmed multi-hop routes from actual NS-3 routing trace
  const confirmedRoutes = useMemo(() => {
    const totalNodes = mobilityTrace?.node_count || nodeCount;
    return extractConfirmedRoutes(routingTrace?.events, totalNodes);
  }, [routingTrace, mobilityTrace, nodeCount]);

  // Build deterministic pre-run node locations based on nodeCount (fallback preview)
  const preRunNodes = useMemo(() => {
    const W = 660;
    const H = 400;
    const margin = 45;
    const rng = seededRandom(42 + nodeCount);

    return Array.from({ length: nodeCount }, (_, i) => ({
      id: i,
      x: margin + rng() * (W - margin * 2),
      y: margin + rng() * (H - margin * 2),
      isSource: i === 0,
      isDest: i === nodeCount - 1,
    }));
  }, [nodeCount]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    lastTimestampRef.current = performance.now();

    const render = () => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - lastTimestampRef.current) / 1000);
      lastTimestampRef.current = now;

      ctx.clearRect(0, 0, W, H);

      // Dark scientific background
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, W, H);

      // Background Grid Dots
      ctx.fillStyle = 'rgba(51, 65, 85, 0.4)';
      for (let gx = 30; gx < W; gx += 40) {
        for (let gy = 30; gy < H; gy += 40) {
          ctx.beginPath();
          ctx.arc(gx, gy, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const isEaodv = protocol === 'eAODV';
      const nodeColor = isEaodv ? '#10B981' : '#3B82F6';

      // Check if actual NS-3 mobility trace data is loaded
      if (mobilityTrace && mobilityTrace.nodes && mobilityTrace.nodes.length > 0) {
        const duration = mobilityTrace.simulation_duration || 30.0;
        playbackTimeRef.current = (playbackTimeRef.current + dt * 1.5) % duration;
        pulseTimeRef.current = (pulseTimeRef.current + dt) % 1000;

        if (Math.abs(playbackTimeRef.current - currentPlaybackTime) > 0.4) {
          setCurrentPlaybackTime(playbackTimeRef.current);
        }

        // Coordinate scaling: NS-3 simulation boundary -> Canvas pixels
        const simArea = mobilityTrace.sim_area || 1000;
        const margin = 45;
        const availW = W - margin * 2;
        const availH = H - margin * 2;
        const scale = Math.min(availW / simArea, availH / simArea);
        const originX = (W - simArea * scale) / 2;
        const originY = H - (H - simArea * scale) / 2;

        const toCanvasX = (ns3X: number) => originX + ns3X * scale;
        const toCanvasY = (ns3Y: number) => originY - ns3Y * scale;

        // Draw Simulation Boundary
        const boxW = simArea * scale;
        const boxH = simArea * scale;
        const boxLeft = originX;
        const boxTop = originY - boxH;
        ctx.strokeStyle = 'rgba(71, 85, 105, 0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(boxLeft, boxTop, boxW, boxH);

        // Interpolate live Cartesian positions for every node at current timestamp
        const currentPositions = new Map<number, { x: number; y: number }>();
        mobilityTrace.nodes.forEach((nodeMob) => {
          const pos = getInterpolatedPosition(nodeMob, playbackTimeRef.current);
          currentPositions.set(nodeMob.node_id, {
            x: toCanvasX(pos.x),
            y: toCanvasY(pos.y),
          });
        });

        // 1. Physical Wireless Proximity Links (250m transmission range in NS-3)
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.1)';
        ctx.lineWidth = 1;
        const nodeList = mobilityTrace.nodes;
        for (let i = 0; i < nodeList.length; i++) {
          const posA = currentPositions.get(nodeList[i].node_id);
          if (!posA) continue;
          for (let j = i + 1; j < nodeList.length; j++) {
            const posB = currentPositions.get(nodeList[j].node_id);
            if (!posB) continue;
            const dist = Math.hypot(posA.x - posB.x, posA.y - posB.y);
            if (dist < 250 * scale) {
              ctx.beginPath();
              ctx.moveTo(posA.x, posA.y);
              ctx.lineTo(posB.x, posB.y);
              ctx.stroke();
            }
          }
        }

        // 2. Actual Multi-Hop Routing Path (SRC -> Intermediate Forwarders -> DST)
        // Show path only during genuine packet transmission session if confirmed routes exist
        let activeRoute: ConfirmedRoute | null = null;

        if (confirmedRoutes.length > 0) {
          const transStart = Math.min(2.0, confirmedRoutes[0].time);
          const transEnd = Math.max(
            confirmedRoutes[confirmedRoutes.length - 1].time + 1.5,
            Math.min(duration - 0.5, 29.0)
          );

          // Render confirmed route only during the genuine packet transmission window
          if (
            playbackTimeRef.current >= transStart &&
            playbackTimeRef.current <= transEnd
          ) {
            let best = confirmedRoutes[0];
            let minDiff = Infinity;
            for (const route of confirmedRoutes) {
              const diff = Math.abs(playbackTimeRef.current - route.time);
              const isFlowZero = route.srcId === 0;
              const bestIsFlowZero = best.srcId === 0;
              if (
                (isFlowZero && !bestIsFlowZero && diff < 3.0) ||
                (isFlowZero === bestIsFlowZero && diff < minDiff) ||
                (!isFlowZero && !bestIsFlowZero && diff < minDiff)
              ) {
                minDiff = diff;
                best = route;
              }
            }
            activeRoute = best;
          }
        }

        const activeSrcId = activeRoute ? activeRoute.srcId : 0;
        const activeDstId = activeRoute ? activeRoute.dstId : (mobilityTrace.node_count - 1);
        const forwarderIds = new Set<number>();

        if (activeRoute && activeRoute.hops.length > 0) {
          activeRoute.hops.forEach((hop) => {
            if (hop.from !== activeSrcId && hop.from !== activeDstId) {
              forwarderIds.add(hop.from);
            }
            if (hop.to !== activeSrcId && hop.to !== activeDstId) {
              forwarderIds.add(hop.to);
            }
          });

          // Draw Confirmed Route Path in Bright Green (#22C55E)
          activeRoute.hops.forEach((hop) => {
            const pFrom = currentPositions.get(hop.from);
            const pTo = currentPositions.get(hop.to);
            if (pFrom && pTo) {
              // Outer glow line
              ctx.save();
              ctx.strokeStyle = 'rgba(34, 197, 94, 0.30)';
              ctx.lineWidth = 7;
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
              ctx.beginPath();
              ctx.moveTo(pFrom.x, pFrom.y);
              ctx.lineTo(pTo.x, pTo.y);
              ctx.stroke();

              // Solid Glowing Route Segment (Bright Green: #22C55E)
              ctx.strokeStyle = '#22C55E';
              ctx.lineWidth = 2.5;
              ctx.shadowColor = 'rgba(34, 197, 94, 0.85)';
              ctx.shadowBlur = 8;
              ctx.beginPath();
              ctx.moveTo(pFrom.x, pFrom.y);
              ctx.lineTo(pTo.x, pTo.y);
              ctx.stroke();
              ctx.restore();
            }
          });

          // Subtle animated packet pulse traveling continuously from SRC -> Intermediate(s) -> DST
          const totalHops = activeRoute.hops.length;
          const drawPulse = (prog: number) => {
            const scaled = prog * totalHops;
            const hIdx = Math.min(totalHops - 1, Math.floor(scaled));
            const frac = scaled - hIdx;
            const targetHop = activeRoute.hops[hIdx];
            if (!targetHop) return;

            const pFrom = currentPositions.get(targetHop.from);
            const pTo = currentPositions.get(targetHop.to);
            if (!pFrom || !pTo) return;

            const px = pFrom.x + (pTo.x - pFrom.x) * frac;
            const py = pFrom.y + (pTo.y - pFrom.y) * frac;

            ctx.save();
            ctx.fillStyle = '#FFFFFF';
            ctx.shadowColor = '#86EFAC'; // Bright green glow
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(px, py, 3.5, 0, Math.PI * 2);
            ctx.fill();

            // Tiny outer aura for high visibility
            ctx.fillStyle = 'rgba(34, 197, 94, 0.55)';
            ctx.beginPath();
            ctx.arc(px, py, 5.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          };

          const pulseProg = (pulseTimeRef.current * 1.3) % 1.0;
          drawPulse(pulseProg);
          if (totalHops > 1) {
            drawPulse((pulseProg + 0.5) % 1.0);
          }
        }

        // 3. Draw Nodes with Exact Roles
        mobilityTrace.nodes.forEach((nodeMob) => {
          const pos = currentPositions.get(nodeMob.node_id);
          if (!pos) return;

          const isSource = nodeMob.node_id === activeSrcId;
          const isDest = nodeMob.node_id === activeDstId;
          const isForwarder = forwarderIds.has(nodeMob.node_id);
          const isParticipating = isSource || isDest || isForwarder;

          const color = isSource
            ? '#3B82F6'
            : isDest
            ? '#F59E0B'
            : isForwarder
            ? '#8B5CF6'
            : nodeColor;

          const radius = isSource || isDest ? 7 : isForwarder ? 6 : 5;

          // Glow halo
          const glow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, radius * 2.8);
          if (isSource) {
            glow.addColorStop(0, 'rgba(59, 130, 246, 0.45)');
          } else if (isDest) {
            glow.addColorStop(0, 'rgba(245, 158, 11, 0.45)');
          } else if (isForwarder) {
            glow.addColorStop(0, 'rgba(139, 92, 246, 0.45)');
          } else {
            glow.addColorStop(0, 'rgba(51, 65, 85, 0.25)');
          }
          glow.addColorStop(1, 'transparent');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, radius * 2.8, 0, Math.PI * 2);
          ctx.fill();

          // Node center
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
          ctx.fill();

          // Node border
          ctx.strokeStyle = isParticipating ? '#FFFFFF' : 'rgba(255, 255, 255, 0.7)';
          ctx.lineWidth = isParticipating ? 1.5 : 1;
          ctx.stroke();

          // Label
          if (isSource) {
            ctx.fillStyle = '#60A5FA';
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('SRC', pos.x, pos.y - radius - 5);
          } else if (isDest) {
            ctx.fillStyle = '#FBBF24';
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('DST', pos.x, pos.y - radius - 5);
          } else if (isForwarder) {
            ctx.fillStyle = '#C4B5FD';
            ctx.font = 'bold 8.5px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`N${nodeMob.node_id}`, pos.x, pos.y - radius - 4);
          }
        });
      } else {
        // Fallback: Deterministic Pre-Run Conceptual Layout
        ctx.strokeStyle = 'rgba(71, 85, 105, 0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(20, 20, W - 40, H - 40);

        // Proximity range links
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.12)';
        ctx.lineWidth = 1;
        for (let i = 0; i < preRunNodes.length; i++) {
          for (let j = i + 1; j < preRunNodes.length; j++) {
            const dx = preRunNodes[i].x - preRunNodes[j].x;
            const dy = preRunNodes[i].y - preRunNodes[j].y;
            const dist = Math.hypot(dx, dy);
            if (dist < 110) {
              ctx.beginPath();
              ctx.moveTo(preRunNodes[i].x, preRunNodes[i].y);
              ctx.lineTo(preRunNodes[j].x, preRunNodes[j].y);
              ctx.stroke();
            }
          }
        }

        // Draw Nodes
        preRunNodes.forEach((n) => {
          const isSpecial = n.isSource || n.isDest;
          const color = n.isSource ? '#3B82F6' : n.isDest ? '#F59E0B' : nodeColor;
          const radius = isSpecial ? 7 : 5;

          const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, radius * 2.5);
          glow.addColorStop(0, isSpecial ? 'rgba(245, 158, 11, 0.35)' : 'rgba(59, 130, 246, 0.25)');
          glow.addColorStop(1, 'transparent');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(n.x, n.y, radius * 2.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1;
          ctx.stroke();

          if (isSpecial) {
            ctx.fillStyle = '#F8FAFC';
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(n.isSource ? 'SRC' : 'DST', n.x, n.y - radius - 5);
          }
        });
      }

      // Live Execution Radar Sweep Indicator (during active NS-3 execution)
      if (isConfirmedLiveRun) {
        scanAngleRef.current = (scanAngleRef.current + 0.03) % (Math.PI * 2);
        const centerX = W / 2;
        const centerY = H / 2;
        const radarRadius = Math.min(W, H) * 0.42;

        ctx.strokeStyle = 'rgba(16, 185, 129, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radarRadius, 0, Math.PI * 2);
        ctx.stroke();

        const sweepX = centerX + Math.cos(scanAngleRef.current) * radarRadius;
        const sweepY = centerY + Math.sin(scanAngleRef.current) * radarRadius;

        const sweepGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radarRadius);
        sweepGrad.addColorStop(0, 'rgba(16, 185, 129, 0.15)');
        sweepGrad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

        ctx.fillStyle = sweepGrad;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radarRadius, scanAngleRef.current - 0.5, scanAngleRef.current);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(sweepX, sweepY);
        ctx.stroke();

        // Execution banner
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(W / 2 - 160, H - 48, 320, 26);
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)';
        ctx.strokeRect(W / 2 - 160, H - 48, 320, 26);

        ctx.fillStyle = '#34D399';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`[NS-3 RUNNING] Executing ${protocol} in WSL2...`, W / 2, H - 32);
      }

      animRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [preRunNodes, mobilityTrace, confirmedRoutes, isConfirmedLiveRun, protocol]);

  return (
    <div className="w-full flex flex-col items-center">
      {/* Studio Schematic Header */}
      <div className="w-full flex items-center justify-between mb-3 px-1">
        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-[#635BFF]" />
          <span>Studio Topology Layout</span>
        </span>
        <span
          className={`text-[11px] font-bold px-3 py-1 rounded-full border ${
            isConfirmedLiveRun
              ? 'text-emerald-700 bg-emerald-50 border-emerald-200 animate-pulse'
              : mobilityTrace
              ? 'text-indigo-700 bg-indigo-50 border-indigo-200'
              : 'text-slate-600 bg-slate-100 border-slate-200'
          }`}
        >
          {isConfirmedLiveRun
            ? `Live NS-3 Simulation Running · Run #${activeRunId?.slice(-8)}`
            : mobilityTrace
            ? `NS-3 Playback · Run #${targetRunId?.slice(-8)} (t = ${currentPlaybackTime.toFixed(1)}s)`
            : 'Pre-Run Parameter Preview (Conceptual Layout)'}
        </span>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={660}
        height={400}
        className="w-full max-w-[660px] h-[320px] sm:h-[380px] bg-[#13141F] rounded-[24px] border border-slate-800 shadow-xl"
      />

      {/* Legend & Attribution */}
      <div className="flex flex-col sm:flex-row items-center justify-center w-full mt-3.5 px-1 text-xs text-slate-500 gap-2">
        <div className="flex items-center gap-3.5 flex-wrap justify-center">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#3B82F6]"></span>
            <span className="text-[11px] font-bold text-slate-700">Source (SRC)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            <span className="text-[11px] font-bold text-slate-700">Destination (DST)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#8B5CF6]"></span>
            <span className="text-[11px] font-bold text-slate-700">Forwarding Node</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
            <span className="text-[11px] font-bold text-slate-700">
              {mobilityTrace ? `Ad-Hoc Nodes (${mobilityTrace.node_count})` : `Ad-Hoc Nodes (${nodeCount})`}
            </span>
          </div>
          {confirmedRoutes.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-1 rounded-full bg-[#22C55E] shadow-sm"></span>
              <span className="text-[11px] font-bold text-[#22C55E]">
                NS-3 {protocol} Communication Path
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
