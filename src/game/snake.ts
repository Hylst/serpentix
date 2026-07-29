export type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";

export interface Position {
  x: number;
  y: number;
}

export type Phase =
  | "menu"
  | "running"
  | "paused"
  | "levelup"
  | "gameover"
  | "victory";

export type PowerUpType = "invincible" | "magnet" | "slow";

export interface PowerUp {
  position: Position;
  type: PowerUpType;
}

export interface LevelDef {
  name: string;
  baseSpeed: number;
  applesToClear: number;
  obstacles: Position[];
}

export interface GameStats {
  totalApples: number;
  totalGames: number;
  maxLevel: number;
  totalTime: number;
}

export interface GameState {
  snake: Position[];
  food: Position;
  direction: Direction;
  pendingDirection: Direction;
  score: number;
  highScore: number;
  wallsOn: boolean;
  levelIndex: number;
  applesInLevel: number;
  obstacles: Position[];
  speedMs: number;
  phase: Phase;
  powerUp: PowerUp | null;
  powerUpActive: PowerUpType | null;
  powerUpTimer: number;
  turnJustChanged: boolean;
  stats: GameStats;
}

export const GRID_SIZE = 20;
export const MIN_SPEED = 65;
export const SPEED_STEP = 5;

const rect = (x0: number, y0: number, x1: number, y1: number): Position[] => {
  const out: Position[] = [];
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) out.push({ x, y });
  }
  return out;
};

export const LEVELS: LevelDef[] = [
  {
    name: "La Prairie",
    baseSpeed: 170,
    applesToClear: 6,
    obstacles: [],
  },
  {
    name: "Les Quatre Tours",
    baseSpeed: 158,
    applesToClear: 7,
    obstacles: [
      ...rect(3, 3, 4, 4), ...rect(15, 3, 16, 4),
      ...rect(3, 15, 4, 16), ...rect(15, 15, 16, 16),
    ],
  },
  {
    name: "Le Couloir",
    baseSpeed: 146,
    applesToClear: 8,
    obstacles: [...rect(4, 5, 15, 5), ...rect(4, 14, 15, 14)],
  },
  {
    name: "La Croix",
    baseSpeed: 136,
    applesToClear: 8,
    obstacles: [
      ...rect(10, 2, 10, 5), ...rect(10, 14, 10, 17),
      ...rect(2, 10, 3, 10), ...rect(16, 10, 17, 10),
    ],
  },
  {
    name: "Les Chicanes",
    baseSpeed: 126,
    applesToClear: 9,
    obstacles: [...rect(4, 0, 4, 13), ...rect(15, 6, 15, 19)],
  },
  {
    name: "Le Labyrinthe",
    baseSpeed: 118,
    applesToClear: 10,
    obstacles: [
      ...rect(3, 3, 8, 3), ...rect(11, 3, 16, 3),
      ...rect(3, 16, 8, 16), ...rect(11, 16, 16, 16),
      ...rect(3, 4, 3, 8), ...rect(3, 11, 3, 15),
      ...rect(16, 4, 16, 8), ...rect(16, 11, 16, 15),
    ],
  },
];

export const opposite = (dir: Direction): Direction => {
  switch (dir) {
    case "UP": return "DOWN";
    case "DOWN": return "UP";
    case "LEFT": return "RIGHT";
    case "RIGHT": return "LEFT";
  }
};

export const movePosition = (pos: Position, dir: Direction): Position => {
  switch (dir) {
    case "UP": return { x: pos.x, y: pos.y - 1 };
    case "DOWN": return { x: pos.x, y: pos.y + 1 };
    case "LEFT": return { x: pos.x - 1, y: pos.y };
    case "RIGHT": return { x: pos.x + 1, y: pos.y };
  }
};

export const equalPos = (a: Position, b: Position): boolean =>
  a.x === b.x && a.y === b.y;

export const randomFreePosition = (
  occupied: Position[],
  rng: () => number = Math.random,
): Position => {
  if (occupied.length >= GRID_SIZE * GRID_SIZE) {
    throw new Error("Grille pleine");
  }
  while (true) {
    const candidate: Position = {
      x: Math.floor(rng() * GRID_SIZE),
      y: Math.floor(rng() * GRID_SIZE),
    };
    if (!occupied.some((p) => equalPos(p, candidate))) {
      return candidate;
    }
  }
};

const startSnake = (): Position[] => {
  const cx = Math.floor(GRID_SIZE / 2);
  const cy = Math.floor(GRID_SIZE / 2);
  return [
    { x: cx, y: cy },
    { x: cx - 1, y: cy },
    { x: cx - 2, y: cy },
  ];
};

/* ---------------------------------------------------------------- */
/* Génération procédurale de niveaux                                 */
/* ---------------------------------------------------------------- */

const seededRandom = (seed: number): (() => number) => {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
};

