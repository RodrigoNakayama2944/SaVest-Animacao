const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');

const W = 800, H = 600;

const GROUND_Y = 560;
const PLATFORM_Y = 230;
const PLATFORM_LEFT = 80;
const PLATFORM_RIGHT = 360;
const PLATFORM_THICKNESS = 14;
const BUILDING_LEFT = PLATFORM_LEFT - 30;
const BUILDING_RIGHT = PLATFORM_RIGHT + 40;
const FALL_THRESHOLD_M = 1.8;
const PX_PER_METER = (GROUND_Y - PLATFORM_Y) / 6;
const FALL_THRESHOLD_PX = FALL_THRESHOLD_M * PX_PER_METER;
const WALK_SPEED = 1.2;
const AMBULANCE_SPEED = 2.5;
const VEST_COLOR = '#ff6600';
const VEST_STRIPE = '#ffdd00';

const STATE = { WORKING: 0, FALLING: 1, DOWN: 2, RESCUING: 3, RESCUED: 4 };
const PHASE = { NONE: 0, POINTING: 1, AMBULANCE: 2, PARAMEDICS: 3, CARRYING: 4, LOADING: 5, DEPARTING: 6, COMPLETE: 7 };

let animId = null;
let alarmed = false;
let knockedOut = false;
let rescuePhase = PHASE.NONE;
let phaseTimer = 0;
let frameTime = 0;
let sirenPlaying = false;

let phase2Active = false;
let phase2Timer = 0;
let phase2Stage = 0;
let phase2CompleteDelay = 0;

let transitionOverlayActive = false;
let transitionOverlayTimer = 0;

const fallingObj = {
  x: 260,
  y: PLATFORM_Y - 20,
  vy: 0,
  active: false,
};

const lookout = {
  x: 220,
  alerted: false,
  reacting: false,
  reactionTimer: 0,
};

const WORKER_NAME = 'John';

const worker = {
  x: 200,
  y: PLATFORM_Y - 35,
  vx: 0.8,
  vy: 0,
  state: STATE.WORKING,
  fallStartY: 0,
  walkPhase: 0,
  landX: 200,
};

const rescuer = {
  x: 658,
  targetX: 200,
  walkPhase: 0,
  active: false,
  arrived: false,
  reacting: false,
  reactionTimer: 0,
  name: 'Alex',
};

const ambulance = {
  x: 900,
  targetX: 420,
  arrived: false,
  doorOpen: false,
  lightPhase: 0,
};

const para1 = {
  x: 900,
  targetX: 0,
  targetBackX: 0,
  walkPhase: 0,
  active: false,
  arrived: false,
  carrying: false,
  carryDone: false,
  exitDelay: 0,
};

const para2 = {
  x: 900,
  targetX: 0,
  targetBackX: 0,
  walkPhase: 0,
  active: false,
  arrived: false,
  carrying: false,
  carryDone: false,
  exitDelay: 0,
};

const PHASE_NAMES = {
  [PHASE.NONE]: '',
  [PHASE.POINTING]: 'Rescuer responding',
  [PHASE.AMBULANCE]: 'Ambulance en route',
  [PHASE.PARAMEDICS]: 'Paramedics deploying',
  [PHASE.CARRYING]: 'Carrying worker to ambulance',
  [PHASE.LOADING]: 'Loading patient',
  [PHASE.DEPARTING]: 'Transporting to hospital',
  [PHASE.COMPLETE]: 'Rescue complete',
};

function drawScene() {
  ctx.clearRect(0, 0, W, H);

  const skyGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  skyGrad.addColorStop(0, '#1a1a3e');
  skyGrad.addColorStop(1, '#2d2d5e');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, GROUND_Y);

  drawBuilding();
  drawHeightScale();
  drawGround();

  drawSmallBuilding();
  drawAmbulance();

  if (worker.state === STATE.WORKING || worker.state === STATE.FALLING) {
    drawWorkerStanding();
  } else if (worker.state === STATE.DOWN) {
    drawFallenWorker();
  }

  if (rescuePhase < PHASE.DEPARTING) {
    drawParamedics();
  }

  if (rescuePhase === PHASE.CARRYING) {
    drawStretcher();
  }

  if (rescuer.active && rescuePhase < PHASE.CARRYING) {
    drawRescuer();
  }

  drawPhaseOverlay();
  drawParticles();
  if (transitionOverlayActive) {
    drawTransitionOverlay();
  }
  if (phase2Active) {
    drawPhase2();
  }
}

function drawGround() {
  ctx.fillStyle = '#2d4a2d';
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
  ctx.fillStyle = '#3a5a3a';
  ctx.fillRect(0, GROUND_Y, W, 4);
  for (let i = 0; i < W; i += 30) {
    ctx.fillStyle = i % 60 === 0 ? '#3a5a3a' : '#4a6a3a';
    ctx.fillRect(i, GROUND_Y + 8, 16, 3);
  }
}

function drawBuilding() {
  ctx.fillStyle = '#3a3a5a';
  ctx.fillRect(BUILDING_LEFT, PLATFORM_Y + PLATFORM_THICKNESS, BUILDING_RIGHT - BUILDING_LEFT, GROUND_Y - PLATFORM_Y);

  ctx.fillStyle = '#4a4a6a';
  for (let y = PLATFORM_Y + PLATFORM_THICKNESS + 20; y < GROUND_Y; y += 50) {
    for (let x = BUILDING_LEFT + 15; x < BUILDING_RIGHT - 20; x += 45) {
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(x, y, 30, 35);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, 30, 35);
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.fillRect(x + 4, y + 4, 22, 27);
    }
  }

  ctx.fillStyle = '#5a5a7a';
  ctx.fillRect(PLATFORM_LEFT - 25, PLATFORM_Y + PLATFORM_THICKNESS, 10, GROUND_Y - PLATFORM_Y - PLATFORM_THICKNESS);
  ctx.fillRect(PLATFORM_RIGHT + 15, PLATFORM_Y + PLATFORM_THICKNESS, 10, GROUND_Y - PLATFORM_Y - PLATFORM_THICKNESS);

  ctx.fillStyle = '#e94560';
  ctx.fillRect(PLATFORM_LEFT, PLATFORM_Y, PLATFORM_RIGHT - PLATFORM_LEFT, PLATFORM_THICKNESS);
  ctx.fillStyle = '#ff6b6b';
  ctx.fillRect(PLATFORM_LEFT, PLATFORM_Y, PLATFORM_RIGHT - PLATFORM_LEFT, 3);

  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(PLATFORM_LEFT + 10, PLATFORM_Y + 7);
  ctx.lineTo(PLATFORM_RIGHT - 10, PLATFORM_Y + 7);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#5a5a7a';
  for (let x = PLATFORM_LEFT + 50; x < PLATFORM_RIGHT - 30; x += 80) {
    ctx.fillRect(x, PLATFORM_Y - 4, 4, 4);
  }
}

