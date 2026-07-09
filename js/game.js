import * as THREE from "./vendor/three.module.js";

// ---------- Field constants ----------
const FIELD_HALF_X = 40;
const FIELD_HALF_Z = 26;
const GOAL_HALF_WIDTH = 5;
const GOAL_HEIGHT = 5;
const GOAL_DEPTH = 2;
const BALL_RADIUS = 0.35;
const PLAYER_RADIUS = 0.6;
const GRAVITY = 18;
const MATCH_SECONDS = 90;

// ---------- DOM ----------
const container = document.getElementById("game");
const scoreEl = document.getElementById("score");
const timerEl = document.getElementById("timer");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayText = document.getElementById("overlay-text");
const startBtn = document.getElementById("start-btn");

// ---------- Renderer / scene / camera ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fd0ff);
scene.fog = new THREE.Fog(0x8fd0ff, 60, 140);

const camera = new THREE.PerspectiveCamera(60, 900 / 560, 0.1, 300);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

function resize() {
  const w = container.clientWidth || 900;
  const h = container.clientHeight || 560;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);

// ---------- Lights ----------
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const sun = new THREE.DirectionalLight(0xffffff, 0.9);
sun.position.set(30, 50, 20);
scene.add(sun);

// ---------- Pitch ----------
function createPitchTexture() {
  const W = 1024, H = Math.round((1024 * (FIELD_HALF_Z * 2)) / (FIELD_HALF_X * 2));
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");

  const stripes = 10;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#1c7a37" : "#186c30";
    ctx.fillRect((i * W) / stripes, 0, W / stripes, H);
  }

  const toX = (x) => ((x + FIELD_HALF_X) / (FIELD_HALF_X * 2)) * W;
  const toY = (z) => ((z + FIELD_HALF_Z) / (FIELD_HALF_Z * 2)) * H;

  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 4;

  ctx.strokeRect(toX(-FIELD_HALF_X), toY(-FIELD_HALF_Z), toX(FIELD_HALF_X) - toX(-FIELD_HALF_X), toY(FIELD_HALF_Z) - toY(-FIELD_HALF_Z));

  ctx.beginPath();
  ctx.moveTo(toX(0), toY(-FIELD_HALF_Z));
  ctx.lineTo(toX(0), toY(FIELD_HALF_Z));
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(toX(0), toY(0), toX(9) - toX(0), 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(toX(0), toY(0), 3, 0, Math.PI * 2);
  ctx.fillStyle = "white";
  ctx.fill();

  [-1, 1].forEach((side) => {
    const edgeX = side * FIELD_HALF_X;
    const boxDepth = 16;
    const boxHalf = 11;
    const gaDepth = 6;
    const gaHalf = 6.5;
    const x0 = toX(edgeX);
    const x1 = toX(edgeX - side * boxDepth);
    const y0 = toY(-boxHalf);
    const y1 = toY(boxHalf);
    ctx.strokeRect(Math.min(x0, x1), y0, Math.abs(x1 - x0), y1 - y0);

    const gx1 = toX(edgeX - side * gaDepth);
    const gy0 = toY(-gaHalf);
    const gy1 = toY(gaHalf);
    ctx.strokeRect(Math.min(x0, gx1), gy0, Math.abs(gx1 - x0), gy1 - gy0);

    ctx.beginPath();
    ctx.arc(toX(edgeX - side * 9), toY(0), 3, 0, Math.PI * 2);
    ctx.fillStyle = "white";
    ctx.fill();
  });

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  return tex;
}

const pitchMat = new THREE.MeshStandardMaterial({ map: createPitchTexture(), roughness: 1 });
const pitch = new THREE.Mesh(new THREE.PlaneGeometry(FIELD_HALF_X * 2 + 4, FIELD_HALF_Z * 2 + 4), pitchMat);
pitch.rotation.x = -Math.PI / 2;
scene.add(pitch);

function buildGoal(sideSign, color) {
  const group = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const postGeo = new THREE.CylinderGeometry(0.12, 0.12, GOAL_HEIGHT, 10);

  const left = new THREE.Mesh(postGeo, postMat);
  left.position.set(0, GOAL_HEIGHT / 2, -GOAL_HALF_WIDTH);
  const right = new THREE.Mesh(postGeo, postMat);
  right.position.set(0, GOAL_HEIGHT / 2, GOAL_HALF_WIDTH);

  const barGeo = new THREE.CylinderGeometry(0.12, 0.12, GOAL_HALF_WIDTH * 2, 10);
  const bar = new THREE.Mesh(barGeo, postMat);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, GOAL_HEIGHT, 0);

  const netMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, side: THREE.DoubleSide, wireframe: true });
  const net = new THREE.Mesh(new THREE.BoxGeometry(GOAL_DEPTH, GOAL_HEIGHT, GOAL_HALF_WIDTH * 2, 6, 6, 6), netMat);
  net.position.set(-sideSign * GOAL_DEPTH / 2, GOAL_HEIGHT / 2, 0);

  group.add(left, right, bar, net);
  group.position.set(sideSign * FIELD_HALF_X, 0, 0);
  return group;
}
scene.add(buildGoal(1));
scene.add(buildGoal(-1));

