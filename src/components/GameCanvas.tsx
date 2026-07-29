import { useEffect, useRef } from "react";
import { Direction, GRID_SIZE, Phase, Position, PowerUp, PowerUpType } from "../game/snake";
import { audio } from "../audio/engine";

export interface FxEvent {
  type: "eat" | "die" | "level" | "powerup";
  x: number;
  y: number;
  at: number;
  powerType?: PowerUpType;
}

export interface RenderData {
  snake: Position[];
  prevSnake: Position[];
  lastTickAt: number;
  speedMs: number;
  food: Position;
  obstacles: Position[];
  phase: Phase;
  direction: Direction;
  powerUp: PowerUp | null;
  powerUpActive: PowerUpType | null;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  rotate: number;
  rotateSpeed: number;
}

interface TrailPoint {
  x: number;
  y: number;
  age: number;
}

const CELL = 30;
const SIZE = GRID_SIZE * CELL;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const hsl = (h: number, s: number, l: number) => `hsl(${h} ${s}% ${l}%)`;

const COLORS = {
  gridA: "#031b14",
  gridB: "#052922",
  gridLine: "rgba(52,211,153,0.06)",
  obstacle: "#0f2523",
  obstacleLight: "rgba(94,234,212,0.28)",
  foodCore: "#f43f5e",
  foodInner: "#fda4af",
  leaf: "#4ade80",
  stem: "#a16207",
  invincible: "rgba(251,191,36,0.6)",
  magnet: "rgba(99,102,241,0.6)",
  slow: "rgba(56,189,248,0.6)",
};

