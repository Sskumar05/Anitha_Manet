/* ================================================
   MANET Dashboard — main.js
   Handles: Particles, Hero Canvas, Simulation,
            Charts (Chart.js), Topology Canvas
   ================================================ */

// ───────────────────────────────────────────────
// 1. PARTICLE BACKGROUND
// ───────────────────────────────────────────────
(function initParticles() {
  const container = document.getElementById('particles');
  const colors = ['#2864E8', '#5D8DF0', '#10B981', '#F59E0B', '#93C5FD'];
  for (let i = 0; i < 35; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 5 + 2;
    p.style.cssText = `
      width:${size}px; height:${size}px;
      left:${Math.random()*100}%;
      background:${colors[Math.floor(Math.random()*colors.length)]};
      animation-duration:${Math.random()*20+15}s;
      animation-delay:${Math.random()*15}s;
    `;
    container.appendChild(p);
  }
})();

// ───────────────────────────────────────────────
// 2. SMOOTH SECTION SCROLL
// ───────────────────────────────────────────────
document.querySelectorAll('.nav-pill').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    document.querySelectorAll('.nav-pill').forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    const target = document.querySelector(link.getAttribute('href'));
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

// ───────────────────────────────────────────────
// 3. KPI BAR ANIMATIONS (IntersectionObserver)
// ───────────────────────────────────────────────
const kpiTargets = { 'pdr-bar': 91.4, 'delay-bar': 71.5, 'overhead-bar': 62, 'energy-bar': 77.7 };
const kpiObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      document.querySelectorAll('.kpi-bar').forEach(bar => {
        const target = kpiTargets[bar.id] || 75;
        setTimeout(() => { bar.style.width = target + '%'; }, 200);
      });
    }
  });
}, { threshold: 0.3 });
const kpiSection = document.getElementById('kpi');
if (kpiSection) kpiObserver.observe(kpiSection);

// KPI counter animation
function animateCounter(elId, from, to, suffix, decimals, duration) {
  const el = document.getElementById(elId);
  if (!el) return;
  const step = (to - from) / (duration / 16);
  let val = from;
  const timer = setInterval(() => {
    val += step;
    if ((step > 0 && val >= to) || (step < 0 && val <= to)) { val = to; clearInterval(timer); }
    el.textContent = val.toFixed(decimals) + suffix;
  }, 16);
}
const counterObserver = new IntersectionObserver(entries => {
  if (entries[0].isIntersecting) {
    animateCounter('pdr-val', 70, 91.4, '%', 1, 1500);
    animateCounter('delay-val', 100, 42, ' ms', 0, 1500);
    animateCounter('overhead-val', 0.6, 0.31, '', 2, 1500);
    animateCounter('energy-val', 2, 1.24, ' J', 2, 1500);
  }
}, { threshold: 0.2 });
if (kpiSection) counterObserver.observe(kpiSection);