// ---------- Entities ----------
function makePlayerMesh(color) {
  const g = new THREE.Group();
  const bodyGeo = THREE.CapsuleGeometry
    ? new THREE.CapsuleGeometry(PLAYER_RADIUS, 1.1, 4, 8)
    : new THREE.CylinderGeometry(PLAYER_RADIUS, PLAYER_RADIUS, 1.7, 8);
  const body = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ color }));
  body.position.y = 1.1;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 10), new THREE.MeshStandardMaterial({ color: 0xffd9b3 }));
  head.position.y = 1.95;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.4, 8), new THREE.MeshStandardMaterial({ color: 0xffe066 }));
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 1.1, 0.6);
  g.add(body, head, nose);
  return g;
}

const ball = new THREE.Mesh(
  new THREE.SphereGeometry(BALL_RADIUS, 16, 16),
  new THREE.MeshStandardMaterial({ color: 0xffffff })
);
scene.add(ball);
const ballState = { pos: new THREE.Vector3(0, BALL_RADIUS, 0), vel: new THREE.Vector3(0, 0, 0) };

const player = {
  mesh: makePlayerMesh(0x2266ff),
  pos: new THREE.Vector3(-15, 0, 0),
  facing: Math.PI / 2,
  speed: 0,
  chargeStart: 0,
  charging: false,
};
scene.add(player.mesh);

const OPP_COLOR = 0xdd3333;
const opponents = [
  { mesh: makePlayerMesh(OPP_COLOR), pos: new THREE.Vector3(10, 0, -7), home: new THREE.Vector3(10, 0, -7), cooldown: 0 },
  { mesh: makePlayerMesh(OPP_COLOR), pos: new THREE.Vector3(10, 0, 7), home: new THREE.Vector3(10, 0, 7), cooldown: 0 },
  { mesh: makePlayerMesh(OPP_COLOR), pos: new THREE.Vector3(28, 0, 0), home: new THREE.Vector3(28, 0, 0), cooldown: 0 },
];
opponents.forEach((o) => scene.add(o.mesh));

// ---------- Input ----------
const keys = { up: false, down: false, left: false, right: false, sprint: false, kick: false };
window.addEventListener("keydown", (e) => setKey(e, true));
window.addEventListener("keyup", (e) => setKey(e, false));
function setKey(e, down) {
  switch (e.code) {
    case "ArrowUp": case "KeyW": case "KeyZ": keys.up = down; break;
    case "ArrowDown": case "KeyS": keys.down = down; break;
    case "ArrowLeft": case "KeyA": case "KeyQ": keys.left = down; break;
    case "ArrowRight": case "KeyD": keys.right = down; break;
    case "ShiftLeft": case "ShiftRight": keys.sprint = down; break;
    case "Space":
      if (down && !keys.kick) { player.charging = true; player.chargeStart = performance.now(); }
      if (!down && player.charging) { player.charging = false; tryKick(); }
      keys.kick = down;
      e.preventDefault();
      break;
  }
}

// ---------- Game state ----------
let running = false;
let timeLeft = MATCH_SECONDS;
let score = { player: 0, ai: 0 };
let lastTime = performance.now();

function resetKickoff() {
  ballState.pos.set(0, BALL_RADIUS, 0);
  ballState.vel.set(0, 0, 0);
  player.pos.set(-15, 0, 0);
  player.facing = Math.PI / 2;
  const homes = [new THREE.Vector3(10, 0, -7), new THREE.Vector3(10, 0, 7), new THREE.Vector3(28, 0, 0)];
  opponents.forEach((o, i) => { o.pos.copy(homes[i]); o.cooldown = 0.5; });
}
resetKickoff();

function startGame() {
  score = { player: 0, ai: 0 };
  timeLeft = MATCH_SECONDS;
  resetKickoff();
  updateHud();
  overlay.classList.remove("visible");
  running = true;
  lastTime = performance.now();
}
startBtn.addEventListener("click", startGame);