const generateObstacles = (seed: number, count: number): Position[] => {
  const rng = seededRandom(seed);
  const obstacles: Position[] = [];
  const used = new Set<number>();
  for (let i = 0; i < count * 3; i++) {
    if (obstacles.length >= count) break;
    const x = Math.floor(rng() * (GRID_SIZE - 3)) + 1;
    const y = Math.floor(rng() * (GRID_SIZE - 3)) + 1;
    const w = Math.floor(rng() * 3) + 1;
    const h = Math.floor(rng() * 3) + 1;
    let ok = true;
    for (let dx = 0; dx < w && ok; dx++) {
      for (let dy = 0; dy < h && ok; dy++) {
        const cx = x + dx;
        const cy = y + dy;
        if (cx >= GRID_SIZE || cy >= GRID_SIZE) { ok = false; break; }
        const key = cy * GRID_SIZE + cx;
        if (used.has(key)) { ok = false; break; }
        if (cx >= 8 && cx <= 11 && cy >= 8 && cy <= 11) { ok = false; break; }
      }
    }
    if (!ok) continue;
    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < h; dy++) {
        const cx = x + dx;
        const cy = y + dy;
        used.add(cy * GRID_SIZE + cx);
        obstacles.push({ x: cx, y: cy });
      }
    }
  }
  return obstacles;
};

export const generateLevel = (index: number): LevelDef => {
  const baseSpeed = Math.max(90, 170 - (index - 5) * 10);
  const applesToClear = Math.min(15, 10 + Math.floor((index - 5) / 2));
  const obstacleCount = Math.min(35, 10 + (index - 5) * 3);
  return {
    name: `Génération ${index - 5}`,
    baseSpeed,
    applesToClear,
    obstacles: generateObstacles(index * 7919, obstacleCount),
  };
};

export const getLevel = (index: number): LevelDef => {
  if (index < LEVELS.length) return LEVELS[index];
  return generateLevel(index);
};

/* ---------------------------------------------------------------- */
/* Power-ups                                                         */
/* ---------------------------------------------------------------- */

const POWER_UP_TYPES: PowerUpType[] = ["invincible", "magnet", "slow"];
const POWER_UP_EVERY_N_APPLES = 3;
const POWER_UP_DURATION_TICKS = 30;

const spawnPowerUp = (
  snake: Position[],
  obstacles: Position[],
  food: Position,
  existingPowerUp: PowerUp | null,
  applesInLevel: number,
): PowerUp | null => {
  if (existingPowerUp) return existingPowerUp;
  if (applesInLevel === 0 || applesInLevel % POWER_UP_EVERY_N_APPLES !== 0) return null;
  const occupied = [...snake, ...obstacles, food];
  const pos = randomFreePosition(occupied);
  return {
    position: pos,
    type: POWER_UP_TYPES[Math.floor(Math.random() * POWER_UP_TYPES.length)],
  };
};

/* ---------------------------------------------------------------- */
/* État                                                              */
/* ---------------------------------------------------------------- */

const DEFAULT_STATS: GameStats = {
  totalApples: 0,
  totalGames: 0,
  maxLevel: 0,
  totalTime: 0,
};

export const createInitialState = (
  wallsOn: boolean,
  highScore: number,
  stats?: GameStats,
): GameState => {
  const level = getLevel(0);
  const snake = startSnake();
  return {
    snake,
    food: randomFreePosition([...snake, ...level.obstacles]),
    direction: "RIGHT",
    pendingDirection: "RIGHT",
    score: 0,
    highScore,
    wallsOn,
    levelIndex: 0,
    applesInLevel: 0,
    obstacles: level.obstacles,
    speedMs: level.baseSpeed,
    phase: "menu",
    powerUp: null,
    powerUpActive: null,
    powerUpTimer: 0,
    turnJustChanged: false,
    stats: stats ?? DEFAULT_STATS,
  };
};

export const startLevel = (state: GameState, levelIndex: number): GameState => {
  const level = getLevel(levelIndex);
  const snake = startSnake();
  return {
    ...state,
    snake,
    food: randomFreePosition([...snake, ...level.obstacles]),
    direction: "RIGHT",
    pendingDirection: "RIGHT",
    levelIndex,
    applesInLevel: 0,
    obstacles: level.obstacles,
    speedMs: level.baseSpeed,
    phase: "running",
    powerUp: null,
    powerUpActive: null,
    powerUpTimer: 0,
    turnJustChanged: false,
  };
};

export const computeSpeed = (levelIndex: number, apples: number): number => {
  const level = getLevel(levelIndex);
  return Math.max(MIN_SPEED, level.baseSpeed - apples * SPEED_STEP);
};

export const pointsForApple = (levelIndex: number): number =>
  10 * (levelIndex + 1);

/* ---------------------------------------------------------------- */
/* Tick                                                              */
/* ---------------------------------------------------------------- */

export type TickResult =
  | { kind: "moved"; state: GameState }
  | { kind: "ate"; state: GameState }
  | { kind: "died"; state: GameState }
  | { kind: "levelCleared"; state: GameState }
  | { kind: "victory"; state: GameState }
  | { kind: "noop" };