// ───────────────────────────────────────────────
// 4. HERO CANVAS — Animated network graph
// ───────────────────────────────────────────────
(function initHeroCanvas() {
  const canvas = document.getElementById('heroNetCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const NODE_COUNT = 14;
  const nodes = [];

  for (let i = 0; i < NODE_COUNT; i++) {
    nodes.push({
      x: 30 + Math.random() * (W - 60),
      y: 30 + Math.random() * (H - 60),
      vx: (Math.random() - 0.5) * 0.8,
      vy: (Math.random() - 0.5) * 0.8,
      energy: 0.4 + Math.random() * 0.6,
      radius: 5 + Math.random() * 3,
    });
  }

  function heroFrame() {
    ctx.clearRect(0, 0, W, H);
    // Draw links
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 120) {
          const alpha = (1 - dist / 120) * 0.45;
          ctx.strokeStyle = `rgba(40, 100, 232, ${alpha * 0.45})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }
    }
    // Draw nodes
    nodes.forEach(n => {
      const color = n.energy > 0.5 ? '#10B981' : '#EF4444';
      const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.radius * 2.8);
      glow.addColorStop(0, n.energy > 0.5 ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.3)');
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius * 2.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
      ctx.fill();

      // Move
      n.x += n.vx; n.y += n.vy;
      if (n.x < 20 || n.x > W - 20) n.vx *= -1;
      if (n.y < 20 || n.y > H - 20) n.vy *= -1;
      n.energy = Math.max(0.1, Math.min(1, n.energy + (Math.random() - 0.5) * 0.002));
    });
    requestAnimationFrame(heroFrame);
  }
  heroFrame();
})();

// ───────────────────────────────────────────────
// 5. SIMULATION CANVAS
// ───────────────────────────────────────────────
let simRunning = false;
let simAnimId = null;
let simNodes = [];
let simPackets = [];
let currentProto = 'AODV';
let simTime = 0;

function buildSimNodes(count) {
  const canvas = document.getElementById('simCanvas');
  const nodes = [];
  for (let i = 0; i < count; i++) {
    nodes.push({
      id: i,
      x: 30 + Math.random() * (canvas.width - 60),
      y: 30 + Math.random() * (canvas.height - 60),
      vx: (Math.random() - 0.5) * 1.2,
      vy: (Math.random() - 0.5) * 1.2,
      energy: 0.3 + Math.random() * 0.7,
      isSource: i === 0,
      isDest: i === count - 1,
    });
  }
  return nodes;
}

function spawnPacket(nodes, proto) {
  const src = nodes.find(n => n.isSource) || nodes[0];
  const dst = nodes.find(n => n.isDest) || nodes[nodes.length - 1];
  // pick route: eAODV avoids low-energy nodes
  let route = [src];
  let current = src;
  for (let step = 0; step < 5; step++) {
    let best = null, bestScore = Infinity;
    nodes.forEach(n => {
      if (route.includes(n)) return;
      const dx = n.x - current.x, dy = n.y - current.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const dxd = n.x - dst.x, dyd = n.y - dst.y;
      const toDst = Math.sqrt(dxd*dxd + dyd*dyd);
      let score = dist + toDst;
      if (proto === 'eAODV') score += (1 - n.energy) * 200;
      if (score < bestScore) { bestScore = score; best = n; }
    });
    if (!best) break;
    route.push(best);
    current = best;
    if (current === dst || toDist(current, dst) < 50) { route.push(dst); break; }
  }
  if (!route.includes(dst)) route.push(dst);
  return { route, progress: 0, speed: 0.012, color: '#ffd166', delivered: false };
}

function toDist(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx*dx + dy*dy);
}

function simFrame() {
  const canvas = document.getElementById('simCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // Grid dots
  ctx.fillStyle = 'rgba(36, 50, 74, 0.06)';
  for (let gx = 30; gx < W; gx += 40)
    for (let gy = 30; gy < H; gy += 40) {
      ctx.beginPath(); ctx.arc(gx, gy, 1, 0, Math.PI * 2); ctx.fill();
    }

  simTime++;

  // Draw links between close nodes
  for (let i = 0; i < simNodes.length; i++) {
    for (let j = i + 1; j < simNodes.length; j++) {
      const d = toDist(simNodes[i], simNodes[j]);
      if (d < 130) {
        const alpha = (1 - d / 130) * 0.22;
        ctx.strokeStyle = `rgba(40, 100, 232, ${alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(simNodes[i].x, simNodes[i].y);
        ctx.lineTo(simNodes[j].x, simNodes[j].y);
        ctx.stroke();
      }
    }
  }

  // Highlight route links
  simPackets.forEach(pkt => {
    for (let k = 0; k < pkt.route.length - 1; k++) {
      const a = pkt.route[k], b = pkt.route[k + 1];
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
  simNodes.forEach(n => {
    const color = n.isSource ? '#2864E8' : n.isDest ? '#F59E0B' : n.energy > 0.35 ? '#10B981' : '#EF4444';
    const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 16);
    glow.addColorStop(0, color === '#2864E8' ? 'rgba(40, 100, 232, 0.3)' : color === '#10B981' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(n.x, n.y, 16, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(n.x, n.y, 5.5, 0, Math.PI * 2); ctx.fill();

    // Energy ring
    ctx.strokeStyle = color + 'aa';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(n.x, n.y, 8.5, 0, Math.PI * 2 * n.energy);
    ctx.stroke();

    // Label
    if (n.isSource || n.isDest) {
      ctx.fillStyle = '#24324A';
      ctx.font = 'bold 10px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(n.isSource ? 'SRC' : 'DST', n.x, n.y - 14);
    }

    // Move
    n.x += n.vx; n.y += n.vy;
    if (n.x < 20 || n.x > W - 20) n.vx *= -1;
    if (n.y < 20 || n.y > H - 20) n.vy *= -1;
    if (currentProto === 'eAODV') n.energy = Math.max(0.1, n.energy - 0.0001);
    else n.energy = Math.max(0.1, n.energy - 0.0003);
  });

  // Animate packets
  simPackets = simPackets.filter(pkt => !pkt.delivered);
  simPackets.forEach(pkt => {
    pkt.progress += pkt.speed;
    const totalSeg = pkt.route.length - 1;
    const seg = Math.floor(pkt.progress * totalSeg);
    if (seg >= totalSeg) { pkt.delivered = true; return; }
    const t = (pkt.progress * totalSeg) - seg;
    const a = pkt.route[seg], b = pkt.route[seg + 1];
    const px = a.x + (b.x - a.x) * t;
    const py = a.y + (b.y - a.y) * t;
    const glow2 = ctx.createRadialGradient(px, py, 0, px, py, 12);
    glow2.addColorStop(0, 'rgba(40, 100, 232, 0.4)');
    glow2.addColorStop(1, 'transparent');
    ctx.fillStyle = glow2;
    ctx.beginPath(); ctx.arc(px, py, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2864E8';
    ctx.beginPath(); ctx.arc(px, py, 4.5, 0, Math.PI * 2); ctx.fill();
  });

  // Spawn new packets every 2 seconds
  if (simTime % 120 === 0) {
    simPackets.push(spawnPacket(simNodes, currentProto));
    drainEnergy();
    addLog();
  }

  simAnimId = requestAnimationFrame(simFrame);
}

let delivered = 0, total = 0;
function drainEnergy() {
  simNodes.forEach(n => { n.energy = Math.max(0.05, n.energy - (Math.random() * 0.03)); });
  total++;
  if (Math.random() < (currentProto === 'eAODV' ? 0.91 : 0.73)) delivered++;
  updateTopoStats();
}

const logMessages = [
  '[RREQ] Route discovery initiated from SRC',
  '[RREP] Route reply received via node #%i',
  '[DATA] Packet forwarded — energy: %e J',
  '[AODV] Next hop selected (min delay)',
  '[eAODV] Next hop selected (max energy)',
  '[WARN] Low energy node avoided on route',
  '[INFO] FlowMonitor: PDR = %p%',
];
let logIdx = 0;
function addLog() {
  const log = document.getElementById('simLog');
  if (!log) return;
  let msg = logMessages[logIdx % logMessages.length]
    .replace('%i', Math.floor(Math.random()*49))
    .replace('%e', (Math.random()*2+0.5).toFixed(2))
    .replace('%p', (70 + Math.random()*22).toFixed(1));
  logIdx++;
  const el = document.createElement('div');
  el.className = 'log-line' + (msg.includes('WARN') ? ' warn' : msg.includes('DATA') || msg.includes('FlowMonitor') ? ' success' : '');
  el.textContent = msg;
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
  if (log.children.length > 30) log.removeChild(log.firstChild);
}

function toggleSim() {
  simRunning = !simRunning;
  const btn = document.getElementById('runSimBtn');
  const icon = document.getElementById('runBtnIcon');
  const label = document.getElementById('runBtnLabel');
  if (simRunning) {
    const count = parseInt(document.getElementById('nodeCount').value);
    simNodes = buildSimNodes(count);
    simPackets = [spawnPacket(simNodes, currentProto)];
    btn.classList.add('running');
    icon.textContent = '⏹';
    label.textContent = 'Stop Simulation';
    addLog('[INFO] Simulation started — Protocol: ' + currentProto);
    simFrame();
  } else {
    cancelAnimationFrame(simAnimId);
    btn.classList.remove('running');
    icon.textContent = '▶';
    label.textContent = 'Run Simulation';
    const log = document.getElementById('simLog');
    const el = document.createElement('div');
    el.className = 'log-line warn';
    el.textContent = '[STOP] Simulation halted by user';
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
  }
}

function updateSim() {
  const nc = document.getElementById('nodeCount');
  const ns = document.getElementById('nodeSpeed');
  document.getElementById('nodeCountVal').textContent = nc.value;
  document.getElementById('nodeCountLabel').textContent = nc.value;
  document.getElementById('nodeSpeedVal').textContent = ns.value + ' m/s';
  document.getElementById('nodeSpeedLabel').textContent = ns.value + ' m/s';
  // Adjust node speeds
  const speed = parseFloat(ns.value) / 8;
  simNodes.forEach(n => {
    n.vx = (Math.random() - 0.5) * speed;
    n.vy = (Math.random() - 0.5) * speed;
  });
  if (simRunning) {
    const newCount = parseInt(nc.value);
    if (newCount !== simNodes.length) { simNodes = buildSimNodes(newCount); }
  }
}

function setProto(proto) {
  currentProto = proto;
  ['aodv','eaodv','both'].forEach(p => document.getElementById('pb-'+p)?.classList.remove('active'));
  document.getElementById('pb-'+proto.toLowerCase())?.classList.add('active');
}

// ───────────────────────────────────────────────
// 6. CHART.JS CHARTS
// ───────────────────────────────────────────────
Chart.defaults.color = '#77839A';
Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";

const CHART_OPTS = (title) => ({
  responsive: true,
  maintainAspectRatio: true,
  animation: { duration: 900, easing: 'easeInOutQuart' },
  plugins: {
    legend: {
      labels: {
        boxWidth: 12,
        padding: 16,
        font: { size: 12, family: "'Plus Jakarta Sans', sans-serif", weight: '600' },
        color: '#24324A'
      }
    },
    tooltip: {
      backgroundColor: '#24324A',
      borderColor: '#E8ECF2',
      borderWidth: 1,
      padding: 12,
      cornerRadius: 10,
      titleFont: { family: "'Plus Jakarta Sans', sans-serif", size: 12, weight: '600' },
      bodyFont: { family: "'Plus Jakarta Sans', sans-serif", size: 12 },
      titleColor: '#FFFFFF',
      bodyColor: '#F1F5F9',
    }
  },
  scales: {
    x: {
      grid: { color: 'rgba(232, 236, 242, 0.8)' },
      ticks: { color: '#77839A', font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 } }
    },
    y: {
      grid: { color: 'rgba(232, 236, 242, 0.8)' },
      ticks: { color: '#77839A', font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 } }
    },
  }
});

const SCENARIOS = {
  speed: {
    labels: ['2 m/s','5 m/s','10 m/s','15 m/s','20 m/s','25 m/s'],
    pdr:      { aodv: [87,84,78,70,62,53], eaodv: [94,92,91,88,84,79] },
    delay:    { aodv: [28,36,54,72,91,118], eaodv: [18,24,42,56,68,84] },
    overhead: { aodv: [0.22,0.30,0.44,0.58,0.72,0.88], eaodv: [0.16,0.22,0.31,0.40,0.51,0.63] },
    energy:   { aodv: [1.2,1.5,1.8,2.2,2.6,3.1], eaodv: [0.9,1.1,1.24,1.5,1.8,2.2] },
    xTitle: 'Node Speed (m/s)',
  },
  nodes: {
    labels: ['20','30','50','70','100'],
    pdr:      { aodv: [82,79,73,68,61], eaodv: [91,89,86,83,79] },
    delay:    { aodv: [32,45,58,75,98], eaodv: [22,31,42,54,70] },
    overhead: { aodv: [0.19,0.28,0.44,0.60,0.78], eaodv: [0.14,0.21,0.31,0.43,0.58] },
    energy:   { aodv: [0.9,1.2,1.6,2.1,2.8], eaodv: [0.7,0.9,1.2,1.5,2.0] },
    xTitle: 'Number of Nodes',
  },
  traffic: {
    labels: ['5 flows','10 flows','20 flows','30 flows','50 flows'],
    pdr:      { aodv: [88,82,74,64,54], eaodv: [95,91,87,80,72] },
    delay:    { aodv: [25,40,62,88,122], eaodv: [18,30,46,65,90] },
    overhead: { aodv: [0.18,0.30,0.50,0.72,0.95], eaodv: [0.14,0.23,0.37,0.54,0.72] },
    energy:   { aodv: [0.8,1.2,1.7,2.3,3.0], eaodv: [0.6,0.9,1.3,1.7,2.3] },
    xTitle: 'Traffic Load (flows)',
  }
};

function makeDataset(label, data, color, fill = false) {
  return {
    label,
    data,
    borderColor: color,
    backgroundColor: fill ? (color === '#2864E8' ? 'rgba(40, 100, 232, 0.08)' : 'rgba(148, 163, 184, 0.08)') : 'transparent',
    pointBackgroundColor: color,
    pointBorderColor: '#FFFFFF',
    pointBorderWidth: 2,
    pointRadius: 4.5,
    pointHoverRadius: 6.5,
    borderWidth: 2.5,
    fill,
    tension: 0.35,
  };
}

let charts = {};
function buildCharts(scenKey) {
  const d = SCENARIOS[scenKey];
  const chartDefs = [
    { id: 'chartPDR',      key: 'pdr',      yLabel: 'PDR (%)',        cA: '#94A3B8', cB: '#2864E8' },
    { id: 'chartDelay',    key: 'delay',    yLabel: 'Delay (ms)',     cA: '#94A3B8', cB: '#2864E8' },
    { id: 'chartOverhead', key: 'overhead', yLabel: 'Overhead Ratio', cA: '#94A3B8', cB: '#2864E8' },
    { id: 'chartEnergy',   key: 'energy',   yLabel: 'Energy (J)',     cA: '#94A3B8', cB: '#2864E8' },
  ];
  chartDefs.forEach(({ id, key, yLabel, cA, cB }) => {
    if (charts[id]) { charts[id].destroy(); }
    const ctx = document.getElementById(id).getContext('2d');
    charts[id] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: d.labels,
        datasets: [
          makeDataset('AODV (Baseline)', d[key].aodv, cA, true),
          makeDataset('eAODV (Enhanced)', d[key].eaodv, cB, true),
        ]
      },
      options: {
        ...CHART_OPTS(yLabel),
        scales: {
          x: {
            grid: { color: 'rgba(232, 236, 242, 0.8)' },
            ticks: { color: '#77839A', font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 } },
            title: { display: true, text: d.xTitle, color: '#77839A', font: { family: "'Plus Jakarta Sans', sans-serif", size: 11, weight: '600' } }
          },
          y: {
            grid: { color: 'rgba(232, 236, 242, 0.8)' },
            ticks: { color: '#77839A', font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 } },
            title: { display: true, text: yLabel, color: '#77839A', font: { family: "'Plus Jakarta Sans', sans-serif", size: 11, weight: '600' } }
          }
        }
      }
    });
  });
}