function endGame() {
  running = false;
  overlayTitle.textContent = score.player > score.ai ? "Victoire !" : score.player < score.ai ? "Défaite" : "Match nul";
  overlayText.innerHTML = `Score final : <strong>${score.player} - ${score.ai}</strong>`;
  startBtn.textContent = "Rejouer";
  overlay.classList.add("visible");
}

function updateHud() {
  scoreEl.textContent = `${score.player} - ${score.ai}`;
  const m = Math.floor(timeLeft / 60);
  const s = Math.floor(timeLeft % 60);
  timerEl.textContent = `${m}:${s.toString().padStart(2, "0")}`;
}

function clampToField(v) {
  v.x = THREE.MathUtils.clamp(v.x, -FIELD_HALF_X - 1, FIELD_HALF_X + 1);
  v.z = THREE.MathUtils.clamp(v.z, -FIELD_HALF_Z - 1, FIELD_HALF_Z + 1);
}

function tryKick() {
  const dist = player.pos.distanceTo(new THREE.Vector3(ballState.pos.x, 0, ballState.pos.z));
  if (dist > 1.4) return;
  const held = Math.min(performance.now() - player.chargeStart, 900);
  const power = 8 + (held / 900) * 18;
  const dir = new THREE.Vector3(Math.sin(player.facing), 0, Math.cos(player.facing));
  ballState.vel.x = dir.x * power;
  ballState.vel.z = dir.z * power;
  ballState.vel.y = 3 + (held / 900) * 6;
}

function updatePlayer(dt) {
  let dx = 0, dz = 0;
  if (keys.up) dz -= 1;
  if (keys.down) dz += 1;
  if (keys.left) dx -= 1;
  if (keys.right) dx += 1;
  const moving = dx !== 0 || dz !== 0;
  let speed = 0;
  if (moving) {
    const len = Math.hypot(dx, dz);
    dx /= len; dz /= len;
    const targetAngle = Math.atan2(dx, dz);
    let diff = targetAngle - player.facing;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    player.facing += diff * Math.min(1, dt * 10);
    speed = keys.sprint ? 11 : 7;
    player.pos.x += dx * speed * dt;
    player.pos.z += dz * speed * dt;
    clampToField(player.pos);
  }

  const toBall = new THREE.Vector3(ballState.pos.x - player.pos.x, 0, ballState.pos.z - player.pos.z);
  const d = toBall.length();
  const dir = new THREE.Vector3(Math.sin(player.facing), 0, Math.cos(player.facing));
  if (player.charging && d < 1.3 && ballState.pos.y < 1.2) {
    const desiredX = player.pos.x + dir.x * 0.7;
    const desiredZ = player.pos.z + dir.z * 0.7;
    ballState.pos.x = THREE.MathUtils.lerp(ballState.pos.x, desiredX, 0.5);
    ballState.pos.z = THREE.MathUtils.lerp(ballState.pos.z, desiredZ, 0.5);
    ballState.vel.x = 0;
    ballState.vel.z = 0;
  } else if (moving && d < 1.3 && !player.charging && ballState.pos.y < 1.2) {
    const desiredX = player.pos.x + dir.x * 0.9;
    const desiredZ = player.pos.z + dir.z * 0.9;
    ballState.pos.x = THREE.MathUtils.lerp(ballState.pos.x, desiredX, 0.4);
    ballState.pos.z = THREE.MathUtils.lerp(ballState.pos.z, desiredZ, 0.4);
    ballState.vel.x = dir.x * speed;
    ballState.vel.z = dir.z * speed;
  }

  player.mesh.position.set(player.pos.x, 0, player.pos.z);
  player.mesh.rotation.y = player.facing;
}