export const tick = (state: GameState): TickResult => {
  if (state.phase !== "running") return { kind: "noop" };

  const direction = state.pendingDirection;
  const head = state.snake[0];
  let nextHead = movePosition(head, direction);

  if (state.wallsOn) {
    if (
      nextHead.x < 0 || nextHead.x >= GRID_SIZE ||
      nextHead.y < 0 || nextHead.y >= GRID_SIZE
    ) {
      return {
        kind: "died",
        state: { ...state, direction, phase: "gameover" },
      };
    }
  } else {
    nextHead = {
      x: (nextHead.x + GRID_SIZE) % GRID_SIZE,
      y: (nextHead.y + GRID_SIZE) % GRID_SIZE,
    };
  }

  const invincible = state.powerUpActive === "invincible";

  if (!invincible && state.obstacles.some((p) => equalPos(p, nextHead))) {
    return {
      kind: "died",
      state: { ...state, direction, phase: "gameover" },
    };
  }

  const ate = equalPos(nextHead, state.food);
  const body = ate ? state.snake : state.snake.slice(0, -1);

  if (body.some((p) => equalPos(p, nextHead))) {
    return {
      kind: "died",
      state: { ...state, direction, phase: "gameover" },
    };
  }

  const newSnake = [nextHead, ...body];

  // Magnet: attract food toward head
  let food = state.food;
  const attracted = state.powerUpActive === "magnet" && !ate;
  if (attracted) {
    const dx = Math.sign(head.x - food.x);
    const dy = Math.sign(head.y - food.y);
    const newFood = { x: food.x + dx, y: food.y + dy };
    const occupied = [...newSnake, ...state.obstacles];
    if (
      newFood.x >= 0 && newFood.x < GRID_SIZE &&
      newFood.y >= 0 && newFood.y < GRID_SIZE &&
      !occupied.some((p) => equalPos(p, newFood))
    ) {
      food = newFood;
    }
  }

  // Power-up timer
  let powerUpActive = state.powerUpActive;
  let powerUpTimer = state.powerUpTimer;
  if (powerUpActive) {
    powerUpTimer--;
    if (powerUpTimer <= 0) powerUpActive = null;
  }

  // Collect power-up
  let atePowerUp = false;
  let newPowerUpType: PowerUpType | null = null;
  if (state.powerUp && equalPos(nextHead, state.powerUp.position)) {
    powerUpActive = state.powerUp.type;
    powerUpTimer = POWER_UP_DURATION_TICKS;
    atePowerUp = true;
    newPowerUpType = state.powerUp.type;
  }

  // Slow effect
  const speedMultiplier = powerUpActive === "slow" ? 0.5 : 1;

  if (!ate) {
    const occupied = [...newSnake, ...state.obstacles];
    const nextPowerUp = atePowerUp
      ? null
      : spawnPowerUp(newSnake, state.obstacles, food, null, state.applesInLevel);
    return {
      kind: "moved",
      state: {
        ...state,
        snake: newSnake,
        direction,
        food,
        powerUp: nextPowerUp,
        powerUpActive,
        powerUpTimer,
        speedMs: Math.round(state.speedMs * speedMultiplier),
        turnJustChanged: state.turnJustChanged,
      },
    };
  }

  const level = getLevel(state.levelIndex);
  const applesInLevel = state.applesInLevel + 1;
  const score = state.score + pointsForApple(state.levelIndex);
  const highScore = Math.max(state.highScore, score);

  const stats = {
    ...state.stats,
    totalApples: state.stats.totalApples + 1,
    totalGames: state.phase === "running" ? state.stats.totalGames : state.stats.totalGames,
  };

  if (applesInLevel >= level.applesToClear) {
    const isLast = state.levelIndex >= LEVELS.length - 1;
    const nextIndex = state.levelIndex + 1;
    return {
      kind: isLast ? "victory" : "levelCleared",
      state: {
        ...state,
        snake: newSnake,
        direction,
        score,
        highScore,
        applesInLevel,
        phase: isLast ? "victory" : "levelup",
        powerUp: null,
        powerUpActive: null,
        powerUpTimer: 0,
        stats,
      },
    };
  }

  const occupied = [...newSnake, ...state.obstacles];
  const nextPowerUp = spawnPowerUp(newSnake, state.obstacles, food, null, applesInLevel);

  return {
    kind: "ate",
    state: {
      ...state,
      snake: newSnake,
      food: randomFreePosition([...newSnake, ...state.obstacles, ...(nextPowerUp ? [nextPowerUp.position] : [])]),
      direction,
      score,
      highScore,
      applesInLevel,
      speedMs: Math.round(computeSpeed(state.levelIndex, applesInLevel) * speedMultiplier),
      powerUp: nextPowerUp,
      powerUpActive,
      powerUpTimer,
      stats,
    },
  };
};

export const setDirection = (state: GameState, next: Direction): GameState => {
  if (opposite(state.direction) === next) return state;
  return { ...state, pendingDirection: next, turnJustChanged: state.direction !== next };
};
