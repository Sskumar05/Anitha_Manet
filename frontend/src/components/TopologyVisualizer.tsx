import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  Layers,
  Compass,
  Eye,
  Info,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Clock,
  MapPin,
  Sliders,
  Radio,
  Wifi,
  WifiOff,
  Zap,
  Activity,
  GitCommit,
  Share2,
  Route,
  Box,
} from 'lucide-react';
import {
  SimulationMobilityTrace,
  SimulationLinkTrace,
  SimulationRoutingTrace,
  RoutingHopEvent,
  WirelessLinkEvent,
  NodeMobility,
  NodePosition,
  SimulationResult,
  SimulationHistoryItem,
} from '../types/simulation';
import { apiService } from '../services/api';

export interface TopologyVisualizerProps {
  latestResult?: SimulationResult | null;
  isBackendAvailable?: boolean;
  onSelectRun?: (runId: string) => void;
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

// Binary search to find events active within [currentTime - windowSec, currentTime]
function getActiveLinkEvents(
  events: WirelessLinkEvent[] | undefined,
  t: number,
  windowSec: number
): WirelessLinkEvent[] {
  if (!events || events.length === 0) return [];
  const minTime = t - windowSec;
  if (minTime > events[events.length - 1].time || t < events[0].time) return [];

  let low = 0;
  let high = events.length - 1;
  let startIndex = events.length;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (events[mid].time >= minTime) {
      startIndex = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  const active: WirelessLinkEvent[] = [];
  for (let i = startIndex; i < events.length; i++) {
    if (events[i].time > t) break;
    active.push(events[i]);
  }
  return active;
}

// Binary search to find routing/forwarding events active within [currentTime - windowSec, currentTime]
function getActiveRoutingEvents(
  events: RoutingHopEvent[] | undefined,
  t: number,
  windowSec: number
): RoutingHopEvent[] {
  if (!events || events.length === 0) return [];
  const minTime = t - windowSec;
  if (minTime > events[events.length - 1].time || t < events[0].time) return [];

  let low = 0;
  let high = events.length - 1;
  let startIndex = events.length;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (events[mid].time >= minTime) {
      startIndex = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  const active: RoutingHopEvent[] = [];
  for (let i = startIndex; i < events.length; i++) {
    if (events[i].time > t) break;
    active.push(events[i]);
  }
  return active;
}

export const TopologyVisualizer: React.FC<TopologyVisualizerProps> = ({
  latestResult,
  isBackendAvailable = true,
  onSelectRun,
}) => {
  // Pre-validated baseline runs with genuine NS-3 mobility & PHY wireless links
  const TARGET_AODV_RUN = 'sim_1793351059_25f594';
  const TARGET_EAODV_RUN = 'sim_1793350617_8f480e';

  // Selection state
  const [selectedRunId, setSelectedRunId] = useState<string>(
    latestResult?.run_id || TARGET_EAODV_RUN
  );
  const [historyRuns, setHistoryRuns] = useState<SimulationHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);

  // Mobility trace state
  const [trace, setTrace] = useState<SimulationMobilityTrace | null>(null);
  const [traceLoading, setTraceLoading] = useState<boolean>(false);
  const [traceError, setTraceError] = useState<string | null>(null);

  // Wireless link trace state (Phase 4)
  const [linkTrace, setLinkTrace] = useState<SimulationLinkTrace | null>(null);
  const [linkLoading, setLinkLoading] = useState<boolean>(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [showWirelessLinks, setShowWirelessLinks] = useState<boolean>(true);
  const [showDrops, setShowDrops] = useState<boolean>(true);

  // Multi-hop routing trace state (Phase 5)
  const [routingTrace, setRoutingTrace] = useState<SimulationRoutingTrace | null>(null);
  const [routingLoading, setRoutingLoading] = useState<boolean>(false);
  const [routingError, setRoutingError] = useState<string | null>(null);
  const [showRoutingPaths, setShowRoutingPaths] = useState<boolean>(true);
  const [showControlWaves, setShowControlWaves] = useState<boolean>(true);
  const [selectedPacketUid, setSelectedPacketUid] = useState<number | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0.0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);

  // Visualization toggles
  const [showTrails, setShowTrails] = useState<boolean>(true);
  const [showRange, setShowRange] = useState<boolean>(false);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<number | null>(null);

  // Canvas & animation refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const requestIdRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);

  // Coordinate transformation cache
  const [canvasDimensions, setCanvasDimensions] = useState<{ width: number; height: number }>({
    width: 800,
    height: 480,
  });

  // Fetch available simulation runs from database history
  const loadHistory = useCallback(async () => {
    if (!isBackendAvailable) return;
    setHistoryLoading(true);
    try {
      const items = await apiService.getSimulationHistory(40);
      setHistoryRuns(items);
    } catch (e: any) {
      console.warn('Could not load history for topology selector:', e.message);
    } finally {
      setHistoryLoading(false);
    }
  }, [isBackendAvailable]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Synchronize when a new simulation finishes in App or is selected from HistoryModal
  useEffect(() => {
    if (latestResult?.run_id) {
      setSelectedRunId(latestResult.run_id);
      loadHistory();
    }
  }, [latestResult, loadHistory]);

  // Fetch real NS-3 mobility trace when selectedRunId changes
  useEffect(() => {
    if (!selectedRunId) {
      setTrace(null);
      setTraceLoading(false);
      setTraceError(null);
      return;
    }

    if (!isBackendAvailable) {
      setTrace(null);
      setTraceLoading(false);
      setTraceError(
        'FastAPI backend is disconnected. Cannot retrieve real NS-3 mobility trace. No mock coordinates are generated.'
      );
      return;
    }

    const currentReqId = ++requestIdRef.current;
    setTraceLoading(true);
    setTraceError(null);
    setIsPlaying(false);
    setCurrentTime(0.0);
    setSelectedNodeId(null);
    setHoveredNodeId(null);

    apiService
      .getSimulationMobility(selectedRunId)
      .then((data) => {
        if (currentReqId === requestIdRef.current) {
          setTrace(data);
          setTraceLoading(false);
          setTraceError(null);
        }
      })
      .catch((err: any) => {
        if (currentReqId === requestIdRef.current) {
          setTrace(null);
          setTraceLoading(false);
          setTraceError(err.message || 'Failed to fetch mobility trace.');
        }
      });

    // Fetch wireless link trace (Phase 4)
    setLinkLoading(true);
    setLinkError(null);
    setLinkTrace(null);

    apiService
      .getSimulationWirelessLinks(selectedRunId)
      .then((data) => {
        if (currentReqId === requestIdRef.current) {
          setLinkTrace(data);
          setLinkLoading(false);
          setLinkError(null);
        }
      })
      .catch((err: any) => {
        if (currentReqId === requestIdRef.current) {
          setLinkTrace(null);
          setLinkLoading(false);
          setLinkError(err.message || 'Wireless link trace not recorded for this historical run.');
        }
      });

    // Fetch multi-hop routing and data-forwarding trace (Phase 5)
    setRoutingLoading(true);
    setRoutingError(null);
    setRoutingTrace(null);
    setSelectedPacketUid(null);

    apiService
      .getSimulationRoutingTrace(selectedRunId)
      .then((data) => {
        if (currentReqId === requestIdRef.current) {
          setRoutingTrace(data);
          setRoutingLoading(false);
          setRoutingError(null);
        }
      })
      .catch((err: any) => {
        if (currentReqId === requestIdRef.current) {
          setRoutingTrace(null);
          setRoutingLoading(false);
          setRoutingError(err.message || 'Routing trace not recorded for this historical run.');
        }
      });
  }, [selectedRunId, isBackendAvailable]);

  // Responsive canvas resizing
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        const newWidth = Math.max(320, Math.floor(width));
        // Maintain an adaptive aspect ratio suitable for desktop/laptop/mobile
        const newHeight = Math.max(340, Math.min(520, Math.floor(newWidth * 0.56)));
        setCanvasDimensions({ width: newWidth, height: newHeight });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Playback animation loop
  useEffect(() => {
    if (!isPlaying || !trace) {
      lastFrameTimeRef.current = null;
      return;
    }

    const duration = trace.simulation_duration || 6.0;

    const tick = (now: number) => {
      if (lastFrameTimeRef.current === null) {
        lastFrameTimeRef.current = now;
      }
      const deltaSec = (now - lastFrameTimeRef.current) / 1000;
      lastFrameTimeRef.current = now;

      setCurrentTime((prev) => {
        const next = prev + deltaSec * playbackSpeed;
        if (next >= duration) {
          setIsPlaying(false);
          return duration;
        }
        return next;
      });

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, trace, playbackSpeed]);

  // Coordinate scaling helper
  const transform = useMemo(() => {
    const simArea = trace?.sim_area || 800;
    const { width, height } = canvasDimensions;
    const padding = 44; // margins for labels and boundary
    const availW = Math.max(50, width - padding * 2);
    const availH = Math.max(50, height - padding * 2);
    const scale = Math.min(availW / simArea, availH / simArea);

    const originX = (width - simArea * scale) / 2;
    // Standard Cartesian: Y=0 at bottom, Y=simArea at top
    const originY = height - (height - simArea * scale) / 2;

    const toCanvasX = (ns3X: number) => originX + ns3X * scale;
    const toCanvasY = (ns3Y: number) => originY - ns3Y * scale;

    const toNs3X = (canvasX: number) => (canvasX - originX) / scale;
    const toNs3Y = (canvasY: number) => (originY - canvasY) / scale;

    return { simArea, scale, originX, originY, toCanvasX, toCanvasY, toNs3X, toNs3Y };
  }, [trace, canvasDimensions]);

  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const { width, height } = canvasDimensions;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear background
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#0F172A'; // Slate-900 dark scientific background
    ctx.fillRect(0, 0, width, height);

    if (!trace || !trace.nodes || trace.nodes.length === 0) {
      return;
    }

    const { simArea, scale, originX, originY, toCanvasX, toCanvasY } = transform;
    const boxW = simArea * scale;
    const boxH = simArea * scale;
    const boxLeft = originX;
    const boxTop = originY - boxH;

    // 1. Simulation Area Grid & Axis
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(boxLeft, boxTop, boxW, boxH);

    // Grid lines every 100m or 200m depending on simArea
    const gridStep = simArea <= 500 ? 50 : simArea <= 1000 ? 100 : 200;
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.45)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);

    for (let m = 0; m <= simArea; m += gridStep) {
      const cx = toCanvasX(m);
      const cy = toCanvasY(m);

      // Vertical line
      ctx.beginPath();
      ctx.moveTo(cx, boxTop);
      ctx.lineTo(cx, boxTop + boxH);
      ctx.stroke();

      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(boxLeft, cy);
      ctx.lineTo(boxLeft + boxW, cy);
      ctx.stroke();

      // Labels on bottom & left axis
      ctx.fillStyle = '#64748B';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      if (m > 0 && m < simArea) {
        ctx.fillText(`${m}m`, cx, boxTop + boxH + 16);
        ctx.textAlign = 'right';
        ctx.fillText(`${m}m`, boxLeft - 8, cy + 3);
      }
    }
    ctx.setLineDash([]);

    // Outer Boundary Box
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(boxLeft, boxTop, boxW, boxH);

    // Coordinate Origin Label
    ctx.fillStyle = '#94A3B8';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('(0, 0)', boxLeft + 4, boxTop + boxH - 6);
    ctx.textAlign = 'right';
    ctx.fillText(`(${simArea}m, ${simArea}m)`, boxLeft + boxW - 4, boxTop + 14);

    const isEaodv = trace.protocol === 'eAODV';
    const primaryColor = isEaodv ? '#10B981' : '#3B82F6'; // Emerald for eAODV, Blue for AODV
    const glowColor = isEaodv ? 'rgba(16, 185, 129, 0.3)' : 'rgba(59, 130, 246, 0.3)';

    // 2. Trajectory Trails (from t = 0 to currentTime)
    if (showTrails) {
      trace.nodes.forEach((node) => {
        const isTargetNode = selectedNodeId === null || selectedNodeId === node.node_id;
        const trailAlpha = isTargetNode ? 0.35 : 0.08;
        ctx.strokeStyle = isEaodv
          ? `rgba(16, 185, 129, ${trailAlpha})`
          : `rgba(59, 130, 246, ${trailAlpha})`;
        ctx.lineWidth = isTargetNode && selectedNodeId === node.node_id ? 2 : 1;
        ctx.beginPath();

        let started = false;
        node.positions.forEach((p) => {
          if (p.time <= currentTime) {
            const cx = toCanvasX(p.x);
            const cy = toCanvasY(p.y);
            if (!started) {
              ctx.moveTo(cx, cy);
              started = true;
            } else {
              ctx.lineTo(cx, cy);
            }
          }
        });

        // Connect up to the exact interpolated current position
        const curPos = getInterpolatedPosition(node, currentTime);
        const curX = toCanvasX(curPos.x);
        const curY = toCanvasY(curPos.y);
        if (started) {
          ctx.lineTo(curX, curY);
          ctx.stroke();
        }
      });
    }

    // 3. Optional Wi-Fi Transmission Range (e.g. 250m)
    if (showRange || hoveredNodeId !== null || selectedNodeId !== null) {
      const activeRangeNodeId = hoveredNodeId ?? selectedNodeId;
      trace.nodes.forEach((node) => {
        if (activeRangeNodeId !== null && node.node_id !== activeRangeNodeId) return;
        const pos = getInterpolatedPosition(node, currentTime);
        const cx = toCanvasX(pos.x);
        const cy = toCanvasY(pos.y);
        const rangeRadiusPx = 250 * scale;

        ctx.strokeStyle = isEaodv ? 'rgba(16, 185, 129, 0.22)' : 'rgba(59, 130, 246, 0.22)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.arc(cx, cy, rangeRadiusPx, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      });
    }

    // 3. Genuine NS-3 Wireless Links & Physical Transmission Layer
    if (showWirelessLinks && linkTrace && linkTrace.events && linkTrace.events.length > 0) {
      const windowSec = 0.35;
      const activeEvents = getActiveLinkEvents(linkTrace.events, currentTime, windowSec);

      // Create quick node lookup map for O(1) position resolution
      const nodeMap = new Map<number, NodeMobility>();
      trace.nodes.forEach((n) => nodeMap.set(n.node_id, n));

      activeEvents.forEach((ev) => {
        const age = currentTime - ev.time;
        const progress = Math.min(1.0, Math.max(0.0, age / windowSec));
        const alpha = Math.max(0.05, 1.0 - progress);

        const isTx = ev.event_type === 'tx' || ev.event_type === 'transmission_attempt';
        const isRxOk = ev.event_type === 'rx_ok' || ev.event_type === 'successful_reception';
        const isRxDrop = ev.event_type === 'rx_drop' || ev.event_type === 'failed_reception';

        // Filter if node is selected
        const isRelevantToSelection =
          selectedNodeId === null ||
          ev.source_node_id === selectedNodeId ||
          ev.destination_node_id === selectedNodeId;

        const effectiveAlpha = isRelevantToSelection ? alpha : alpha * 0.15;

        // 1. Transmission Attempt: Expanding Wavefront Pulse
        if (isTx) {
          const srcNode = nodeMap.get(ev.source_node_id);
          if (srcNode) {
            const sPos = getInterpolatedPosition(srcNode, currentTime);
            const cx = toCanvasX(sPos.x);
            const cy = toCanvasY(sPos.y);
            const pulseRadius = 7 + progress * 50;

            ctx.save();
            ctx.strokeStyle = `rgba(56, 189, 248, ${effectiveAlpha * 0.8})`; // Sky blue
            ctx.lineWidth = Math.max(0.8, 2.0 * (1 - progress));
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.arc(cx, cy, pulseRadius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }
        }

        // 2. Successful Reception: Wireless Link Line + Traveling Particle + SNR Badge
        else if (isRxOk) {
          const srcNode = nodeMap.get(ev.source_node_id);
          const dstNode = nodeMap.get(ev.destination_node_id);
          if (srcNode && dstNode) {
            const sPos = getInterpolatedPosition(srcNode, currentTime);
            const dPos = getInterpolatedPosition(dstNode, currentTime);
            const sX = toCanvasX(sPos.x);
            const sY = toCanvasY(sPos.y);
            const dX = toCanvasX(dPos.x);
            const dY = toCanvasY(dPos.y);

            ctx.save();
            // Solid link line
            ctx.strokeStyle = `rgba(16, 185, 129, ${effectiveAlpha * 0.85})`; // Emerald green
            ctx.lineWidth = Math.max(1.2, 2.5 * (1 - progress));
            ctx.beginPath();
            ctx.moveTo(sX, sY);
            ctx.lineTo(dX, dY);
            ctx.stroke();

            // Packet moving particle
            const packetT = Math.min(1.0, age / (windowSec * 0.5));
            const pX = sX + (dX - sX) * packetT;
            const pY = sY + (dY - sY) * packetT;
            ctx.fillStyle = `rgba(52, 211, 153, ${effectiveAlpha})`;
            ctx.beginPath();
            ctx.arc(pX, pY, 3, 0, Math.PI * 2);
            ctx.fill();

            // SNR Badge at midpoint
            if (ev.snr_db !== undefined && ev.snr_db !== null && isRelevantToSelection) {
              const midX = (sX + dX) / 2;
              const midY = (sY + dY) / 2;
              const text = `${ev.snr_db.toFixed(1)} dB`;
              ctx.font = 'bold 8px monospace';
              const textWidth = ctx.measureText(text).width;
              const padX = 4;
              const badgeW = textWidth + padX * 2;
              const badgeH = 12;

              ctx.fillStyle = `rgba(15, 23, 42, ${effectiveAlpha * 0.9})`;
              ctx.fillRect(midX - badgeW / 2, midY - badgeH / 2, badgeW, badgeH);
              ctx.strokeStyle = `rgba(16, 185, 129, ${effectiveAlpha * 0.7})`;
              ctx.lineWidth = 0.8;
              ctx.strokeRect(midX - badgeW / 2, midY - badgeH / 2, badgeW, badgeH);

              ctx.fillStyle = `rgba(167, 243, 208, ${effectiveAlpha})`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(text, midX, midY);
            }
            ctx.restore();
          }
        }

        // 3. Failed Reception / Drop: Red Dashed Line + Drop Cross
        else if (isRxDrop && showDrops) {
          const srcNode = nodeMap.get(ev.source_node_id);
          const dstNode = nodeMap.get(ev.destination_node_id);
          if (srcNode && dstNode) {
            const sPos = getInterpolatedPosition(srcNode, currentTime);
            const dPos = getInterpolatedPosition(dstNode, currentTime);
            const sX = toCanvasX(sPos.x);
            const sY = toCanvasY(sPos.y);
            const dX = toCanvasX(dPos.x);
            const dY = toCanvasY(dPos.y);

            ctx.save();
            ctx.strokeStyle = `rgba(239, 68, 68, ${effectiveAlpha * 0.75})`; // Red
            ctx.lineWidth = 1.4;
            ctx.setLineDash([3, 4]);
            ctx.beginPath();
            ctx.moveTo(sX, sY);
            ctx.lineTo(dX, dY);
            ctx.stroke();
            ctx.setLineDash([]);

            // Red drop cross at receiving node
            const cs = 4;
            ctx.strokeStyle = `rgba(239, 68, 68, ${effectiveAlpha * 0.9})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(dX - cs, dY - cs);
            ctx.lineTo(dX + cs, dY + cs);
            ctx.moveTo(dX + cs, dY - cs);
            ctx.lineTo(dX - cs, dY + cs);
            ctx.stroke();
            ctx.restore();
          }
        }
      });
    }

    // 4. Genuine NS-3 Multi-Hop Routing & CBR Data Flow Paths (Phase 5)
    if (showRoutingPaths && routingTrace && routingTrace.events && routingTrace.events.length > 0) {
      const routeWindowSec = 0.55;
      const activeRouteEvents = getActiveRoutingEvents(routingTrace.events, currentTime, routeWindowSec);
      const nodeMap = new Map<number, NodeMobility>();
      trace.nodes.forEach((n) => nodeMap.set(n.node_id, n));

      // 4A. Render Control Waves (RREQ, RREP, RERR) if enabled
      if (showControlWaves) {
        activeRouteEvents.forEach((ev) => {
          const age = currentTime - ev.time;
          const progress = Math.min(1.0, Math.max(0.0, age / routeWindowSec));
          const alpha = Math.max(0.05, 1.0 - progress);

          // RREQ: Expanding broadcast route discovery ring
          if (ev.event_type === 'rreq_tx') {
            const srcNode = nodeMap.get(ev.node_id);
            if (srcNode) {
              const pos = getInterpolatedPosition(srcNode, currentTime);
              const cx = toCanvasX(pos.x);
              const cy = toCanvasY(pos.y);
              const rreqRadius = 10 + progress * 65;

              ctx.save();
              ctx.strokeStyle = `rgba(168, 85, 247, ${alpha * 0.85})`; // Purple / violet
              ctx.lineWidth = Math.max(0.9, 2.2 * (1 - progress));
              ctx.setLineDash([4, 4]);
              ctx.beginPath();
              ctx.arc(cx, cy, rreqRadius, 0, Math.PI * 2);
              ctx.stroke();

              ctx.fillStyle = `rgba(192, 132, 252, ${alpha})`;
              ctx.font = 'bold 8px monospace';
              ctx.textAlign = 'center';
              ctx.fillText(ev.details || 'RREQ', cx, cy - rreqRadius - 2);
              ctx.restore();
            }
          }
          // RREP: Golden acknowledgment pulse
          else if (ev.event_type === 'rrep_tx') {
            const repNode = nodeMap.get(ev.node_id);
            if (repNode) {
              const pos = getInterpolatedPosition(repNode, currentTime);
              const cx = toCanvasX(pos.x);
              const cy = toCanvasY(pos.y);
              const rrepRadius = 8 + progress * 35;

              ctx.save();
              ctx.strokeStyle = `rgba(234, 179, 8, ${alpha * 0.95})`; // Amber / Gold
              ctx.lineWidth = Math.max(1.2, 2.5 * (1 - progress));
              ctx.beginPath();
              ctx.arc(cx, cy, rrepRadius, 0, Math.PI * 2);
              ctx.stroke();

              ctx.fillStyle = `rgba(253, 224, 71, ${alpha})`;
              ctx.font = 'bold 8px monospace';
              ctx.textAlign = 'center';
              ctx.fillText('RREP', cx, cy - rrepRadius - 2);
              ctx.restore();
            }
          }
          // RERR: Crimson alert pulse
          else if (ev.event_type === 'rerr_tx') {
            const errNode = nodeMap.get(ev.node_id);
            if (errNode) {
              const pos = getInterpolatedPosition(errNode, currentTime);
              const cx = toCanvasX(pos.x);
              const cy = toCanvasY(pos.y);

              ctx.save();
              ctx.strokeStyle = `rgba(239, 68, 68, ${alpha})`;
              ctx.lineWidth = 1.8;
              ctx.beginPath();
              ctx.arc(cx, cy, 12 + progress * 25, 0, Math.PI * 2);
              ctx.stroke();

              ctx.fillStyle = `rgba(248, 113, 113, ${alpha})`;
              ctx.font = 'bold 8px monospace';
              ctx.textAlign = 'center';
              ctx.fillText('RERR', cx, cy - 16);
              ctx.restore();
            }
          }
        });
      }

      // 4B. Render Consecutive Hop CBR Data Forwarding Paths
      activeRouteEvents.forEach((ev) => {
        const age = currentTime - ev.time;
        const progress = Math.min(1.0, Math.max(0.0, age / routeWindowSec));
        const alpha = Math.max(0.1, 1.0 - progress);

        const isSelectedPacket = selectedPacketUid !== null && ev.packet_uid === selectedPacketUid;
        const effectiveAlpha = selectedPacketUid !== null ? (isSelectedPacket ? 1.0 : alpha * 0.2) : alpha;

        // Data Forwarding Hop: Verified directed connection prev_hop -> node_id
        if (
          (ev.event_type === 'data_forward' || ev.event_type === 'data_delivered') &&
          ev.prev_hop !== null &&
          ev.prev_hop !== undefined &&
          ev.prev_hop >= 0 &&
          ev.prev_hop !== ev.node_id
        ) {
          const prevNode = nodeMap.get(ev.prev_hop);
          const currNode = nodeMap.get(ev.node_id);
          if (prevNode && currNode) {
            const pPos = getInterpolatedPosition(prevNode, currentTime);
            const cPos = getInterpolatedPosition(currNode, currentTime);
            const px = toCanvasX(pPos.x);
            const py = toCanvasY(pPos.y);
            const cx = toCanvasX(cPos.x);
            const cy = toCanvasY(cPos.y);

            ctx.save();
            const lineColor = isSelectedPacket
              ? `rgba(245, 158, 11, ${effectiveAlpha})` // Bold Gold
              : ev.event_type === 'data_delivered'
              ? `rgba(16, 185, 129, ${effectiveAlpha})` // Emerald
              : `rgba(6, 182, 212, ${effectiveAlpha})`; // Cyan

            ctx.strokeStyle = lineColor;
            ctx.lineWidth = isSelectedPacket ? 3.5 : 2.4;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(cx, cy);
            ctx.stroke();

            // Arrow Head pointing directly to currNode
            const angle = Math.atan2(cy - py, cx - px);
            const arrowLength = 9;
            const arrowOffset = 8;
            const tipX = cx - Math.cos(angle) * arrowOffset;
            const tipY = cy - Math.sin(angle) * arrowOffset;

            ctx.fillStyle = lineColor;
            ctx.beginPath();
            ctx.moveTo(tipX, tipY);
            ctx.lineTo(
              tipX - arrowLength * Math.cos(angle - Math.PI / 6),
              tipY - arrowLength * Math.sin(angle - Math.PI / 6)
            );
            ctx.lineTo(
              tipX - arrowLength * Math.cos(angle + Math.PI / 6),
              tipY - arrowLength * Math.sin(angle + Math.PI / 6)
            );
            ctx.closePath();
            ctx.fill();

            // Animated packet pulse
            const packetT = Math.min(1.0, age / (routeWindowSec * 0.65));
            const pulseX = px + (cx - px) * packetT;
            const pulseY = py + (cy - py) * packetT;

            ctx.fillStyle = isSelectedPacket ? '#F59E0B' : '#38BDF8';
            ctx.beginPath();
            ctx.arc(pulseX, pulseY, isSelectedPacket ? 4.5 : 3.5, 0, Math.PI * 2);
            ctx.fill();

            // Hop & Packet UID Badge at midpoint
            const midX = (px + cx) / 2;
            const midY = (py + cy) / 2;
            const badgeText = `P#${ev.packet_uid} (TTL=${ev.ttl})`;
            ctx.font = 'bold 8px monospace';
            const textW = ctx.measureText(badgeText).width;
            ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
            ctx.fillRect(midX - textW / 2 - 3, midY - 6, textW + 6, 12);
            ctx.strokeStyle = lineColor;
            ctx.lineWidth = 0.8;
            ctx.strokeRect(midX - textW / 2 - 3, midY - 6, textW + 6, 12);

            ctx.fillStyle = isSelectedPacket ? '#FDE047' : '#E0F2FE';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(badgeText, midX, midY);

            ctx.restore();
          }
        }
        // Data Drop
        else if (ev.event_type === 'data_drop') {
          const dropNode = nodeMap.get(ev.node_id);
          if (dropNode) {
            const dPos = getInterpolatedPosition(dropNode, currentTime);
            const dx = toCanvasX(dPos.x);
            const dy = toCanvasY(dPos.y);

            ctx.save();
            ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`;
            ctx.font = 'bold 8px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`DROP (${ev.details || 'EXPIRED'})`, dx, dy + 18);
            ctx.restore();
          }
        }
      });

      // 4C. Persistent Full Path Overlay for Selected Packet
      if (selectedPacketUid !== null) {
        const packetEvents = routingTrace.events
          .filter((e) => e.packet_uid === selectedPacketUid && e.event_type.startsWith('data_'))
          .sort((a, b) => a.time - b.time);

        if (packetEvents.length > 0) {
          ctx.save();
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.85)';
          ctx.lineWidth = 3;
          ctx.setLineDash([5, 4]);

          packetEvents.forEach((pev) => {
            if (pev.prev_hop !== null && pev.prev_hop !== undefined && pev.prev_hop >= 0) {
              const pN = nodeMap.get(pev.prev_hop);
              const cN = nodeMap.get(pev.node_id);
              if (pN && cN) {
                const pPos = getInterpolatedPosition(pN, currentTime);
                const cPos = getInterpolatedPosition(cN, currentTime);
                ctx.beginPath();
                ctx.moveTo(toCanvasX(pPos.x), toCanvasY(pPos.y));
                ctx.lineTo(toCanvasX(cPos.x), toCanvasY(cPos.y));
                ctx.stroke();
              }
            }
          });
          ctx.restore();
        }
      }
    }

    // Active routing roles in the current window
    const activeRouteRoles = new Map<number, 'SRC' | 'FWD' | 'DST'>();
    if (showRoutingPaths && routingTrace && routingTrace.events) {
      const activeEvs = getActiveRoutingEvents(routingTrace.events, currentTime, 0.45);
      activeEvs.forEach((ev) => {
        if (ev.event_type === 'data_send') {
          activeRouteRoles.set(ev.node_id, 'SRC');
        } else if (ev.event_type === 'data_delivered') {
          activeRouteRoles.set(ev.node_id, 'DST');
        } else if (ev.event_type === 'data_forward' && ev.prev_hop !== ev.node_id && !activeRouteRoles.has(ev.node_id)) {
          activeRouteRoles.set(ev.node_id, 'FWD');
        }
      });
    }

    // 5. Render Nodes
    trace.nodes.forEach((node) => {
      const pos = getInterpolatedPosition(node, currentTime);
      const cx = toCanvasX(pos.x);
      const cy = toCanvasY(pos.y);

      const isSelected = selectedNodeId === node.node_id;
      const isHovered = hoveredNodeId === node.node_id;
      const radius = isSelected ? 8.5 : isHovered ? 7.5 : 6;

      // Glow halo
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 2.8);
      glow.addColorStop(0, isSelected ? 'rgba(245, 158, 11, 0.5)' : glowColor);
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 2.8, 0, Math.PI * 2);
      ctx.fill();

      // Node Body
      ctx.fillStyle = isSelected ? '#F59E0B' : primaryColor;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      // Border ring
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = isSelected ? 2 : 1.2;
      ctx.stroke();

      // Active Routing Role Ring & Badge
      const role = activeRouteRoles.get(node.node_id);
      if (role) {
        ctx.save();
        ctx.strokeStyle = role === 'SRC' ? '#22C55E' : role === 'DST' ? '#A855F7' : '#06B6D4';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(cx, cy, radius + 4, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = role === 'SRC' ? '#15803D' : role === 'DST' ? '#7E22CE' : '#0E7490';
        ctx.fillRect(cx - 11, cy + radius + 3, 22, 10);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 7px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(role, cx, cy + radius + 8);
        ctx.restore();
      }

      // Node Label
      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 9px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${node.node_id}`, cx, cy - radius - 5);
    });

    // 6. Watermark indicator confirming genuine NS-3 provenance
    ctx.fillStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('NS-3.41 CourseChangeTrace [Mobility] · NS-3 PHY Links · NS-3 Multi-Hop Routing [Ipv4L3Protocol]', boxLeft + boxW - 8, boxTop + boxH - 8);
  }, [
    trace,
    linkTrace,
    routingTrace,
    currentTime,
    transform,
    canvasDimensions,
    showTrails,
    showRange,
    showWirelessLinks,
    showDrops,
    showRoutingPaths,
    showControlWaves,
    selectedPacketUid,
    selectedNodeId,
    hoveredNodeId,
  ]);

  // Handle canvas mouse interaction (click and hover)
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!trace || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    let foundId: number | null = null;
    for (const node of trace.nodes) {
      const pos = getInterpolatedPosition(node, currentTime);
      const cx = transform.toCanvasX(pos.x);
      const cy = transform.toCanvasY(pos.y);
      const dist = Math.hypot(mouseX - cx, mouseY - cy);
      if (dist <= 14) {
        foundId = node.node_id;
        break;
      }
    }
    setHoveredNodeId(foundId);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!trace || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    let foundId: number | null = null;
    for (const node of trace.nodes) {
      const pos = getInterpolatedPosition(node, currentTime);
      const cx = transform.toCanvasX(pos.x);
      const cy = transform.toCanvasY(pos.y);
      const dist = Math.hypot(mouseX - cx, mouseY - cy);
      if (dist <= 14) {
        foundId = node.node_id;
        break;
      }
    }
    setSelectedNodeId((prev) => (prev === foundId ? null : foundId));
  };

  // Playback control helpers
  const handlePlayPause = () => {
    if (!trace) return;
    if (currentTime >= trace.simulation_duration) {
      setCurrentTime(0.0);
    }
    setIsPlaying((prev) => !prev);
  };

  const handleRestart = () => {
    setIsPlaying(false);
    setCurrentTime(0.0);
  };

  const handleStep = (stepDelta: number) => {
    if (!trace) return;
    setIsPlaying(false);
    const duration = trace.simulation_duration || 6.0;
    setCurrentTime((prev) => Math.max(0.0, Math.min(duration, +(prev + stepDelta).toFixed(2))));
  };

  // Selected node telemetry details
  const selectedNodeInfo = useMemo(() => {
    if (!trace || selectedNodeId === null) return null;
    const node = trace.nodes.find((n) => n.node_id === selectedNodeId);
    if (!node) return null;
    const cur = getInterpolatedPosition(node, currentTime);
    const initial = node.positions[0] || cur;
    const final = node.positions[node.positions.length - 1] || cur;

    // Total trajectory path length
    let totalDist = 0;
    for (let i = 0; i < node.positions.length - 1; i++) {
      totalDist += Math.hypot(
        node.positions[i + 1].x - node.positions[i].x,
        node.positions[i + 1].y - node.positions[i].y
      );
    }

    // Wireless link stats for selected node
    let txCount = 0;
    let rxCount = 0;
    let dropCount = 0;
    let snrSum = 0;
    let snrPoints = 0;

    if (linkTrace && linkTrace.events) {
      linkTrace.events.forEach((ev) => {
        const isTx = ev.event_type === 'tx' || ev.event_type === 'transmission_attempt';
        const isRxOk = ev.event_type === 'rx_ok' || ev.event_type === 'successful_reception';
        const isRxDrop = ev.event_type === 'rx_drop' || ev.event_type === 'failed_reception';

        if (ev.source_node_id === node.node_id && isTx) {
          txCount++;
        }
        if (ev.destination_node_id === node.node_id) {
          if (isRxOk) {
            rxCount++;
            if (ev.snr_db !== undefined && ev.snr_db !== null) {
              snrSum += ev.snr_db;
              snrPoints++;
            }
          } else if (isRxDrop) {
            dropCount++;
          }
        }
      });
    }

    // Routing and forwarding stats for selected node
    let dataSendCount = 0;
    let dataFwdCount = 0;
    let dataDelivCount = 0;
    let routeControlCount = 0;

    if (routingTrace && routingTrace.events) {
      routingTrace.events.forEach((ev) => {
        if (ev.node_id === node.node_id) {
          if (ev.event_type === 'data_send') dataSendCount++;
          else if (ev.event_type === 'data_forward' && ev.prev_hop !== ev.node_id) dataFwdCount++;
          else if (ev.event_type === 'data_delivered') dataDelivCount++;
          else if (!ev.event_type.startsWith('data_')) routeControlCount++;
        }
      });
    }

    const avgNodeSnr = snrPoints > 0 ? (snrSum / snrPoints).toFixed(1) : null;

    return {
      nodeId: node.node_id,
      curX: cur.x.toFixed(2),
      curY: cur.y.toFixed(2),
      curZ: cur.z.toFixed(2),
      initX: initial.x.toFixed(2),
      initY: initial.y.toFixed(2),
      finalX: final.x.toFixed(2),
      finalY: final.y.toFixed(2),
      totalDistanceM: totalDist.toFixed(1),
      samplesCount: node.positions.length,
      txCount,
      rxCount,
      dropCount,
      avgNodeSnr,
      dataSendCount,
      dataFwdCount,
      dataDelivCount,
      routeControlCount,
    };
  }, [trace, linkTrace, routingTrace, selectedNodeId, currentTime]);

  // Extract unique CBR data packets from genuine NS-3 routing trace for inspection (Phase 5)
  const cbrPackets = useMemo(() => {
    if (!routingTrace || !routingTrace.events) return [];
    const map = new Map<
      number,
      {
        packetUid: number;
        sourceIp: string;
        destIp: string;
        sendTime: number;
        deliveredTime?: number;
        hops: RoutingHopEvent[];
        isDelivered: boolean;
        isDropped: boolean;
        dropReason?: string;
      }
    >();

    routingTrace.events.forEach((ev) => {
      if (!ev.event_type.startsWith('data_')) return;
      if (!map.has(ev.packet_uid)) {
        map.set(ev.packet_uid, {
          packetUid: ev.packet_uid,
          sourceIp: ev.source_ip,
          destIp: ev.dest_ip,
          sendTime: ev.time,
          hops: [],
          isDelivered: false,
          isDropped: false,
        });
      }
      const record = map.get(ev.packet_uid)!;
      // C1: Exclude local queue re-injection and self-forwards from physical journey hops
      if (ev.event_type !== 'data_reinject' && !(ev.event_type === 'data_forward' && ev.prev_hop === ev.node_id)) {
        record.hops.push(ev);
      }
      if (ev.event_type === 'data_delivered') {
        record.isDelivered = true;
        record.deliveredTime = ev.time;
      } else if (ev.event_type === 'data_drop') {
        record.isDropped = true;
        record.dropReason = ev.details;
      }
    });

    return Array.from(map.values()).sort((a, b) => a.sendTime - b.sendTime);
  }, [routingTrace]);

  // Determine currently inspected packet
  const inspectedPacket = useMemo(() => {
    if (!cbrPackets || cbrPackets.length === 0) return null;
    if (selectedPacketUid !== null) {
      return cbrPackets.find((p) => p.packetUid === selectedPacketUid) || cbrPackets[0];
    }
    // Pick the packet currently active / closest to current simulation playback time
    let closest = cbrPackets[0];
    let minDiff = Infinity;
    for (const p of cbrPackets) {
      const diff = Math.abs(currentTime - p.sendTime);
      if (diff < minDiff) {
        minDiff = diff;
        closest = p;
      }
    }
    return closest;
  }, [cbrPackets, selectedPacketUid, currentTime]);

  // AODV vs eAODV Protocol Efficiency Overview Stats
  const routingComparisonStats = useMemo(() => {
    if (!routingTrace || !routingTrace.events) return null;
    let rreqCount = 0;
    let rrepCount = 0;
    let rerrCount = 0;
    let fwdCount = 0;
    let deliveredCount = 0;
    let droppedCount = 0;
    let totalHopsObserved = 0;
    let hopSamples = 0;

    routingTrace.events.forEach((ev) => {
      if (ev.event_type === 'rreq_tx') rreqCount++;
      else if (ev.event_type === 'rrep_tx') rrepCount++;
      else if (ev.event_type === 'rerr_tx') rerrCount++;
      else if (ev.event_type === 'data_forward' && ev.prev_hop !== ev.node_id) fwdCount++;
      else if (ev.event_type === 'data_delivered') deliveredCount++;
      else if (ev.event_type === 'data_drop') droppedCount++;
    });

    cbrPackets.forEach((p) => {
      // Hops = genuine forward events (prev_hop != node_id) + deliver event
      const fwdAndDeliv = p.hops.filter(
        (h) => (h.event_type === 'data_forward' && h.prev_hop !== h.node_id) || h.event_type === 'data_delivered'
      );
      if (fwdAndDeliv.length > 0) {
        totalHopsObserved += fwdAndDeliv.length;
        hopSamples++;
      }
    });

    const avgHops = hopSamples > 0 ? (totalHopsObserved / hopSamples).toFixed(2) : '1.00';

    return {
      protocol: routingTrace.protocol,
      rreqCount,
      rrepCount,
      rerrCount,
      fwdCount,
      deliveredCount,
      droppedCount,
      avgHops,
      totalPackets: cbrPackets.length,
    };
  }, [routingTrace, cbrPackets]);

  return (
    <section id="topology" className="w-full max-w-full px-6 sm:px-10 py-8 border-b border-slate-100">
      {/* Section Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 w-full">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#13141F] tracking-tight">
              Network Topology Visualizer
            </h2>
            <span className="inline-flex items-center text-[11px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
              Real NS-3 Mobility
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Genuine NS-3.41 simulation node trajectories sampled at 0.5s intervals <br/>from FlowMonitor/CourseChange traces. Coordinates reflect exact physical mobility.
          </p>
        </div>

        {/* Target Run Quick Selectors & Dropdown */}
        <div className="flex flex-col items-end gap-2.5 shrink-0">
          {/* Row 1: Quick Reference Buttons */}
          <div className="flex flex-wrap items-center justify-end gap-2.5">
            {/* Quick Target Run Selector: AODV */}
            <button
              onClick={() => {
                setSelectedRunId(TARGET_AODV_RUN);
                if (onSelectRun) onSelectRun(TARGET_AODV_RUN);
              }}
              className={`h-[38px] px-4 rounded-full text-xs font-bold transition-all border inline-flex items-center gap-2 shrink-0 ${
                selectedRunId === TARGET_AODV_RUN
                  ? 'bg-[#13141F] text-white border-[#13141F] shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
              title="Load verified AODV run (10 nodes, 800m, 6s)"
            >
              <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0"></span>
              <span className="whitespace-nowrap">AODV Reference</span>
            </button>

            {/* Quick Target Run Selector: eAODV */}
            <button
              onClick={() => {
                setSelectedRunId(TARGET_EAODV_RUN);
                if (onSelectRun) onSelectRun(TARGET_EAODV_RUN);
              }}
              className={`h-[38px] px-4 rounded-full text-xs font-bold transition-all border inline-flex items-center gap-2 shrink-0 ${
                selectedRunId === TARGET_EAODV_RUN
                  ? 'bg-[#635BFF] text-white border-[#635BFF] shadow-md shadow-indigo-500/25'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
              title="Load verified eAODV run (10 nodes, 800m, 6s)"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
              <span className="whitespace-nowrap">eAODV Reference</span>
            </button>
          </div>

          {/* Row 2: Scenario Dropdown & Refresh Button */}
          <div className="relative inline-flex items-center justify-end shrink-0">
            <select
              value={selectedRunId}
              onChange={(e) => {
                setSelectedRunId(e.target.value);
                if (onSelectRun) onSelectRun(e.target.value);
              }}
              className="h-[38px] bg-white border border-slate-200/90 text-slate-800 text-xs font-bold rounded-full px-4 pr-8 focus:outline-none focus:ring-2 focus:ring-[#635BFF] shadow-sm cursor-pointer inline-flex items-center max-w-[260px] truncate"
            >
              {selectedRunId && !historyRuns.some((r) => r.run_id === selectedRunId) && (
                <option value={selectedRunId}>
                  Run #{selectedRunId.slice(0, 16)}...
                </option>
              )}
              {historyRuns.map((r) => (
                <option key={r.run_id} value={r.run_id}>
                  {r.protocol} · {r.node_count}N / {r.mobility_speed}m/s · #{r.run_id.slice(-8)}
                </option>
              ))}
            </select>
            <button
              onClick={loadHistory}
              disabled={historyLoading}
              className="ml-1.5 h-[38px] w-[38px] inline-flex items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:text-slate-900 transition-colors shadow-sm shrink-0"
              title="Refresh run list"
            >
              <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${historyLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Card Container */}
      <div className="bg-white rounded-[28px] p-6 border border-slate-200/90 shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col gap-5 w-full">
        {/* Run Metadata Strip - FINNOVA Dark Container */}
        {trace && (
          <div className="flex flex-col gap-2.5 px-5 py-3.5 rounded-[22px] bg-[#13141F] text-white text-xs border border-slate-800 shadow-md w-full">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <div className="inline-flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      trace.protocol === 'eAODV' ? 'bg-[#635BFF] animate-pulse' : 'bg-blue-400 animate-pulse'
                    }`}
                  ></span>
                  <span className="font-extrabold tracking-wide uppercase text-white whitespace-nowrap">
                    {trace.protocol} Protocol
                  </span>
                </div>

                <div className="inline-flex items-center gap-1.5 text-slate-300 font-mono text-[11px]">
                  <span className="text-slate-500 whitespace-nowrap">Run ID:</span>
                  <span className="text-slate-200 font-bold whitespace-nowrap">{trace.run_id}</span>
                </div>

                <div className="inline-flex items-center gap-1.5 text-slate-300">
                  <span className="text-slate-500 whitespace-nowrap">Nodes:</span>
                  <span className="font-bold text-white whitespace-nowrap">{trace.node_count} nodes</span>
                </div>

                <div className="inline-flex items-center gap-1.5 text-slate-300">
                  <span className="text-slate-500 whitespace-nowrap">Area:</span>
                  <span className="font-bold text-white whitespace-nowrap">{trace.sim_area || 800}m × {trace.sim_area || 800}m</span>
                </div>

                <div className="inline-flex items-center gap-1.5 text-slate-300">
                  <span className="text-slate-500 whitespace-nowrap">Samples:</span>
                  <span className="font-bold text-white whitespace-nowrap">{trace.total_position_records} records</span>
                </div>
              </div>

              <div className="inline-flex items-center gap-2 text-[11px] text-emerald-400 font-mono shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="whitespace-nowrap">NS-3 Mobility Verified</span>
              </div>
            </div>

            {/* Wireless Links Strip (Phase 4) */}
            {linkTrace && (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-800 text-[11px] font-mono">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-slate-300">
                  <div className="inline-flex items-center gap-1.5">
                    <Wifi className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="text-slate-400 whitespace-nowrap">Total PHY Events:</span>
                    <span className="text-white font-bold whitespace-nowrap">{linkTrace.total_events}</span>
                  </div>
                  <div className="inline-flex items-center gap-1.5">
                    <span className="text-slate-400 whitespace-nowrap">Tx Attempts:</span>
                    <span className="text-sky-400 font-bold whitespace-nowrap">{linkTrace.total_tx_attempts}</span>
                  </div>
                  <div className="inline-flex items-center gap-1.5">
                    <span className="text-slate-400 whitespace-nowrap">Rx Success (Ok):</span>
                    <span className="text-emerald-400 font-bold whitespace-nowrap">{linkTrace.total_rx_success}</span>
                  </div>
                  <div className="inline-flex items-center gap-1.5">
                    <span className="text-slate-400 whitespace-nowrap">Rx Drops:</span>
                    <span className="text-rose-400 font-bold whitespace-nowrap">{linkTrace.total_rx_drop}</span>
                  </div>
                </div>

                <div className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold text-[10px] shrink-0">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span className="whitespace-nowrap">NS-3 Wi-Fi PHY Links Active</span>
                </div>
              </div>
            )}

            {/* Routing & Forwarding Strip (Phase 5) */}
            {routingTrace && (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-800 text-[11px] font-mono">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-slate-300">
                  <div className="inline-flex items-center gap-1.5">
                    <Route className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="text-slate-400 whitespace-nowrap">Multi-Hop Routing Events:</span>
                    <span className="text-white font-bold whitespace-nowrap">{routingTrace.total_events}</span>
                  </div>
                  <div className="inline-flex items-center gap-1.5">
                    <span className="text-slate-400 whitespace-nowrap">Data Hops (CBR):</span>
                    <span className="text-cyan-400 font-bold whitespace-nowrap">{routingTrace.total_data_events}</span>
                  </div>
                  <div className="inline-flex items-center gap-1.5">
                    <span className="text-slate-400 whitespace-nowrap">Routing Control (AODV):</span>
                    <span className="text-[#7B61FF] font-bold whitespace-nowrap">{routingTrace.total_routing_events}</span>
                  </div>
                  <div className="inline-flex items-center gap-1.5">
                    <span className="text-slate-400 whitespace-nowrap">CBR Packets Tracked:</span>
                    <span className="text-amber-400 font-bold whitespace-nowrap">{cbrPackets.length}</span>
                  </div>
                </div>

                <div className="inline-flex items-center gap-1.5 text-cyan-400 font-semibold text-[10px] shrink-0">
                  <CheckCircle2 className="w-3 h-3 text-cyan-400 shrink-0" />
                  <span className="whitespace-nowrap">NS-3 Multi-Hop Routing Active</span>
                </div>
              </div>
            )}

            {!linkTrace && !linkLoading && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-1.5 border-t border-slate-800 text-[11px] text-slate-400">
                <span>Wireless PHY links not recorded for this historical run (pre-Phase 4).</span>
                <span className="text-slate-500 text-[10px] shrink-0">Execute a new simulation to capture NS-3 PHY links</span>
              </div>
            )}

            {!routingTrace && !routingLoading && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-1.5 border-t border-slate-800 text-[11px] text-slate-400">
                <span>Multi-hop routing trace not recorded for this historical run (pre-Phase 5).</span>
                <span className="text-slate-500 text-[10px] shrink-0">Execute a new simulation to capture NS-3 routing traces</span>
              </div>
            )}
          </div>
        )}

        {/* Canvas Area Container */}
        <div ref={containerRef} className="relative w-full rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 shadow-inner flex items-center justify-center">
          {traceLoading && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900/85 backdrop-blur-sm text-white gap-3">
              <RefreshCw className="w-7 h-7 text-primary animate-spin" />
              <span className="text-xs font-semibold">Loading NS-3 mobility trace for #{selectedRunId}...</span>
            </div>
          )}

          {traceError && (
            <div className="p-8 sm:p-12 text-center flex flex-col items-center justify-center text-slate-300 gap-3 min-h-[340px]">
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-bold text-white">Mobility Trace Unavailable</h3>
              <p className="text-xs text-slate-400 max-w-md leading-relaxed">{traceError}</p>
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={() => setSelectedRunId(TARGET_AODV_RUN)}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors"
                >
                  Load AODV Trace
                </button>
                <button
                  onClick={() => setSelectedRunId(TARGET_EAODV_RUN)}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
                >
                  Load eAODV Trace
                </button>
              </div>
            </div>
          )}

          {!traceLoading && !traceError && (
            <canvas
              ref={canvasRef}
              style={{ width: `${canvasDimensions.width}px`, height: `${canvasDimensions.height}px` }}
              onMouseMove={handleCanvasMouseMove}
              onMouseLeave={() => setHoveredNodeId(null)}
              onClick={handleCanvasClick}
              className="block cursor-crosshair max-w-full"
            />
          )}

          {/* Selected Node Telemetry Floating Overlay */}
          {selectedNodeInfo && (
            <div className="absolute top-3 right-3 z-10 p-3 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700 text-white text-xs shadow-xl min-w-[210px] max-w-[calc(100%-24px)] space-y-1.5">
              <div className="flex items-center justify-between pb-1 border-b border-slate-800 gap-2">
                <span className="font-extrabold text-amber-400 inline-flex items-center gap-1 truncate">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span>Node #{selectedNodeInfo.nodeId} Telemetry</span>
                </span>
                <button
                  onClick={() => setSelectedNodeId(null)}
                  className="h-5 w-5 inline-flex items-center justify-center rounded text-slate-400 hover:text-white text-xs transition-colors shrink-0"
                  title="Close node telemetry"
                >
                  ✕
                </button>
              </div>
              <div className="font-mono text-[11px] space-y-0.5">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-400 whitespace-nowrap">Position (X, Y):</span>
                  <span className="font-bold text-white whitespace-nowrap">({selectedNodeInfo.curX}m, {selectedNodeInfo.curY}m)</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-400 whitespace-nowrap">Initial (t=0s):</span>
                  <span className="text-slate-300 whitespace-nowrap">({selectedNodeInfo.initX}m, {selectedNodeInfo.initY}m)</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-400 whitespace-nowrap">Final:</span>
                  <span className="text-slate-300 whitespace-nowrap">({selectedNodeInfo.finalX}m, {selectedNodeInfo.finalY}m)</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-400 whitespace-nowrap">Trajectory Path:</span>
                  <span className="text-emerald-400 font-bold whitespace-nowrap">{selectedNodeInfo.totalDistanceM} m</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-400 whitespace-nowrap">Recorded Samples:</span>
                  <span className="text-slate-300 whitespace-nowrap">{selectedNodeInfo.samplesCount}</span>
                </div>
                {linkTrace && (
                  <>
                    <div className="pt-1 mt-1 border-t border-slate-800 font-bold text-sky-400 inline-flex items-center gap-1 w-full">
                      <Wifi className="w-3 h-3 shrink-0" />
                      <span>Wireless PHY Telemetry</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-400 whitespace-nowrap">Tx Transmissions:</span>
                      <span className="text-sky-400 font-bold whitespace-nowrap">{selectedNodeInfo.txCount}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-400 whitespace-nowrap">Rx Success (Ok):</span>
                      <span className="text-emerald-400 font-bold whitespace-nowrap">{selectedNodeInfo.rxCount}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-400 whitespace-nowrap">Rx Drops (Error):</span>
                      <span className="text-rose-400 font-bold whitespace-nowrap">{selectedNodeInfo.dropCount}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-400 whitespace-nowrap">Average SNR:</span>
                      <span className="text-white font-bold whitespace-nowrap">
                        {selectedNodeInfo.avgNodeSnr !== null ? `${selectedNodeInfo.avgNodeSnr} dB` : 'N/A'}
                      </span>
                    </div>
                  </>
                )}
                {routingTrace && (
                  <>
                    <div className="pt-1 mt-1 border-t border-slate-800 font-bold text-cyan-400 inline-flex items-center gap-1 w-full">
                      <Route className="w-3 h-3 shrink-0" />
                      <span>Multi-Hop Routing Telemetry</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-400 whitespace-nowrap">CBR Originated (SRC):</span>
                      <span className="text-emerald-400 font-bold whitespace-nowrap">{selectedNodeInfo.dataSendCount}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-400 whitespace-nowrap">CBR Forwarded (FWD):</span>
                      <span className="text-cyan-400 font-bold whitespace-nowrap">{selectedNodeInfo.dataFwdCount}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-400 whitespace-nowrap">CBR Delivered (DST):</span>
                      <span className="text-purple-400 font-bold whitespace-nowrap">{selectedNodeInfo.dataDelivCount}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-400 whitespace-nowrap">Routing Control (AODV):</span>
                      <span className="text-amber-400 font-bold whitespace-nowrap">{selectedNodeInfo.routeControlCount}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Playback & Inspection Controls Toolbar */}
        {trace && (
          <div className="flex flex-col gap-4 pt-2 w-full">
            {/* Timeline Scrubber Row */}
            <div className="flex items-center gap-3 w-full">
              <span className="text-xs font-mono font-bold text-slate-800 min-w-[50px] text-right shrink-0">
                {currentTime.toFixed(2)}s
              </span>

              <div className="relative flex-1 flex items-center">
                <input
                  type="range"
                  min="0"
                  max={trace.simulation_duration || 6.0}
                  step="0.05"
                  value={currentTime}
                  onChange={(e) => {
                    setIsPlaying(false);
                    setCurrentTime(parseFloat(e.target.value));
                  }}
                  className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-[#635BFF] focus:outline-none"
                />
              </div>

              <span className="text-xs font-mono text-slate-400 min-w-[50px] text-left shrink-0">
                {(trace.simulation_duration || 6.0).toFixed(2)}s
              </span>
            </div>

            {/* Buttons Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 w-full">
              {/* Play / Pause / Restart / Step Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleRestart}
                  className="h-[38px] w-[38px] inline-flex items-center justify-center rounded-full border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors shadow-sm shrink-0"
                  title="Restart playback to t=0s"
                >
                  <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                </button>

                <button
                  onClick={() => handleStep(-0.5)}
                  className="h-[38px] w-[38px] inline-flex items-center justify-center rounded-full border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors shadow-sm shrink-0"
                  title="Step backward 0.5s"
                >
                  <SkipBack className="w-3.5 h-3.5 shrink-0" />
                </button>

                <button
                  onClick={handlePlayPause}
                  className={`h-[38px] px-5 rounded-full font-bold text-xs inline-flex items-center justify-center gap-2 shadow-lg transition-all shrink-0 ${
                    isPlaying
                      ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-500/25'
                      : 'bg-[#635BFF] hover:bg-[#5349EE] text-white shadow-indigo-500/25'
                  }`}
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5 fill-current shrink-0" />
                      <span className="whitespace-nowrap">Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current shrink-0" />
                      <span className="whitespace-nowrap">{currentTime >= (trace.simulation_duration || 6.0) ? 'Replay' : 'Play'}</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleStep(0.5)}
                  className="h-[38px] w-[38px] inline-flex items-center justify-center rounded-full border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors shadow-sm shrink-0"
                  title="Step forward 0.5s"
                >
                  <SkipForward className="w-3.5 h-3.5 shrink-0" />
                </button>
              </div>

              {/* Playback Speed Multipliers */}
              <div className="h-[38px] inline-flex items-center gap-1 bg-slate-100 p-1 rounded-full border border-slate-200/80 text-xs shrink-0">
                <span className="text-[10px] font-bold text-slate-400 px-2 uppercase tracking-wider shrink-0">Speed</span>
                {[0.5, 1.0, 2.0, 4.0].map((spd) => (
                  <button
                    key={spd}
                    onClick={() => setPlaybackSpeed(spd)}
                    className={`h-[28px] px-3 rounded-full font-bold inline-flex items-center justify-center transition-all shrink-0 ${
                      playbackSpeed === spd
                        ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>

              {/* Visualization Layer Toggles - FINNOVA Rounded Pills */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setShowWirelessLinks((prev) => !prev)}
                  className={`h-[34px] px-3.5 rounded-full text-xs font-bold border transition-all inline-flex items-center gap-1.5 shrink-0 ${
                    showWirelessLinks
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                  title="Toggle genuine NS-3 wireless PHY transmission & reception links"
                >
                  <Wifi className="w-3.5 h-3.5 shrink-0" />
                  <span className="whitespace-nowrap">Wireless Links</span>
                </button>

                <button
                  onClick={() => setShowDrops((prev) => !prev)}
                  className={`h-[34px] px-3.5 rounded-full text-xs font-bold border transition-all inline-flex items-center gap-1.5 shrink-0 ${
                    showDrops
                      ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                  title="Toggle display of failed receptions and dropped wireless frames"
                >
                  <WifiOff className="w-3.5 h-3.5 shrink-0" />
                  <span className="whitespace-nowrap">Drops</span>
                </button>

                <button
                  onClick={() => setShowRoutingPaths((prev) => !prev)}
                  className={`h-[34px] px-3.5 rounded-full text-xs font-bold border transition-all inline-flex items-center gap-1.5 shrink-0 ${
                    showRoutingPaths
                      ? 'bg-cyan-600 text-white border-cyan-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                  title="Toggle genuine NS-3 multi-hop routing & CBR data forwarding paths"
                >
                  <Route className="w-3.5 h-3.5 shrink-0" />
                  <span className="whitespace-nowrap">Routing Paths</span>
                </button>

                <button
                  onClick={() => setShowControlWaves((prev) => !prev)}
                  className={`h-[34px] px-3.5 rounded-full text-xs font-bold border transition-all inline-flex items-center gap-1.5 shrink-0 ${
                    showControlWaves
                      ? 'bg-[#635BFF] text-white border-[#635BFF] shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                  title="Toggle AODV control-message waves (RREQ discovery, RREP reply, RERR)"
                >
                  <Radio className="w-3.5 h-3.5 shrink-0" />
                  <span className="whitespace-nowrap">Control Waves</span>
                </button>

                <button
                  onClick={() => setShowTrails((prev) => !prev)}
                  className={`h-[34px] px-3.5 rounded-full text-xs font-bold border transition-all inline-flex items-center gap-1.5 shrink-0 ${
                    showTrails
                      ? 'bg-slate-800 text-white border-slate-700 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                  title="Toggle continuous path trails from t=0s to current time"
                >
                  <Compass className="w-3.5 h-3.5 shrink-0" />
                  <span className="whitespace-nowrap">Trails</span>
                </button>

                <button
                  onClick={() => setShowRange((prev) => !prev)}
                  className={`h-[34px] px-3.5 rounded-full text-xs font-bold border transition-all inline-flex items-center gap-1.5 shrink-0 ${
                    showRange
                      ? 'bg-slate-800 text-white border-slate-700 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                  title="Toggle 250m Wi-Fi transmission range circle around nodes"
                >
                  <Radio className="w-3.5 h-3.5 shrink-0" />
                  <span className="whitespace-nowrap">Range (250m)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Multi-Hop Packet Journey Inspector - FINNOVA Dark Container */}
        {routingTrace && cbrPackets.length > 0 && (
          <div className="mt-4 p-5 rounded-[24px] border border-slate-800 bg-[#13141F] text-slate-200 shadow-xl space-y-4 w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800 w-full">
              <div className="inline-flex items-center gap-2.5">
                <Box className="w-4 h-4 text-[#635BFF] shrink-0" />
                <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight">
                  Multi-Hop Packet Journey Inspector
                </h4>
                <span className="inline-flex items-center text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#635BFF]/20 text-[#7B61FF] border border-[#635BFF]/30 shrink-0">
                  {cbrPackets.length} CBR Packets Captured
                </span>
              </div>

              {/* Packet Selector */}
              <div className="inline-flex items-center gap-2 shrink-0">
                <span className="text-[11px] font-bold text-slate-400 shrink-0">Inspect Packet:</span>
                <select
                  value={inspectedPacket ? inspectedPacket.packetUid : ''}
                  onChange={(e) => setSelectedPacketUid(parseInt(e.target.value, 10))}
                  className="h-[32px] bg-[#1E2033] border border-slate-700 text-white text-xs font-mono font-bold rounded-full px-3 pr-7 focus:outline-none focus:ring-2 focus:ring-[#635BFF] cursor-pointer inline-flex items-center max-w-[280px]"
                >
                  {cbrPackets.map((pkt) => (
                    <option key={pkt.packetUid} value={pkt.packetUid}>
                      UID #{pkt.packetUid} · t={pkt.sendTime.toFixed(2)}s · {pkt.isDelivered ? '✅ Delivered' : pkt.isDropped ? '❌ Dropped' : '⏳ In-Transit'}
                    </option>
                  ))}
                </select>
                {selectedPacketUid !== null && (
                  <button
                    onClick={() => setSelectedPacketUid(null)}
                    className="h-[32px] inline-flex items-center text-[10px] font-bold text-[#7B61FF] hover:underline shrink-0"
                  >
                    Auto-sync
                  </button>
                )}
              </div>
            </div>

            {inspectedPacket && (
              <div className="space-y-3 w-full">
                {/* Flow Metadata Badges */}
                <div className="flex flex-wrap items-center gap-2.5 text-xs w-full">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1E2033] border border-slate-800 shrink-0">
                    <span className="text-slate-400 font-medium whitespace-nowrap">Flow:</span>
                    <span className="font-mono font-bold text-white whitespace-nowrap">
                      {inspectedPacket.sourceIp} → {inspectedPacket.destIp}
                    </span>
                  </div>

                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1E2033] border border-slate-800 shrink-0">
                    <span className="text-slate-400 font-medium whitespace-nowrap">Total Hops:</span>
                    <span className="font-bold text-cyan-400 whitespace-nowrap">
                      {Math.max(1, inspectedPacket.hops.length - 1)} hops
                    </span>
                  </div>

                  {inspectedPacket.deliveredTime !== undefined && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1E2033] border border-slate-800 shrink-0">
                      <span className="text-slate-400 font-medium whitespace-nowrap">Transit Delay:</span>
                      <span className="font-bold text-emerald-400 whitespace-nowrap">
                        {((inspectedPacket.deliveredTime - inspectedPacket.sendTime) * 1000).toFixed(1)} ms
                      </span>
                    </div>
                  )}

                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1E2033] border border-slate-800 shrink-0">
                    <span className="text-slate-400 font-medium whitespace-nowrap">Delivery:</span>
                    {inspectedPacket.isDelivered ? (
                      <span className="text-emerald-400 font-extrabold inline-flex items-center gap-1 whitespace-nowrap">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        Delivered at {inspectedPacket.deliveredTime?.toFixed(3)}s
                      </span>
                    ) : inspectedPacket.isDropped ? (
                      <span className="text-rose-400 font-extrabold inline-flex items-center gap-1 whitespace-nowrap">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        Dropped ({inspectedPacket.dropReason || 'NO_ROUTE'})
                      </span>
                    ) : (
                      <span className="text-amber-400 font-extrabold whitespace-nowrap">In Transit</span>
                    )}
                  </div>
                </div>

                {/* Step-by-Step Hop Chain */}
                <div className="flex flex-wrap items-center gap-2 p-3 rounded-2xl bg-[#1E2033] border border-slate-800 font-mono text-[11px] overflow-x-auto w-full">
                  {inspectedPacket.hops.map((h, idx) => {
                    const isSrc = h.event_type === 'data_send';
                    const isFwd = h.event_type === 'data_forward';
                    const isDeliv = h.event_type === 'data_delivered';
                    const isDrop = h.event_type === 'data_drop';

                    return (
                      <React.Fragment key={idx}>
                        {idx > 0 && <span className="text-slate-500 font-bold shrink-0">→</span>}
                        <div
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border shrink-0 ${
                            isSrc
                              ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                              : isDeliv
                              ? 'bg-purple-500/20 border-purple-500/30 text-purple-300'
                              : isDrop
                              ? 'bg-rose-500/20 border-rose-500/30 text-rose-300'
                              : 'bg-cyan-500/20 border-cyan-500/30 text-cyan-300'
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              isSrc
                                ? 'bg-emerald-400'
                                : isDeliv
                                ? 'bg-purple-400'
                                : isDrop
                                ? 'bg-rose-400'
                                : 'bg-cyan-400'
                            }`}
                          ></span>
                          <span className="font-extrabold whitespace-nowrap">Node #{h.node_id}</span>
                          <span className="text-[10px] text-slate-400 whitespace-nowrap">
                            ({isSrc ? 'SRC' : isDeliv ? 'DST' : isDrop ? 'DROP' : 'FWD'}, t={h.time.toFixed(3)}s)
                          </span>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* Consecutive Hop Integrity Note */}
                {inspectedPacket.hops.length > 1 &&
                  inspectedPacket.hops.some(
                    (h, i) =>
                      i > 0 &&
                      (h.event_type === 'data_forward' || h.event_type === 'data_delivered') &&
                      h.prev_hop !== inspectedPacket.hops[i - 1].node_id
                  ) && (
                    <div className="text-[10px] text-amber-300 bg-amber-500/10 p-2 rounded-xl border border-amber-500/20 w-full">
                      ⚠️ Note: Consecutive trace reveals an intermediate hop was omitted or forwarded out of order by NS-3. Displaying exact recorded events.
                    </div>
                  )}
              </div>
            )}
          </div>
        )}

        {/* AODV vs eAODV Protocol Efficiency Summary Bar (Phase 5) */}
        {routingComparisonStats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2 border-t border-slate-100 text-xs w-full">
            <div className="flex flex-col justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 min-h-[58px]">
              <span className="text-[10px] uppercase font-bold text-slate-400 leading-tight block">RREQ Packets</span>
              <span className="text-base font-extrabold text-purple-700 leading-none mt-1">{routingComparisonStats.rreqCount}</span>
            </div>
            <div className="flex flex-col justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 min-h-[58px]">
              <span className="text-[10px] uppercase font-bold text-slate-400 leading-tight block">RREP Replies</span>
              <span className="text-base font-extrabold text-amber-700 leading-none mt-1">{routingComparisonStats.rrepCount}</span>
            </div>
            <div className="flex flex-col justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 min-h-[58px]">
              <span className="text-[10px] uppercase font-bold text-slate-400 leading-tight block">RERR Alerts</span>
              <span className="text-base font-extrabold text-rose-700 leading-none mt-1">{routingComparisonStats.rerrCount}</span>
            </div>
            <div className="flex flex-col justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 min-h-[58px]">
              <span className="text-[10px] uppercase font-bold text-slate-400 leading-tight block">Data Forwards</span>
              <span className="text-base font-extrabold text-cyan-700 leading-none mt-1">{routingComparisonStats.fwdCount}</span>
            </div>
            <div className="flex flex-col justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 min-h-[58px]">
              <span className="text-[10px] uppercase font-bold text-slate-400 leading-tight block">Delivered CBR</span>
              <span className="text-base font-extrabold text-emerald-700 leading-none mt-1">{routingComparisonStats.deliveredCount}</span>
            </div>
            <div className="flex flex-col justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 min-h-[58px]">
              <span className="text-[10px] uppercase font-bold text-slate-400 leading-tight block">Avg Hop Count</span>
              <span className="text-base font-extrabold text-navy-900 leading-none mt-1">{routingComparisonStats.avgHops} hops</span>
            </div>
          </div>
        )}

        {/* Scientific Provenance Legend & Honest Protocol Notice */}
        <div className="flex flex-col items-center justify-center gap-3 pt-3 border-t border-slate-100 text-xs text-navy-500 w-full">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 w-full">
            <div className="inline-flex items-center gap-1.5 shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0"></span>
              <span className="font-semibold text-navy-700 whitespace-nowrap">AODV Nodes</span>
            </div>
            <div className="inline-flex items-center gap-1.5 shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
              <span className="font-semibold text-navy-700 whitespace-nowrap">eAODV Nodes</span>
            </div>
            <div className="inline-flex items-center gap-1.5 shrink-0">
              <span className="w-3.5 h-0.5 bg-emerald-500 rounded shrink-0"></span>
              <span className="font-semibold text-emerald-800 whitespace-nowrap">NS-3 RxOk (PHY Link)</span>
            </div>
            <div className="inline-flex items-center gap-1.5 shrink-0">
              <span className="w-3.5 h-0.5 bg-cyan-500 rounded shrink-0"></span>
              <span className="font-semibold text-cyan-800 whitespace-nowrap">CBR Forward Hop</span>
            </div>
            <div className="inline-flex items-center gap-1.5 shrink-0">
              <span className="w-2.5 h-2.5 rounded-full border border-purple-400 border-dashed shrink-0"></span>
              <span className="font-semibold text-purple-700 whitespace-nowrap">AODV RREQ</span>
            </div>
            <div className="inline-flex items-center gap-1.5 shrink-0">
              <span className="w-2.5 h-2.5 rounded-full border border-amber-400 border-dashed shrink-0"></span>
              <span className="font-semibold text-amber-700 whitespace-nowrap">AODV RREP</span>
            </div>
            <div className="inline-flex items-center gap-1.5 shrink-0">
              <span className="w-3.5 h-0.5 border-b border-rose-500 border-dashed shrink-0"></span>
              <span className="font-semibold text-rose-700 whitespace-nowrap">RxDrop / Error</span>
            </div>
            <div className="inline-flex items-center gap-1.5 shrink-0">
              <span className="w-2.5 h-2.5 rounded-full border border-slate-400 border-dashed shrink-0"></span>
              <span className="font-semibold text-navy-700 whitespace-nowrap">250m Radius</span>
            </div>
          </div>

          {/* <span className="text-[11px] font-medium text-slate-500 bg-slate-50 px-3 py-1 rounded-full border border-slate-200 self-start lg:self-auto shrink-0">
            Coordinates from CourseChangeTrace · Links from WifiPhyState · Multi-Hop Routes from Ipv4L3Protocol Hooks
          </span> */}
        </div>
      </div>
    </section>
  );
};