export default function GameCanvas({
  dataRef,
  fxRef,
}: {
  dataRef: React.MutableRefObject<RenderData>;
  fxRef: React.MutableRefObject<FxEvent[]>;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    const logicalSize = SIZE;

    const particles: Particle[] = [];
    let rings: { x: number; y: number; at: number; hue: number }[] = [];
    let shakeAt = -Infinity;
    let raf = 0;
    let trail: TrailPoint[] = [];

    const spawnBurst = (
      cx: number, cy: number, palette: number[],
      count: number, speed: number,
    ) => {
      for (let i = 0; i < count; i++) {
        const a = (Math.PI * 2 * i) / count + Math.random() * 0.7;
        const v = speed * (0.4 + Math.random() * 1.1);
        particles.push({
          x: cx, y: cy,
          vx: Math.cos(a) * v, vy: Math.sin(a) * v,
          life: 0, maxLife: 0.4 + Math.random() * 0.55,
          size: 2.2 + Math.random() * 4.5,
          color: `hsl(${palette[Math.floor(Math.random() * palette.length)]} 90% 60%)`,
          rotate: Math.random() * Math.PI * 2,
          rotateSpeed: (Math.random() - 0.5) * 12,
        });
      }
    };

    const consumeFx = () => {
      const events = fxRef.current;
      while (events.length > 0) {
        const e = events.shift()!;
        const cx = e.x * CELL + CELL / 2;
        const cy = e.y * CELL + CELL / 2;
        if (e.type === "eat") {
          spawnBurst(cx, cy, [40, 50, 330, 15, 70], 22, 170);
          rings.push({ x: cx, y: cy, at: performance.now(), hue: 45 });
        } else if (e.type === "die") {
          spawnBurst(cx, cy, [140, 90, 0, 340], 38, 280);
          shakeAt = performance.now();
        } else if (e.type === "level") {
          spawnBurst(cx, cy, [50, 170, 190, 280], 34, 220);
          rings.push({ x: cx, y: cy, at: performance.now(), hue: 170 });
        } else if (e.type === "powerup") {
          spawnBurst(cx, cy, [40, 50, 280, 190], 26, 200);
          rings.push({ x: cx, y: cy, at: performance.now(), hue: 280 });
        }
      }
    };

    const drawBackground = (now: number) => {
      const beat = audio.getBeat();
      const pulseMag = 0.03 * Math.sin(beat * Math.PI);
      const g = ctx.createRadialGradient(
        logicalSize / 2, logicalSize / 2,
        logicalSize * 0.1,
        logicalSize / 2, logicalSize / 2,
        logicalSize * (0.75 + pulseMag),
      );
      g.addColorStop(0, "#042318");
      g.addColorStop(0.6, "#02100c");
      g.addColorStop(1, "#010a07");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, logicalSize, logicalSize);

      const pulseCell = beat % 2 === 0 ? 1.08 : 1;
      for (let x = 0; x < GRID_SIZE; x++) {
        for (let y = 0; y < GRID_SIZE; y++) {
          const lit = (x + y) % 2 === 0;
          let fill = lit ? COLORS.gridA : COLORS.gridB;
          if (pulseCell > 1 && (x % 2 === 0 && y % 2 === 0)) {
            const alpha = (pulseCell - 1) * 0.5;
            fill = `rgba(52,211,153,${alpha})`;
          }
          ctx.fillStyle = fill;
          ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
        }
      }

      ctx.strokeStyle = COLORS.gridLine;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 1; i < GRID_SIZE; i++) {
        ctx.moveTo(i * CELL, 0);
        ctx.lineTo(i * CELL, logicalSize);
        ctx.moveTo(0, i * CELL);
        ctx.lineTo(logicalSize, i * CELL);
      }
      ctx.stroke();

      // Sweep lumineux
      const sweepY = ((now / 7000) % 1.5 - 0.25) * logicalSize;
      const sweep = ctx.createLinearGradient(0, sweepY - 110, 0, sweepY + 110);
      sweep.addColorStop(0, "rgba(52,211,153,0)");
      sweep.addColorStop(0.5, `rgba(52,211,153,${0.07 + pulseMag * 0.5})`);
      sweep.addColorStop(1, "rgba(52,211,153,0)");
      ctx.fillStyle = sweep;
      ctx.fillRect(0, 0, logicalSize, logicalSize);
    };

    const drawObstacles = (obstacles: Position[]) => {
      for (const o of obstacles) {
        const x = o.x * CELL;
        const y = o.y * CELL;
        const r = 7;

        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath();
        ctx.roundRect(x + 3, y + 3, CELL - 6, CELL - 6, r);
        ctx.fill();

        const grad = ctx.createLinearGradient(x, y, x, y + CELL);
        grad.addColorStop(0, "#1a3634");
        grad.addColorStop(1, "#0a1c1a");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x + 2, y + 2, CELL - 4, CELL - 4, r);
        ctx.fill();

        ctx.strokeStyle = COLORS.obstacleLight;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(x + 2, y + 2, CELL - 4, CELL - 4, r);
        ctx.stroke();

        const hl = ctx.createLinearGradient(x, y, x, y + CELL * 0.55);
        hl.addColorStop(0, "rgba(148,163,184,0.25)");
        hl.addColorStop(1, "rgba(148,163,184,0)");
        ctx.fillStyle = hl;
        ctx.beginPath();
        ctx.roundRect(x + 2, y + 2, CELL - 4, CELL - 4, r);
        ctx.fill();
      }
    };

    const drawFood = (food: Position, now: number) => {
      const cx = food.x * CELL + CELL / 2;
      const cy = food.y * CELL + CELL / 2;
      const pulse = 1 + Math.sin(now / 190) * 0.13;
      const r = CELL * 0.32 * pulse;

      const outer = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, CELL * 1.2);
      outer.addColorStop(0, "rgba(244,63,94,0.55)");
      outer.addColorStop(0.5, "rgba(244,63,94,0.18)");
      outer.addColorStop(1, "rgba(244,63,94,0)");
      ctx.fillStyle = outer;
      ctx.fillRect(cx - CELL * 1.2, cy - CELL * 1.2, CELL * 2.4, CELL * 2.4);

      const apple = ctx.createRadialGradient(
        cx - r * 0.3, cy - r * 0.3, r * 0.15, cx, cy, r,
      );
      apple.addColorStop(0, COLORS.foodInner);
      apple.addColorStop(0.5, COLORS.foodCore);
      apple.addColorStop(1, "#9f1239");
      ctx.fillStyle = apple;
      ctx.beginPath();
      ctx.arc(cx, cy + 1, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.beginPath();
      ctx.ellipse(cx - r * 0.3, cy - r * 0.3, r * 0.22, r * 0.12, -0.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = COLORS.leaf;
      ctx.beginPath();
      ctx.ellipse(cx + r * 0.35, cy - r - 3, r * 0.45, r * 0.18, -0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = COLORS.stem;
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx, cy - r + 2);
      ctx.quadraticCurveTo(cx + 2.5, cy - r - 5, cx + 6, cy - r - 6);
      ctx.stroke();
    };

    const drawPowerUp = (powerUp: PowerUp, now: number) => {
      const cx = powerUp.position.x * CELL + CELL / 2;
      const cy = powerUp.position.y * CELL + CELL / 2;
      const pulse = 1 + Math.sin(now / 120) * 0.15;
      const r = CELL * 0.35 * pulse;

      let color: string;
      let symbol: string;
      switch (powerUp.type) {
        case "invincible":
          color = COLORS.invincible;
          symbol = "★";
          break;
        case "magnet":
          color = COLORS.magnet;
          symbol = "🧲";
          break;
        case "slow":
          color = COLORS.slow;
          symbol = "⏱";
          break;
      }

      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, CELL * 1.5);
      glow.addColorStop(0, color);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(cx - CELL * 1.5, cy - CELL * 1.5, CELL * 3, CELL * 3);

      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.beginPath();
      ctx.arc(cx, cy + 2, r, 0, Math.PI * 2);
      ctx.fill();

      const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.5, powerUp.type === "invincible" ? "#fbbf24" : powerUp.type === "magnet" ? "#818cf8" : "#38bdf8");
      grad.addColorStop(1, powerUp.type === "invincible" ? "#b45309" : powerUp.type === "magnet" ? "#4338ca" : "#0369a1");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.beginPath();
      ctx.arc(cx - r * 0.25, cy - r * 0.25, r * 0.25, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#fff";
      ctx.font = `${r * 1.1}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(symbol, cx, cy);
    };

    const interpolatedSnake = (d: RenderData, now: number): { x: number; y: number }[] => {
      const t = Math.max(0, Math.min(1, (now - d.lastTickAt) / d.speedMs));
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i < d.snake.length; i++) {
        const cur = d.snake[i];
        const prev = d.prevSnake[Math.min(i, d.prevSnake.length - 1)] ?? cur;
        const wrapped = Math.abs(cur.x - prev.x) > 1 || Math.abs(cur.y - prev.y) > 1;
        const px = wrapped ? cur.x : lerp(prev.x, cur.x, t);
        const py = wrapped ? cur.y : lerp(prev.y, cur.y, t);
        pts.push({ x: px * CELL + CELL / 2, y: py * CELL + CELL / 2 });
      }
      return pts;
    };

    const drawTrail = (now: number) => {
      for (const pt of trail) {
        const alpha = Math.max(0, 1 - pt.age / 300);
        ctx.fillStyle = `rgba(52,211,153,${alpha * 0.15})`;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, CELL * 0.2 * alpha, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawSnake = (d: RenderData, now: number) => {
      const pts = interpolatedSnake(d, now);
      if (pts.length === 0) return;
      const n = pts.length;
      const dead = d.phase === "gameover";

      ctx.save();
      ctx.shadowBlur = 18;
      ctx.shadowColor = d.powerUpActive === "invincible"
        ? "rgba(251,191,36,0.8)"
        : dead ? "rgba(248,113,113,0.55)" : "rgba(132,204,22,0.65)";

      for (let i = n - 1; i >= 0; i--) {
        const k = n === 1 ? 0 : i / (n - 1);
        const radius = CELL * (0.48 - k * 0.11);
        const h = dead ? lerp(8, 0, k) : d.powerUpActive === "invincible" ? lerp(45, 60, k) : lerp(78, 155, k);
        const s = dead ? 95 : d.powerUpActive === "invincible" ? 95 : 92;
        const l = dead ? lerp(78, 50, k) : lerp(70, 40, k);
        const color = hsl(h, s, l);

        if (i < n - 1) {
          const a = pts[i];
          const b = pts[i + 1];
          if (Math.hypot(a.x - b.x, a.y - b.y) < CELL * 1.7) {
            ctx.strokeStyle = color;
            ctx.lineWidth = radius * 2;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(pts[i].x, pts[i].y, radius, 0, Math.PI * 2);
        ctx.fill();

        if (i > 0) {
          ctx.fillStyle = "rgba(255,255,255,0.09)";
          ctx.beginPath();
          ctx.arc(pts[i].x, pts[i].y - radius * 0.35, radius * 0.22, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      const head = pts[0];
      const dir = d.direction;
      const dx = dir === "LEFT" ? -1 : dir === "RIGHT" ? 1 : 0;
      const dy = dir === "UP" ? -1 : dir === "DOWN" ? 1 : 0;
      const ex = -dy;
      const ey = dx;
      const eyeOff = CELL * 0.19;
      const fwd = CELL * 0.14;

      for (const s of [-1, 1]) {
        const exo = head.x + ex * eyeOff * s + dx * fwd;
        const eyo = head.y + ey * eyeOff * s + dy * fwd;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(exo, eyo, CELL * 0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#052e16";
        ctx.beginPath();
        ctx.arc(exo + dx * 1.8, eyo + dy * 1.8, CELL * 0.065, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!dead && Math.sin(now / 160) > 0.45) {
        const tx = head.x + dx * CELL * 0.52;
        const ty = head.y + dy * CELL * 0.52;
        ctx.strokeStyle = "#fb7185";
        ctx.lineWidth = 2.2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx + dx * 7 + ex * 3, ty + dy * 7 + ey * 3);
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx + dx * 7 - ex * 3, ty + dy * 7 - ey * 3);
        ctx.stroke();
      }
    };

    const drawParticles = (dt: number) => {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += dt;
        if (p.life >= p.maxLife) {
          particles.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 150 * dt;
        p.vx *= 0.985;
        p.rotate += p.rotateSpeed * dt;
        const alpha = 1 - p.life / p.maxLife;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotate);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10 * alpha;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    };

    const drawRings = (now: number) => {
      rings = rings.filter((r) => now - r.at < 650);
      for (const r of rings) {
        const t = (now - r.at) / 650;
        ctx.save();
        ctx.globalAlpha = 1 - t;
        ctx.strokeStyle = `hsl(${r.hue} 90% 60%)`;
        ctx.lineWidth = 4 * (1 - t);
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(r.x, r.y, t * CELL * 2.6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    };

    const drawVignette = () => {
      const v = ctx.createRadialGradient(
        logicalSize / 2, logicalSize / 2, logicalSize * 0.3,
        logicalSize / 2, logicalSize / 2, logicalSize * 0.78,
      );
      v.addColorStop(0, "rgba(0,0,0,0)");
      v.addColorStop(1, "rgba(0,0,0,0.45)");
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, logicalSize, logicalSize);
    };

    const drawPowerUpIndicator = (type: PowerUpType, now: number) => {
      const pulse = Math.abs(Math.sin(now / 200));
      ctx.save();
      ctx.fillStyle = type === "invincible"
        ? `rgba(251,191,36,${pulse * 0.3})`
        : type === "magnet"
          ? `rgba(99,102,241,${pulse * 0.3})`
          : `rgba(56,189,248,${pulse * 0.3})`;
      ctx.fillRect(0, 0, logicalSize, 4);
      ctx.restore();
    };

    let last = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      consumeFx();
      const d = dataRef.current;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Screen shake
      const sinceShake = now - shakeAt;
      if (sinceShake < 650) {
        const amp = 14 * (1 - sinceShake / 650);
        ctx.translate(
          (Math.random() - 0.5) * amp * 2,
          (Math.random() - 0.5) * amp * 2,
        );
      }

      drawBackground(now);
      drawObstacles(d.obstacles);

      // Trail
      if (d.snake.length > 0 && d.phase === "running") {
        const head = d.snake[0];
        trail.push({ x: head.x * CELL + CELL / 2, y: head.y * CELL + CELL / 2, age: 0 });
        for (let i = trail.length - 1; i >= 0; i--) {
          trail[i].age += dt * 1000;
          if (trail[i].age > 300) trail.splice(i, 1);
        }
      } else if (d.phase !== "running") {
        trail = [];
      }
      drawTrail(now);

      if (d.phase !== "menu") drawFood(d.food, now);
      if (d.powerUp) drawPowerUp(d.powerUp, now);
      drawSnake(d, now);
      if (d.powerUpActive) drawPowerUpIndicator(d.powerUpActive, now);
      drawRings(now);
      drawParticles(dt);
      drawVignette();
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [dataRef, fxRef]);

  return (
    <canvas
      ref={canvasRef}
      className="block h-auto w-full rounded-2xl"
      style={{ aspectRatio: "1 / 1", touchAction: "none" }}
      aria-label="Plateau de jeu Snake"
    />
  );
}