function updateOpponents(dt) {
  const targetGoal = new THREE.Vector3(-FIELD_HALF_X, 0, 0);
  opponents.forEach((o) => {
    o.cooldown = Math.max(0, o.cooldown - dt);
    const toBall = new THREE.Vector3(ballState.pos.x - o.pos.x, 0, ballState.pos.z - o.pos.z);
    const distToBall = toBall.length();
    const shouldChase = distToBall < 16;
    const target = shouldChase ? new THREE.Vector3(ballState.pos.x, 0, ballState.pos.z) : o.home;
    const dir = new THREE.Vector3(target.x - o.pos.x, 0, target.z - o.pos.z);
    const dl = dir.length();
    let speed = 0;
    if (dl > 0.2) {
      dir.normalize();
      speed = shouldChase ? 6.5 : 3.5;
      o.pos.x += dir.x * speed * dt;
      o.pos.z += dir.z * speed * dt;
      clampToField(o.pos);
      o.mesh.rotation.y = Math.atan2(dir.x, dir.z);
    }
    o.mesh.position.set(o.pos.x, 0, o.pos.z);

    if (distToBall < 1.2 && ballState.pos.y < 1.2) {
      if (o.cooldown <= 0) {
        const aim = new THREE.Vector3(targetGoal.x - o.pos.x, 0, targetGoal.z - o.pos.z + (Math.random() - 0.5) * 4).normalize();
        ballState.vel.x = aim.x * (distToBall < 20 ? 14 : 9);
        ballState.vel.z = aim.z * (distToBall < 20 ? 14 : 9);
        ballState.vel.y = distToBall < 20 ? 4 : 1.5;
        o.cooldown = 1.2 + Math.random();
      } else {
        const pushDir = new THREE.Vector3(Math.sin(o.mesh.rotation.y), 0, Math.cos(o.mesh.rotation.y));
        const desiredX = o.pos.x + pushDir.x * 0.9;
        const desiredZ = o.pos.z + pushDir.z * 0.9;
        ballState.pos.x = THREE.MathUtils.lerp(ballState.pos.x, desiredX, 0.4);
        ballState.pos.z = THREE.MathUtils.lerp(ballState.pos.z, desiredZ, 0.4);
        ballState.vel.x = pushDir.x * speed;
        ballState.vel.z = pushDir.z * speed;
      }
    }
  });
}

function updateBall(dt) {
  ballState.vel.y -= GRAVITY * dt;
  ballState.pos.x += ballState.vel.x * dt;
  ballState.pos.y += ballState.vel.y * dt;
  ballState.pos.z += ballState.vel.z * dt;

  if (ballState.pos.y <= BALL_RADIUS) {
    ballState.pos.y = BALL_RADIUS;
    if (ballState.vel.y < 0) ballState.vel.y = -ballState.vel.y * 0.45;
    if (Math.abs(ballState.vel.y) < 0.6) ballState.vel.y = 0;
    const friction = Math.pow(0.06, dt);
    ballState.vel.x *= friction;
    ballState.vel.z *= friction;
  }

  if (Math.abs(ballState.pos.z) > FIELD_HALF_Z - BALL_RADIUS) {
    ballState.pos.z = THREE.MathUtils.clamp(ballState.pos.z, -FIELD_HALF_Z + BALL_RADIUS, FIELD_HALF_Z - BALL_RADIUS);
    ballState.vel.z *= -0.5;
  }

  const inGoalMouth = Math.abs(ballState.pos.z) < GOAL_HALF_WIDTH && ballState.pos.y < GOAL_HEIGHT;
  if (ballState.pos.x > FIELD_HALF_X + BALL_RADIUS) {
    if (inGoalMouth) { onGoal("player"); }
    else { ballState.pos.x = FIELD_HALF_X - 1; ballState.vel.set(0, 0, 0); }
  } else if (ballState.pos.x < -FIELD_HALF_X - BALL_RADIUS) {
    if (inGoalMouth) { onGoal("ai"); }
    else { ballState.pos.x = -FIELD_HALF_X + 1; ballState.vel.set(0, 0, 0); }
  }

  ball.position.copy(ballState.pos);
}

function onGoal(who) {
  score[who]++;
  updateHud();
  resetKickoff();
}

// ---------- Camera ----------
const camPos = new THREE.Vector3(-15, 8, -14);
const camTarget = new THREE.Vector3();
function updateCamera(dt) {
  const dir = new THREE.Vector3(Math.sin(player.facing), 0, Math.cos(player.facing));
  const desired = new THREE.Vector3(
    player.pos.x - dir.x * 11,
    6.5,
    player.pos.z - dir.z * 11
  );
  camPos.lerp(desired, Math.min(1, dt * 4));
  camera.position.copy(camPos);
  camTarget.lerp(new THREE.Vector3(player.pos.x + dir.x * 4, 1, player.pos.z + dir.z * 4), Math.min(1, dt * 6));
  camera.lookAt(camTarget);
}

// ---------- Loop ----------
function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;

  if (running) {
    updatePlayer(dt);
    updateOpponents(dt);
    updateBall(dt);
    timeLeft -= dt;
    if (timeLeft <= 0) {
      timeLeft = 0;
      updateHud();
      endGame();
    } else {
      updateHud();
    }
  }
  updateCamera(dt);
  renderer.render(scene, camera);
}

resize();
updateHud();
requestAnimationFrame(tick);