function loadScenario(key, btn) {
  document.querySelectorAll('.scen-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  buildCharts(key);
}

// Build default charts when charts section is visible
const chartsObserver = new IntersectionObserver(entries => {
  if (entries[0].isIntersecting && !charts['chartPDR']) buildCharts('speed');
}, { threshold: 0.1 });
const chartsSection = document.getElementById('analysis');
if (chartsSection) chartsObserver.observe(chartsSection);

// ───────────────────────────────────────────────
// 7. TOPOLOGY CANVAS
// ───────────────────────────────────────────────
let topoNodes = [], topoLinks = [], topoRoutes = [];
let topoMode = 'static', topoDynAnimId = null;

function initTopo() {
  const canvas = document.getElementById('topoCanvas');
  if (!canvas) return;
  canvas.width = canvas.parentElement.clientWidth - 48;
  const W = canvas.width, H = 380;
  const count = 50;
  topoNodes = [];
  for (let i = 0; i < count; i++) {
    topoNodes.push({
      id: i,
      x: 30 + Math.random() * (W - 60),
      y: 30 + Math.random() * (H - 60),
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      energy: 0.3 + Math.random() * 0.7,
      isSource: i === 0, isDest: i === count - 1,
    });
  }
  // Build links
  topoLinks = [];
  for (let i = 0; i < count; i++)
    for (let j = i + 1; j < count; j++)
      if (toDist(topoNodes[i], topoNodes[j]) < 130) topoLinks.push([i, j]);

  // Pick route
  topoRoutes = [pickRoute()];
  drawTopo();
}

function pickRoute() {
  const src = topoNodes[0], dst = topoNodes[topoNodes.length - 1];
  const route = [src];
  let cur = src;
  for (let s = 0; s < 6; s++) {
    let best = null, bestScore = Infinity;
    topoNodes.forEach(n => {
      if (route.includes(n)) return;
      const score = toDist(n, cur) + toDist(n, dst) + (1 - n.energy) * 150;
      if (score < bestScore) { bestScore = score; best = n; }
    });
    if (!best) break;
    route.push(best); cur = best;
    if (toDist(cur, dst) < 60) break;
  }
  route.push(dst);
  return route;
}

function drawTopo() {
  const canvas = document.getElementById('topoCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // Bg dots
  ctx.fillStyle = 'rgba(36, 50, 74, 0.05)';
  for (let gx = 30; gx < W; gx += 50)
    for (let gy = 30; gy < H; gy += 50) {
      ctx.beginPath(); ctx.arc(gx, gy, 1.5, 0, Math.PI * 2); ctx.fill();
    }

  // Transmission circles (range) for source
  const src = topoNodes[0];
  ctx.strokeStyle = 'rgba(40, 100, 232, 0.16)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 6]);
  ctx.beginPath(); ctx.arc(src.x, src.y, 130, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);

  // Links
  if (topoMode === 'static' || topoMode === 'dynamic') {
    topoLinks.forEach(([i, j]) => {
      const a = topoNodes[i], b = topoNodes[j];
      const d = toDist(a, b);
      if (d > 130) return;
      ctx.strokeStyle = `rgba(40, 100, 232, ${(1 - d / 130) * 0.18})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    });
  }

  // Routes
  if (topoMode === 'route') {
    topoRoutes.forEach(route => {
      for (let k = 0; k < route.length - 1; k++) {
        const a = route[k], b = route[k + 1];
        ctx.strokeStyle = 'rgba(40, 100, 232, 0.75)';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([8, 4]);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.setLineDash([]);
      }
    });
  }

  // Nodes
  topoNodes.forEach(n => {
    const onRoute = topoMode === 'route' && topoRoutes[0].includes(n);
    const color = n.isSource ? '#2864E8' : n.isDest ? '#F59E0B' : onRoute ? '#2864E8' : n.energy > 0.4 ? '#10B981' : '#EF4444';
    const r = n.isSource || n.isDest ? 7 : onRoute ? 6 : 4.5;
    const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 3);
    glow.addColorStop(0, color === '#2864E8' ? 'rgba(40, 100, 232, 0.35)' : 'rgba(16, 185, 129, 0.35)');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(n.x, n.y, r * 3, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.fill();

    if (n.isSource || n.isDest) {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 9px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(n.isSource ? 'S' : 'D', n.x, n.y - r - 6);
    }
  });
}

function setTopo(mode, btn) {
  topoMode = mode;
  document.querySelectorAll('.topo-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (mode === 'dynamic') {
    if (!topoDynAnimId) {
      function dynLoop() {
        topoNodes.forEach(n => {
          n.x += n.vx; n.y += n.vy;
          const W = document.getElementById('topoCanvas').width;
          if (n.x < 20 || n.x > W - 20) n.vx *= -1;
          if (n.y < 20 || n.y > 360) n.vy *= -1;
          n.energy = Math.max(0.05, n.energy - 0.0002);
        });
        // Rebuild links
        topoLinks = [];
        for (let i = 0; i < topoNodes.length; i++)
          for (let j = i + 1; j < topoNodes.length; j++)
            if (toDist(topoNodes[i], topoNodes[j]) < 130) topoLinks.push([i, j]);
        drawTopo();
        updateTopoStats();
        topoDynAnimId = requestAnimationFrame(dynLoop);
      }
      dynLoop();
    }
  } else {
    if (topoDynAnimId) { cancelAnimationFrame(topoDynAnimId); topoDynAnimId = null; }
    drawTopo();
  }
}

function updateTopoStats() {
  const activeLinks = topoLinks.length;
  const avgE = (topoNodes.reduce((s, n) => s + n.energy, 0) / topoNodes.length * 100).toFixed(0);
  document.getElementById('t-links').textContent = activeLinks;
  document.getElementById('t-energy').textContent = avgE + '%';
  const pdr = (70 + Math.random() * 22).toFixed(1);
  document.getElementById('t-pdr').textContent = pdr + '%';
}

// Init topology when visible
const topoObserver = new IntersectionObserver(entries => {
  if (entries[0].isIntersecting) { initTopo(); topoObserver.disconnect(); }
}, { threshold: 0.1 });
const topoSection = document.getElementById('topology');
if (topoSection) topoObserver.observe(topoSection);

// Resize
window.addEventListener('resize', () => {
  const c = document.getElementById('topoCanvas');
  if (c && c.parentElement) {
    c.width = c.parentElement.clientWidth - 48;
    drawTopo();
  }
});

// ==========================================================================
// NOTIFICATION POPOVER DROPDOWN (OPTION 1)
// ==========================================================================
function escapeNotifHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function updateNotifDropdown() {
  const simLog = document.getElementById('simLog');
  const list = document.getElementById('notifList');
  const countPill = document.getElementById('notifCountPill');
  const statusBadge = document.getElementById('notifStatusBadge');
  const statusText = document.getElementById('notifStatusText');
  if (!list) return;

  // Mirror NS-3 readiness and active simulation status
  if (statusBadge && statusText) {
    if (typeof simRunning !== 'undefined' && simRunning) {
      statusBadge.className = 'notif-status-badge running';
      statusText.textContent = `Sim Active (${typeof currentProto !== 'undefined' ? currentProto : 'eAODV'})`;
    } else {
      statusBadge.className = 'notif-status-badge';
      statusText.textContent = 'NS-3 Ready';
    }
  }

  if (!simLog) return;
  const logLines = Array.from(simLog.querySelectorAll('.log-line'));
  if (logLines.length === 0) {
    list.innerHTML = '<div class="notif-empty-state">No simulation events recorded yet.</div>';
    if (countPill) countPill.textContent = '0 Logs';
    return;
  }

  // Display up to 5 most recent actual logs in reverse chronological order
  const recent = logLines.slice(-5).reverse();
  if (countPill) countPill.textContent = `${logLines.length} Logs`;

  list.innerHTML = recent.map((line, idx) => {
    const rawText = line.textContent.trim();
    const match = rawText.match(/^\[(.*?)\]\s*(.*)$/);
    const tag = match ? match[1] : (rawText.startsWith('[') ? rawText.slice(1, Math.max(1, rawText.indexOf(']'))) : 'INFO');
    const body = match ? match[2] : rawText;

    let icon = 'ℹ️';
    let tagClass = 'notif-tag-info';

    if (tag.includes('WARN') || tag.includes('STOP')) {
      icon = '⚠️';
      tagClass = 'notif-tag-warn';
    } else if (tag.includes('DATA') || tag === 'eAODV') {
      icon = '⚡';
      tagClass = 'notif-tag-success';
    } else if (tag.includes('RREQ') || tag.includes('RREP') || tag === 'AODV') {
      icon = '⇄';
      tagClass = 'notif-tag-route';
    } else if (tag.includes('READY')) {
      icon = '▶';
      tagClass = 'notif-tag-ready';
    }

    const orderLabel = idx === 0 ? 'Latest' : `#${logLines.length - idx}`;

    return `
      <div class="notif-item">
        <div class="notif-item-icon-box ${tagClass}">${icon}</div>
        <div class="notif-item-content">
          <div class="notif-item-top">
            <span class="notif-item-tag ${tagClass}">[${escapeNotifHtml(tag)}]</span>
            <span class="notif-item-order">${orderLabel}</span>
          </div>
          <div class="notif-item-text">${escapeNotifHtml(body)}</div>
        </div>
      </div>
    `;
  }).join('');
}

function toggleNotifDropdown(eventOrForce) {
  if (eventOrForce && typeof eventOrForce.stopPropagation === 'function') {
    eventOrForce.stopPropagation();
  }
  const btn = document.getElementById('notifBellBtn');
  const dropdown = document.getElementById('notifDropdown');
  if (!dropdown || !btn) return;

  const forceOpen = typeof eventOrForce === 'boolean' ? eventOrForce : undefined;
  const willOpen = typeof forceOpen === 'boolean' ? forceOpen : !dropdown.classList.contains('open');
  if (willOpen) {
    updateNotifDropdown();
    dropdown.classList.add('open');
    dropdown.setAttribute('aria-hidden', 'false');
    btn.setAttribute('aria-expanded', 'true');
  } else {
    dropdown.classList.remove('open');
    dropdown.setAttribute('aria-hidden', 'true');
    btn.setAttribute('aria-expanded', 'false');
  }
}

function viewConsoleLogsFromNotif(event) {
  if (event && typeof event.stopPropagation === 'function') {
    event.stopPropagation();
  }
  toggleNotifDropdown(false);
  const simLog = document.getElementById('simLog');
  if (simLog) {
    simLog.scrollIntoView({ behavior: 'smooth', block: 'center' });
    simLog.classList.remove('highlight-pulse');
    void simLog.offsetWidth;
    simLog.classList.add('highlight-pulse');
    setTimeout(() => {
      simLog.classList.remove('highlight-pulse');
    }, 1600);
  }
}

function initNotifDropdown() {
  // Live observer so open popover refreshes as logs are generated
  const simLogTarget = document.getElementById('simLog');
  if (simLogTarget && window.MutationObserver) {
    const observer = new MutationObserver(() => {
      const dropdown = document.getElementById('notifDropdown');
      if (dropdown && dropdown.classList.contains('open')) {
        updateNotifDropdown();
      }
    });
    observer.observe(simLogTarget, { childList: true });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNotifDropdown);
} else {
  initNotifDropdown();
}

// Close when clicking outside
document.addEventListener('click', (e) => {
  const wrapper = document.querySelector('.notif-wrapper');
  if (wrapper && !wrapper.contains(e.target)) {
    toggleNotifDropdown(false);
  }
});

// Close on Escape key & return focus
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const dropdown = document.getElementById('notifDropdown');
    if (dropdown && dropdown.classList.contains('open')) {
      toggleNotifDropdown(false);
      const btn = document.getElementById('notifBellBtn');
      if (btn) btn.focus();
    }
  }
});