function drawSmallBuilding() {
  const bx = 595;
  const bw = 85;
  const bh = 52;
  const by = GROUND_Y - bh;

  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;

  ctx.fillStyle = '#735e4d';
  ctx.fillRect(bx, by, bw, bh);

  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.fillStyle = '#8a7a6a';
  ctx.fillRect(bx, by, bw, 3);
  ctx.fillRect(bx, by + 16, bw, 2);
  ctx.fillRect(bx, by + 32, bw, 2);

  ctx.fillStyle = '#5a4a3a';
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 10; col++) {
      ctx.fillRect(bx + 4 + col * 8, by + 4 + row * 15, 6, 10);
    }
  }

  ctx.fillStyle = '#4a3a2a';
  ctx.fillRect(bx, by + 46, bw, 6);

  ctx.fillStyle = '#8a3a3a';
  ctx.beginPath();
  ctx.moveTo(bx - 4, by);
  ctx.lineTo(bx + bw / 2, by - 14);
  ctx.lineTo(bx + bw + 4, by);
  ctx.fill();

  ctx.fillStyle = '#a05050';
  ctx.beginPath();
  ctx.moveTo(bx - 2, by);
  ctx.lineTo(bx + bw / 2, by - 10);
  ctx.lineTo(bx + bw + 2, by);
  ctx.fill();

  const doorL = bx + bw - 22;
  const doorT = by + 16;
  const doorW = 18;
  const doorH = 30;

  const doorOpen = rescuer.active && rescuer.arrived === false;

  ctx.fillStyle = doorOpen ? '#1a1a2e' : '#5a3a2a';
  ctx.fillRect(doorL, doorT, doorW, doorH);

  if (!doorOpen) {
    ctx.fillStyle = '#4a2a1a';
    ctx.fillRect(doorL + 1, doorT + 1, doorW - 2, doorH - 2);
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(doorL + doorW - 4, doorT + doorH / 2, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#88ccff';
  ctx.fillRect(bx + 5, by + 4, 12, 10);
  ctx.strokeStyle = '#5a4a3a';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx + 5, by + 4, 12, 10);
  ctx.beginPath();
  ctx.moveTo(bx + 11, by + 4);
  ctx.lineTo(bx + 11, by + 14);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(bx + 5, by + 9);
  ctx.lineTo(bx + 17, by + 9);
  ctx.stroke();

  if (alarmed) {
    const beaconPulse = 0.3 + Math.sin(Date.now() / 150) * 0.5;
    ctx.fillStyle = `rgba(255, 50, 50, ${beaconPulse})`;
    ctx.shadowColor = `rgba(255, 0, 0, ${beaconPulse * 0.8})`;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(bx + bw / 2, by - 18, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = '7px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('GUARD', bx + bw / 2, by - 26);
}

function drawHeightScale() {
  const totalH = GROUND_Y - PLATFORM_Y;
  const steps = [6, 4.5, 3, 1.8, 0];
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(PLATFORM_RIGHT + 55, PLATFORM_Y, 20, totalH);

  for (const s of steps) {
    const y = PLATFORM_Y + totalH * (1 - s / 6);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(PLATFORM_RIGHT + 55, y, s <= 1.8 ? 20 : 14, 1);
    ctx.fillStyle = s <= 1.8 ? '#e94560' : 'rgba(255,255,255,0.4)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(s + 'm', PLATFORM_RIGHT + 78, y + 4);
  }
}

function drawWorkerStanding() {
  const { x, y, state, walkPhase } = worker;
  const headY = y - 22;
  const bodyTop = y - 10;
  const bodyBot = y + 20;
  const falling = (state === STATE.FALLING);

  ctx.save();

  const sway = falling ? Math.sin(Date.now() / 80) * 6 : 0;
  ctx.translate(x + sway, 0);

  const hatGrad = ctx.createLinearGradient(0, headY - 16, 0, headY);
  hatGrad.addColorStop(0, '#ffd700');
  hatGrad.addColorStop(1, '#e6b800');
  ctx.fillStyle = hatGrad;
  ctx.beginPath();
  ctx.ellipse(0, headY - 4, 14, 6, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(-14, headY - 8, 28, 5);

  ctx.fillStyle = '#f0c8a0';
  ctx.beginPath();
  ctx.arc(0, headY + 4, 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#222';
  ctx.fillRect(-2, headY, 4, 3);
  ctx.fillRect(-2, headY + 6, 4, 3);
  ctx.fillRect(-10, headY + 9, 20, 4);
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(-3, headY + 3, 2, 2);
  ctx.fillRect(1, headY + 3, 2, 2);

  ctx.fillStyle = VEST_COLOR;
  ctx.fillRect(-10, bodyTop, 20, 30);
  ctx.fillStyle = VEST_STRIPE;
  ctx.fillRect(-10, bodyTop + 6, 20, 3);
  ctx.fillRect(-10, bodyTop + 16, 20, 3);

  ctx.fillStyle = '#f0c8a0';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';

  const armSwing = !falling ? Math.sin(walkPhase) * 15 : -30;
  ctx.beginPath();
  ctx.moveTo(-10, bodyTop + 4);
  ctx.lineTo(-18 - armSwing * 0.4, bodyTop + 12 + Math.abs(armSwing) * 0.2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(10, bodyTop + 4);
  ctx.lineTo(18 + armSwing * 0.4, bodyTop + 12 + Math.abs(armSwing) * 0.2);
  ctx.stroke();

  if (!falling) {
    ctx.strokeStyle = '#1a3a8a';
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(0, bodyTop + 2);
    ctx.lineTo(0, bodyTop - 16);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.strokeStyle = '#3a5a8a';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';

  const legSwing = !falling ? Math.sin(walkPhase) * 10 : 8;
  ctx.beginPath();
  ctx.moveTo(-4, bodyBot);
  ctx.lineTo(-8 + legSwing, bodyBot + 18);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(4, bodyBot);
  ctx.lineTo(8 - legSwing, bodyBot + 18);
  ctx.stroke();

  ctx.fillStyle = '#222';
  ctx.fillRect(-8 + legSwing - 2, bodyBot + 16, 5, 5);
  ctx.fillRect(8 - legSwing - 2, bodyBot + 16, 5, 5);

  ctx.restore();
}

function drawFallenWorker() {
  const lx = worker.landX;
  const ly = GROUND_Y - 12;

  ctx.save();

  const redPulse = Math.sin(Date.now() / 250) * 0.5 + 0.5;

  const glowGrad = ctx.createRadialGradient(lx + 5, ly, 3, lx + 5, ly, 55);
  glowGrad.addColorStop(0, `rgba(255, 20, 20, ${0.25 + redPulse * 0.3})`);
  glowGrad.addColorStop(0.4, `rgba(255, 0, 0, ${redPulse * 0.12})`);
  glowGrad.addColorStop(1, 'rgba(255, 0, 0, 0)');
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(lx + 5, ly, 55, 0, Math.PI * 2);
  ctx.fill();

  const pulseVestR = 255;
  const pulseVestG = Math.floor(102 * (1 - redPulse));
  const pulseVestColor = `rgb(${pulseVestR},${pulseVestG},0)`;
  const pulseStripeColor = `rgba(255,255,200,${0.4 + redPulse * 0.3})`;

  ctx.fillStyle = '#f0c8a0';
  ctx.beginPath();
  ctx.arc(lx - 8, ly - 5, 9, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#222';
  ctx.font = '7px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('x', lx - 11, ly - 3);
  ctx.fillText('x', lx - 5, ly - 3);

  ctx.fillStyle = pulseVestColor;
  ctx.beginPath();
  ctx.ellipse(lx - 20, ly + 4, 8, 3, 0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = pulseVestColor;
  ctx.beginPath();
  ctx.ellipse(lx + 5, ly - 2, 22, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = pulseStripeColor;
  ctx.beginPath();
  ctx.ellipse(lx + 2, ly - 5, 18, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(lx + 10, ly - 5, 18, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#3a5a8a';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(lx - 4, ly - 4);
  ctx.lineTo(lx - 16, ly - 10);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(lx + 12, ly - 4);
  ctx.lineTo(lx + 22, ly - 9);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(lx + 12, ly + 2);
  ctx.lineTo(lx + 22, ly + 16);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(lx + 18, ly + 2);
  ctx.lineTo(lx + 28, ly + 16);
  ctx.stroke();

  ctx.shadowColor = `rgba(255,0,0,${0.3 + redPulse * 0.4})`;
  ctx.shadowBlur = 18 + redPulse * 12;

  ctx.shadowBlur = 0;

  const stars = ['✦', '✧', '✦'];
  const t = Date.now() / 600;
  for (let i = 0; i < 3; i++) {
    const sx = lx - 25 + Math.sin(t + i * 2) * 14;
    const sy = ly - 30 + Math.cos(t + i * 2) * 8;
    ctx.fillStyle = `rgba(255,255,100,${0.4 + Math.sin(t + i) * 0.3})`;
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(stars[i], sx, sy);
  }

  ctx.restore();
}

function drawRescuer() {
  const { x, walkPhase, arrived, reacting, reactionTimer } = rescuer;
  const bodyBot = GROUND_Y - 12;
  const headY = bodyBot - 35;
  const bodyTop = bodyBot - 24;

  ctx.save();
  ctx.translate(x, 0);

  if (reacting) {
    const pop = Math.min(reactionTimer / 10, 1);
    const floatY = -8 - pop * 20 + Math.sin(Date.now() / 80) * 3;
    ctx.fillStyle = `rgba(255, 50, 50, ${pop})`;
    ctx.font = `${16 + pop * 8}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('❗', 0, headY + floatY);
  }

  const hatGrad = ctx.createLinearGradient(0, headY - 16, 0, headY);
  hatGrad.addColorStop(0, '#ffd700');
  hatGrad.addColorStop(1, '#e6b800');
  ctx.fillStyle = hatGrad;
  ctx.beginPath();
  ctx.ellipse(0, headY - 4, 14, 6, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(-14, headY - 8, 28, 5);

  ctx.fillStyle = '#f0c8a0';
  ctx.beginPath();
  ctx.arc(0, headY + 4, 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#222';
  ctx.fillRect(-2, headY, 4, 3);
  ctx.fillRect(-2, headY + 6, 4, 3);
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(-3, headY + 3, 2, 2);
  ctx.fillRect(1, headY + 3, 2, 2);

  ctx.fillStyle = VEST_COLOR;
  ctx.fillRect(-9, bodyTop, 18, 28);
  ctx.fillStyle = VEST_STRIPE;
  ctx.fillRect(-9, bodyTop + 8, 18, 3);
  ctx.fillRect(-9, bodyTop + 18, 18, 3);

  if (!arrived) {
    ctx.fillStyle = '#f0c8a0';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    const armSwing = Math.sin(walkPhase) * 12;
    ctx.beginPath();
    ctx.moveTo(-9, bodyTop + 6);
    ctx.lineTo(-18 - armSwing * 0.5, bodyTop + 14);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(9, bodyTop + 6);
    ctx.lineTo(18 + armSwing * 0.5, bodyTop + 14);
    ctx.stroke();

    ctx.strokeStyle = '#3a5a8a';
    ctx.lineWidth = 5;
    const legSwing = Math.sin(walkPhase) * 10;
    ctx.beginPath();
    ctx.moveTo(-4, bodyBot);
    ctx.lineTo(-8 + legSwing, bodyBot + 18);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(4, bodyBot);
    ctx.lineTo(8 - legSwing, bodyBot + 18);
    ctx.stroke();

    ctx.fillStyle = '#222';
    ctx.fillRect(-8 + legSwing - 2, bodyBot + 16, 5, 5);
    ctx.fillRect(8 - legSwing - 2, bodyBot + 16, 5, 5);

    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(rescuer.name, 0, bodyBot + 34);
  } else {
    const isPointing = (rescuePhase === PHASE.POINTING || rescuePhase === PHASE.AMBULANCE);

    ctx.fillStyle = '#f0c8a0';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(-9, bodyTop + 6);
    ctx.lineTo(-16, bodyTop + 16);
    ctx.stroke();

    if (isPointing) {
      ctx.beginPath();
      ctx.moveTo(9, bodyTop + 6);
      ctx.lineTo(28, bodyTop - 2);
      ctx.lineTo(30, bodyTop - 8);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(9, bodyTop + 6);
      ctx.lineTo(14, bodyTop - 2);
      ctx.stroke();
    }

    ctx.strokeStyle = '#3a5a8a';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-4, bodyBot);
    ctx.lineTo(-8, bodyBot + 18);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(4, bodyBot);
    ctx.lineTo(8, bodyBot + 18);
    ctx.stroke();

    ctx.fillStyle = '#222';
    ctx.fillRect(-10, bodyBot + 16, 5, 5);
    ctx.fillRect(6, bodyBot + 16, 5, 5);

    if (isPointing) {
      const pulse = 0.4 + Math.sin(Date.now() / 250) * 0.5;
      ctx.fillStyle = `rgba(255,80,80,${pulse})`;
      ctx.font = '28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🚑', 28, headY - 24);

      ctx.fillStyle = `rgba(255,200,100,${0.3 + Math.sin(Date.now() / 300) * 0.3})`;
      ctx.font = '8px sans-serif';
      ctx.fillText('Ambulance coming', 28, headY - 38);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(rescuer.name, 0, bodyBot + 34);
  }

  ctx.restore();
}

function drawAmbulance() {
  const ax = ambulance.x;
  const ay = GROUND_Y - 8;

  ctx.save();

  const bodyW = 110;
  const bodyH = 35;
  const wheelR = 8;

  ctx.fillStyle = '#fff';
  ctx.fillRect(ax - bodyW / 2, ay - bodyH, bodyW, bodyH);

  ctx.fillStyle = '#e94560';
  ctx.fillRect(ax - bodyW / 2, ay - bodyH + 6, bodyW, 4);
  ctx.fillRect(ax - bodyW / 2, ay - bodyH + 18, bodyW, 4);

  ctx.fillStyle = '#88ccff';
  ctx.fillRect(ax - bodyW / 2 + 4, ay - bodyH + 3, 18, 11);
  ctx.fillRect(ax - bodyW / 2 + 24, ay - bodyH + 3, 18, 11);

  ctx.fillStyle = '#555';
  ctx.fillRect(ax + bodyW / 2 - 8, ay - bodyH + 12, 4, 16);

  ctx.fillStyle = '#333';
  ctx.font = '7px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('AMBULANCE', ax, ay - bodyH + 28);

  if (ambulance.arrived && ambulance.doorOpen) {
    ctx.fillStyle = '#ddd';
    ctx.fillRect(ax - bodyW / 2, ay - bodyH + 2, 2, bodyH - 4);
  }

  if (ambulance.x < 900) {
    const lx = ax - bodyW / 2 + 10;
    const rx = ax + bodyW / 2 - 10;
    const lightH = ay - bodyH - 8;
    const t = Date.now() / 120;

    const leftRed = Math.max(0, Math.sin(t)) * 255;
    const leftBlue = Math.max(0, Math.sin(t + Math.PI)) * 180;
    const rightRed = Math.max(0, Math.sin(t + Math.PI)) * 255;
    const rightBlue = Math.max(0, Math.sin(t)) * 180;

    ctx.shadowColor = `rgb(${leftRed},0,0)`;
    ctx.shadowBlur = 10;
    ctx.fillStyle = `rgb(${leftRed},0,0)`;
    ctx.fillRect(lx - 5, lightH, 10, 6);
    ctx.shadowColor = `rgb(0,0,${leftBlue})`;
    ctx.fillStyle = `rgb(0,0,${leftBlue})`;
    ctx.fillRect(lx + 12, lightH, 10, 6);

    ctx.shadowColor = `rgb(${rightRed},0,0)`;
    ctx.fillStyle = `rgb(${rightRed},0,0)`;
    ctx.fillRect(rx - 22, lightH, 10, 6);
    ctx.shadowColor = `rgb(0,0,${rightBlue})`;
    ctx.fillStyle = `rgb(0,0,${rightBlue})`;
    ctx.fillRect(rx - 5, lightH, 10, 6);

    ctx.shadowBlur = 0;
  }

  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(ax - bodyW / 2 + 16, ay, wheelR, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(ax + bodyW / 2 - 16, ay, wheelR, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#444';
  ctx.beginPath();
  ctx.arc(ax - bodyW / 2 + 16, ay, wheelR - 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(ax + bodyW / 2 - 16, ay, wheelR - 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawParamedic(p, isSecond) {
  if (!p.active) return;

  const bodyBot = GROUND_Y - 12;
  const headY = bodyBot - 35;
  const bodyTop = bodyBot - 24;

  ctx.save();
  ctx.translate(p.x, 0);

  if (p.carrying) {
    const hatGrad = ctx.createLinearGradient(0, headY - 16, 0, headY);
    hatGrad.addColorStop(0, '#ffffff');
    hatGrad.addColorStop(1, '#d0d0d0');
    ctx.fillStyle = hatGrad;
    ctx.beginPath();
    ctx.ellipse(0, headY - 4, 13, 5, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(-13, headY - 8, 26, 5);

    ctx.fillStyle = '#e94560';
    ctx.fillRect(-5, headY - 13, 10, 7);
    ctx.fillRect(-2, headY - 15, 4, 5);

    ctx.fillStyle = '#f0c8a0';
    ctx.beginPath();
    ctx.arc(0, headY + 4, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.fillRect(-8, bodyTop, 16, 28);

    ctx.fillStyle = '#e94560';
    ctx.fillRect(-2, bodyTop + 10, 4, 6);

    ctx.fillStyle = '#f0c8a0';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(-8, bodyTop + 6);
    ctx.lineTo(-14, bodyTop + 20);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(8, bodyTop + 6);
    ctx.lineTo(14, bodyTop + 20);
    ctx.stroke();

    ctx.strokeStyle = '#3a5a8a';
    ctx.lineWidth = 5;
    const legSwing = Math.sin(p.walkPhase) * 6;
    ctx.beginPath();
    ctx.moveTo(-3, bodyBot);
    ctx.lineTo(-6 + legSwing, bodyBot + 16);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(3, bodyBot);
    ctx.lineTo(6 - legSwing, bodyBot + 16);
    ctx.stroke();

    ctx.fillStyle = '#222';
    ctx.fillRect(-6 + legSwing - 1, bodyBot + 14, 4, 5);
    ctx.fillRect(6 - legSwing - 1, bodyBot + 14, 4, 5);
  } else {
    const hatGrad = ctx.createLinearGradient(0, headY - 16, 0, headY);
    hatGrad.addColorStop(0, '#ffffff');
    hatGrad.addColorStop(1, '#d0d0d0');
    ctx.fillStyle = hatGrad;
    ctx.beginPath();
    ctx.ellipse(0, headY - 4, 14, 6, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(-14, headY - 8, 28, 5);

    ctx.fillStyle = '#e94560';
    ctx.fillRect(-5, headY - 14, 10, 8);
    ctx.fillRect(-2, headY - 16, 4, 6);

    ctx.fillStyle = '#f0c8a0';
    ctx.beginPath();
    ctx.arc(0, headY + 4, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.fillRect(-8, bodyTop, 16, 28);

    ctx.fillStyle = '#e94560';
    ctx.fillRect(-2, bodyTop + 10, 4, 6);

    ctx.fillStyle = '#f0c8a0';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    const armSwing = Math.sin(p.walkPhase) * 10;
    ctx.beginPath();
    ctx.moveTo(-8, bodyTop + 6);
    ctx.lineTo(-16 - armSwing * 0.4, bodyTop + 14);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(8, bodyTop + 6);
    ctx.lineTo(16 + armSwing * 0.4, bodyTop + 14);
    ctx.stroke();

    ctx.strokeStyle = '#3a5a8a';
    ctx.lineWidth = 5;
    const legSwing = Math.sin(p.walkPhase) * 8;
    ctx.beginPath();
    ctx.moveTo(-3, bodyBot);
    ctx.lineTo(-6 + legSwing, bodyBot + 16);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(3, bodyBot);
    ctx.lineTo(6 - legSwing, bodyBot + 16);
    ctx.stroke();

    ctx.fillStyle = '#222';
    ctx.fillRect(-6 + legSwing - 1, bodyBot + 14, 4, 5);
    ctx.fillRect(6 - legSwing - 1, bodyBot + 14, 4, 5);
  }

  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '7px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(isSecond ? 'Medic 2' : 'Medic 1', 0, bodyBot + 22);

  ctx.restore();
}

function drawParamedics() {
  drawParamedic(para1, false);
  drawParamedic(para2, true);
}

function drawStretcher() {
  const x1 = para1.x;
  const x2 = para2.x;
  const cx = (x1 + x2) / 2;
  const sy = GROUND_Y - 18;

  ctx.save();

  ctx.fillStyle = '#ddd';
  ctx.fillRect(cx - 22, sy - 4, 44, 6);
  ctx.fillStyle = '#bbb';
  ctx.fillRect(cx - 24, sy - 2, 48, 3);
  ctx.fillStyle = '#999';
  ctx.fillRect(cx - 24, sy + 2, 48, 2);

  ctx.fillStyle = '#555';
  ctx.fillRect(cx - 24, sy - 3, 2, 6);
  ctx.fillRect(cx + 22, sy - 3, 2, 6);

  ctx.fillStyle = '#f0c8a0';
  ctx.beginPath();
  ctx.ellipse(cx, sy - 8, 6, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = VEST_COLOR;
  ctx.fillRect(cx - 7, sy - 3, 14, 6);

  ctx.fillStyle = VEST_STRIPE;
  ctx.fillRect(cx - 7, sy - 1, 14, 2);

  ctx.fillStyle = '#3a5a8a';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 6, sy);
  ctx.lineTo(cx - 14, sy + 4);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 6, sy);
  ctx.lineTo(cx + 14, sy + 4);
  ctx.stroke();

  ctx.fillStyle = '#ffd700';
  ctx.beginPath();
  ctx.ellipse(cx, sy - 13, 7, 3, 0, Math.PI, 0);
  ctx.fill();

  ctx.restore();
}

function drawPhaseOverlay() {
  const name = PHASE_NAMES[rescuePhase];
  if (!name) return;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  const rx = W / 2 - 110, ry = 8, rw = 220, rh = 28;
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(rx, ry, rw, rh, 6);
    ctx.fill();
  } else {
    ctx.fillRect(rx, ry, rw, rh);
  }

  const pulse = rescuePhase === PHASE.COMPLETE
    ? 0.5 + Math.sin(Date.now() / 200) * 0.5
    : 0.8 + Math.sin(Date.now() / 400) * 0.2;
  ctx.fillStyle = `rgba(255,255,255,${pulse})`;
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, W / 2, 22);
  ctx.restore();
}

const particles = [];

function spawnDust(x, y) {
  for (let i = 0; i < 20; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 6,
      vy: -Math.random() * 4 - 1,
      life: 1,
      decay: 0.015 + Math.random() * 0.02,
      size: 2 + Math.random() * 4,
      color: `hsl(35, ${20 + Math.random() * 30}%, ${40 + Math.random() * 30}%)`,
      type: 'dust',
    });
  }
}

function spawnSparkles(x, y) {
  for (let i = 0; i < 30; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 3;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1,
      life: 1,
      decay: 0.01 + Math.random() * 0.015,
      size: 2 + Math.random() * 4,
      hue: 60 + Math.random() * 40,
      type: 'sparkle',
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    if (p.type === 'dust') p.vy += 0.05;
    else p.vy += 0.02;
    p.life -= p.decay;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life);
    if (p.type === 'dust') {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === 'sparkle') {
      const s = p.size * p.life;
      ctx.translate(p.x, p.y);
      ctx.rotate(Date.now() / 300 + p.x);
      ctx.fillStyle = `hsl(${p.hue}, 100%, ${60 + p.life * 30}%)`;
      ctx.shadowColor = `hsl(${p.hue}, 100%, 70%)`;
      ctx.shadowBlur = 6;
      ctx.font = `${s * 3}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✦', 0, 0);
    }
    ctx.restore();
  }
}

function updateWorker() {
  if (worker.state === STATE.WORKING) {
    worker.x += worker.vx;
    worker.walkPhase += 0.05;

    if (phase2Active && phase2Stage <= 2) {
      if (worker.x > 550) { worker.x = 550; worker.vx = -worker.vx; }
      if (worker.x < 60) { worker.x = 60; worker.vx = -worker.vx; }
    } else {
      const lb = PLATFORM_LEFT + 30;
      const rb = PLATFORM_RIGHT - 30;
      if (worker.x > rb) { worker.x = rb; worker.vx = -worker.vx; }
      if (worker.x < lb) { worker.x = lb; worker.vx = -worker.vx; }
    }
  }

  if (worker.state === STATE.FALLING) {
    worker.vy += 0.3;
    worker.y += worker.vy;

    if (worker.y > GROUND_Y - 20) {
      worker.y = GROUND_Y - 20;
      worker.vy = 0;
      worker.state = STATE.DOWN;
      worker.landX = worker.x;
      knockedOut = true;
      spawnDust(worker.x, GROUND_Y);

      rescuer.active = true;
      rescuer.reacting = true;
      rescuer.reactionTimer = 0;
      rescuer.arrived = false;
      rescuer.targetX = worker.x;

      triggerAlarm();
    }
  }
}

function updateRescuer() {
  if (!rescuer.active) return;

  if (rescuer.reacting) {
    rescuer.reactionTimer++;
    if (rescuer.reactionTimer > 50) {
      rescuer.reacting = false;
    }
    return;
  }

  if (!rescuer.arrived) {
    rescuer.x -= WALK_SPEED;
    rescuer.walkPhase += 0.06;
    if (rescuer.x <= rescuer.targetX + 30) {
      rescuer.x = rescuer.targetX + 30;
      rescuer.arrived = true;
      rescuePhase = PHASE.POINTING;
      phaseTimer = 0;
    }
  }
}

function updateAmbulance() {
  if (rescuePhase !== PHASE.AMBULANCE) return;

  phaseTimer++;

  if (!ambulance.arrived) {
    ambulance.x -= AMBULANCE_SPEED;
    if (ambulance.x <= ambulance.targetX) {
      ambulance.x = ambulance.targetX;
      ambulance.arrived = true;
      phaseTimer = 0;
      playSirenSound();
    }
  } else {
    if (phaseTimer > 50 && !ambulance.doorOpen) {
      ambulance.doorOpen = true;
      phaseTimer = 0;
      rescuePhase = PHASE.PARAMEDICS;
      para1.active = true;
      para1.x = ambulance.x - 55;
      para1.targetX = worker.landX + 20;
      para1.exitDelay = 0;
      para2.active = true;
      para2.x = ambulance.x - 55;
      para2.targetX = worker.landX - 10;
      para2.exitDelay = 30;
    }
  }
}

function updateParamedics() {
  if (rescuePhase !== PHASE.PARAMEDICS && rescuePhase !== PHASE.CARRYING && rescuePhase !== PHASE.LOADING) return;

  [para1, para2].forEach((p, i) => {
    if (!p.active) return;

    if (p.exitDelay > 0) {
      p.exitDelay--;
      p.x = ambulance.x - 55;
      return;
    }

    if (rescuePhase === PHASE.PARAMEDICS && !p.arrived) {
      p.x -= WALK_SPEED * 0.9;
      p.walkPhase += 0.06;

      if (p.x <= p.targetX) {
        p.x = p.targetX;
        p.arrived = true;
      }
    }

    if (rescuePhase === PHASE.CARRYING && p.arrived && !p.carryDone) {
      p.x += WALK_SPEED * 0.7;
      p.walkPhase += 0.05;
      p.carrying = true;

      if (p.x >= p.targetBackX) {
        p.x = p.targetBackX;
        p.carryDone = true;
      }
    }
  });

  const bothArrived = para1.arrived && para2.arrived;

  if (bothArrived && rescuePhase === PHASE.PARAMEDICS) {
    rescuePhase = PHASE.CARRYING;
    phaseTimer = 0;
    worker.state = STATE.RESCUING;

    [para1, para2].forEach((p, i) => {
      p.targetBackX = ambulance.x - 25 + i * 16;
      p.carrying = false;
      p.carryDone = false;
    });
  }

  if (rescuePhase === PHASE.CARRYING) {
    phaseTimer++;
  }

  const bothDone = para1.carryDone && para2.carryDone;
  if (bothDone && rescuePhase === PHASE.CARRYING) {
    rescuePhase = PHASE.LOADING;
    phaseTimer = 0;
    ambulance.doorOpen = false;
  }

  if (rescuePhase === PHASE.LOADING) {
    phaseTimer++;
    if (phaseTimer > 40) {
      rescuePhase = PHASE.DEPARTING;
      phaseTimer = 0;
    }
  }
}

function startFall() {
  if (alarmed || worker.state !== STATE.WORKING || phase2Active) return;
  worker.state = STATE.FALLING;
  worker.fallStartY = worker.y;
  worker.vy = 0;
  updateStatusUI('danger');
}

function screenShake() {
  const container = document.getElementById('scene-container');
  container.classList.add('shaking');
  setTimeout(() => container.classList.remove('shaking'), 600);
  try {
    const actx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = actx.createOscillator();
    const gain = actx.createGain();
    osc.connect(gain);
    gain.connect(actx.destination);
    osc.frequency.value = 55;
    osc.type = 'sawtooth';
    gain.gain.setValueAtTime(0.2, actx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.3);
    osc.start();
    osc.stop(actx.currentTime + 0.3);
  } catch (e) {}
}

function triggerAlarm() {
  if (alarmed) return;
  alarmed = true;

  screenShake();

  document.getElementById('status-badge').textContent = '🔴 Alarm';
  document.getElementById('status-badge').className = 'value danger';

  playAlarmSound();
}

function playAlarmSound() {
  try {
    const actx = new (window.AudioContext || window.webkitAudioContext)();
    let count = 0;
    const beep = () => {
      if (count > 10) return;
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.connect(gain);
      gain.connect(actx.destination);
      osc.frequency.value = count % 2 === 0 ? 880 : 660;
      osc.type = 'square';
      gain.gain.value = 0.15;
      gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.2);
      osc.start();
      osc.stop(actx.currentTime + 0.2);
      count++;
      setTimeout(beep, 400);
    };
    beep();
  } catch (e) {}
}

function playSirenSound() {
  if (sirenPlaying) return;
  sirenPlaying = true;
  try {
    const actx = new (window.AudioContext || window.webkitAudioContext)();
    let count = 0;
    const next = () => {
      if (count > 16 || !sirenPlaying) return;
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.connect(gain);
      gain.connect(actx.destination);
      osc.frequency.value = count % 2 === 0 ? 600 : 900;
      osc.type = 'sawtooth';
      gain.gain.value = 0.08;
      gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.25);
      osc.start();
      osc.stop(actx.currentTime + 0.25);
      count++;
      setTimeout(next, 300);
    };
    next();
  } catch (e) {}
}

function playChimeSound() {
  try {
    const actx = new (window.AudioContext || window.webkitAudioContext)();
    [523, 659, 784].forEach((freq, i) => {
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.connect(gain);
      gain.connect(actx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.2, actx.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + i * 0.15 + 0.4);
      osc.start(actx.currentTime + i * 0.15);
      osc.stop(actx.currentTime + i * 0.15 + 0.4);
    });
  } catch (e) {}
}

function resetScene() {
  if (animId) cancelAnimationFrame(animId);

  alarmed = false;
  knockedOut = false;
  sirenPlaying = false;
  rescuePhase = PHASE.NONE;
  phaseTimer = 0;

  worker.x = 200;
  worker.y = PLATFORM_Y - 35;
  worker.vx = 0.8;
  worker.vy = 0;
  worker.state = STATE.WORKING;
  worker.walkPhase = 0;
  worker.landX = 200;

  rescuer.active = false;
  rescuer.arrived = false;
  rescuer.reacting = false;
  rescuer.reactionTimer = 0;
  rescuer.x = 658;
  rescuer.targetX = 200;
  rescuer.walkPhase = 0;

  ambulance.x = 900;
  ambulance.arrived = false;
  ambulance.doorOpen = false;

  [para1, para2].forEach(p => {
    p.x = 900;
    p.active = false;
    p.arrived = false;
    p.carrying = false;
    p.carryDone = false;
    p.exitDelay = 0;
    p.walkPhase = 0;
    p.targetBackX = 0;
  });

  document.getElementById('status-badge').textContent = '🟢 Safe';
  document.getElementById('status-badge').className = 'value safe';
  document.getElementById('btn-step-phase').disabled = true;
  particles.length = 0;
  phase2Active = false;
  phase2Timer = 0;
  phase2Stage = 0;
  phase2CompleteDelay = 0;
  fallingObj.active = false;
  fallingObj.vy = 0;
  lookout.alerted = false;
  lookout.reacting = false;
  lookout.reactionTimer = 0;
  transitionOverlayActive = false;
  transitionOverlayTimer = 0;
  updateHeightDisplay();
  loop();
}

function updateStatusUI(state) {
  const badge = document.getElementById('status-badge');
  if (state === 'safe') {
    badge.textContent = '🟢 Safe';
    badge.className = 'value safe';
  } else if (state === 'danger') {
    badge.textContent = '🟡 Risk';
    badge.className = 'value danger';
  }
}

function updateHeightDisplay() {
  const refY = worker.state >= STATE.DOWN ? GROUND_Y - 20 : worker.y;
  const h = Math.max(0, ((GROUND_Y - refY) / PX_PER_METER)).toFixed(1);
  document.getElementById('height-display').textContent = h + 'm';
}

function update() {
  frameTime++;
  updateWorker();
  updateRescuer();
  updateAmbulance();
  updateParamedics();
  updateParticles();
  if (phase2Active) {
    updatePhase2();
  }

  if (rescuePhase === PHASE.POINTING) {
    phaseTimer++;
    if (phaseTimer > 120) {
      rescuePhase = PHASE.AMBULANCE;
      phaseTimer = 0;
    }
  }

  if (rescuePhase === PHASE.DEPARTING) {
    phaseTimer++;
    ambulance.x += AMBULANCE_SPEED;
    if (ambulance.x > 950) {
      rescuePhase = PHASE.COMPLETE;
      worker.state = STATE.RESCUED;
      document.getElementById('status-badge').textContent = '✅ Rescued';
      document.getElementById('status-badge').className = 'value safe';
      spawnSparkles(ambulance.x - 55, GROUND_Y - 40);
      playChimeSound();
    }
  }

  updateHeightDisplay();

  if (rescuePhase === PHASE.COMPLETE && !phase2Active && !transitionOverlayActive) {
    phase2CompleteDelay++;
    if (phase2CompleteDelay > 180) {
      transitionOverlayActive = true;
    }
  }

  if (rescuePhase === PHASE.COMPLETE && !phase2Active) {
    ctx.save();
    const pulse = 0.4 + Math.sin(Date.now() / 300) * 0.5;
    ctx.fillStyle = `rgba(80,255,120,${pulse})`;
    ctx.font = '36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('💚', ambulance.targetX + 30, GROUND_Y - 60);
    ctx.restore();
  }
}

function startPhase2() {
  phase2Active = true;
  phase2Timer = 0;
  phase2Stage = 1;

  worker.x = 100;
  worker.y = GROUND_Y - 37;
  worker.vx = 1.0;
  worker.state = STATE.WORKING;
  worker.walkPhase = 0;

  rescuer.active = false;
  ambulance.x = 900;
  ambulance.arrived = false;
  ambulance.doorOpen = false;
  [para1, para2].forEach(p => {
    p.x = 900;
    p.active = false;
    p.arrived = false;
    p.carrying = false;
    p.carryDone = false;
  });

  fallingObj.x = 260;
  fallingObj.y = PLATFORM_Y - 20;
  fallingObj.vy = 0;
  fallingObj.active = false;

  lookout.alerted = false;
  lookout.reacting = false;
  lookout.reactionTimer = 0;

  document.getElementById('status-badge').textContent = '🟢 Safe';
  document.getElementById('status-badge').className = 'value safe';
}

function updatePhase2() {
  phase2Timer++;

  if (phase2Stage === 1) {
    if (phase2Timer > 180) {
      phase2Stage = 2;
      phase2Timer = 0;
      fallingObj.active = true;
      const dist = (worker.y - 22) - (PLATFORM_Y - 30);
      const fallTime = Math.sqrt(2 * dist / 0.5);
      fallingObj.x = Math.max(70, Math.min(540, worker.x + worker.vx * fallTime + (Math.random() * 8 - 4)));
      fallingObj.y = PLATFORM_Y - 30;
      fallingObj.vy = 0;
    }
  }

  if (phase2Stage === 2) {
    fallingObj.vy += 0.5;
    fallingObj.y += fallingObj.vy;

    const workerHeadY = worker.y - 22;
    if (fallingObj.y >= workerHeadY && Math.abs(fallingObj.x - worker.x) < 12) {
      phase2Stage = 3;
      phase2Timer = 0;
      fallingObj.active = false;
      worker.state = STATE.DOWN;
      worker.landX = worker.x;
      knockedOut = true;
      spawnDust(worker.x, GROUND_Y);
      screenShake();
      updateStatusUI('danger');
    }

    if (fallingObj.y > GROUND_Y) {
      fallingObj.active = false;
    }
  }

  if (phase2Stage === 3) {
    lookout.reacting = true;
    lookout.reactionTimer++;

    if (lookout.reactionTimer > 50) {
      phase2Stage = 4;
      phase2Timer = 0;
      lookout.alerted = true;
    }
  }

  if (phase2Stage === 4) {
    phase2Timer++;
    if (phase2Timer > 60) {
      phase2Stage = 5;
      alarmed = false;
      rescuePhase = PHASE.NONE;
      rescuer.active = true;
      rescuer.reacting = true;
      rescuer.reactionTimer = 0;
      rescuer.arrived = false;
      rescuer.x = 658;
      rescuer.targetX = worker.landX || worker.x;
      rescuer.walkPhase = 0;
      triggerAlarm();
    }
  }
}

function drawPhase2() {
  if (phase2Stage >= 1) {
    const lx = lookout.x;
    const ly = PLATFORM_Y - 35;
    const headY = ly - 22;
    const bodyTop = ly - 10;

    ctx.save();

    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.ellipse(lx, headY - 4, 12, 5, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(lx - 12, headY - 8, 24, 5);

    ctx.fillStyle = '#f0c8a0';
    ctx.beginPath();
    ctx.arc(lx, headY + 4, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = VEST_COLOR;
    ctx.fillRect(lx - 8, bodyTop, 16, 24);
    ctx.fillStyle = VEST_STRIPE;
    ctx.fillRect(lx - 8, bodyTop + 6, 16, 3);
    ctx.fillRect(lx - 8, bodyTop + 14, 16, 3);

    ctx.strokeStyle = '#3a5a8a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(lx - 3, bodyTop + 24);
    ctx.lineTo(lx - 6, bodyTop + 36);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(lx + 3, bodyTop + 24);
    ctx.lineTo(lx + 6, bodyTop + 36);
    ctx.stroke();

    if (lookout.reacting) {
      const pop = Math.min(lookout.reactionTimer / 15, 1);
      ctx.fillStyle = `rgba(255, 50, 50, ${pop})`;
      ctx.font = `${16 + pop * 8}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('❗', lx, headY - 20);
    }

    ctx.restore();
  }

  if (fallingObj.active) {
    ctx.save();
    const sx = fallingObj.x;
    const sy = fallingObj.y;

    const pipeLen = 45;
    const pipeW = 5;
    const angle = Math.atan2(fallingObj.vy, 1) + Math.PI / 2;

    ctx.translate(sx, sy);
    ctx.rotate(angle);

    const grad = ctx.createLinearGradient(-pipeW, 0, pipeW, 0);
    grad.addColorStop(0, '#5a5a5a');
    grad.addColorStop(0.25, '#9a9a9a');
    grad.addColorStop(0.5, '#c8c8c8');
    grad.addColorStop(0.75, '#9a9a9a');
    grad.addColorStop(1, '#4a4a4a');

    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(-pipeW, -pipeLen / 2, pipeW * 2, pipeLen, pipeW);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    ctx.strokeStyle = '#3a3a3a';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.roundRect(-pipeW, -pipeLen / 2, pipeW * 2, pipeLen, pipeW);
    ctx.stroke();

    ctx.fillStyle = '#888';
    ctx.beginPath();
    ctx.ellipse(0, -pipeLen / 2, pipeW - 1, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#444';
    ctx.beginPath();
    ctx.ellipse(0, -pipeLen / 2, pipeW - 3, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

function drawTransitionOverlay() {
  ctx.save();

  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#1a1a2e';
  const bx = W / 2 - 220, by = H / 2 - 44, bw = 440, bh = 88;
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 10);
    ctx.fill();
  } else {
    ctx.fillRect(bx, by, bw, bh);
  }

  ctx.strokeStyle = '#0f3460';
  ctx.lineWidth = 2;
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 10);
    ctx.stroke();
  } else {
    ctx.strokeRect(bx, by, bw, bh);
  }

  ctx.fillStyle = '#e94560';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PRÓXIMA CENA', W / 2, H / 2 - 20);

  ctx.fillStyle = '#eee';
  ctx.font = '15px sans-serif';
  ctx.fillText('Queda de objeto na área do trabalhador', W / 2, H / 2 + 8);

  ctx.fillStyle = '#888';
  ctx.font = '11px sans-serif';
  ctx.fillText('Clique em qualquer lugar para continuar', W / 2, H / 2 + 32);

  ctx.restore();
}

function loop() {
  try {
    update();
    drawScene();
  } catch (e) {
    console.error('Animation error:', e);
  }
  animId = requestAnimationFrame(loop);
}

document.getElementById('btn-trigger-fall').addEventListener('click', startFall);
document.getElementById('btn-reset').addEventListener('click', resetScene);

canvas.addEventListener('click', () => {
  if (transitionOverlayActive) {
    transitionOverlayActive = false;
    startPhase2();
  }
});

loop();
