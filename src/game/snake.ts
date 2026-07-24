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

export interface LevelDef {
  name: string;
  baseSpeed: number;
  applesToClear: number;
  obstacles: Position[];
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
}

export const GRID_SIZE = 20;
export const MIN_SPEED = 65;
export const SPEED_STEP = 5;

/* ------------------------------------------------------------------ */
/* Niveaux                                                             */
/* ------------------------------------------------------------------ */

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
      ...rect(3, 3, 4, 4),
      ...rect(15, 3, 16, 4),
      ...rect(3, 15, 4, 16),
      ...rect(15, 15, 16, 16),
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
      ...rect(10, 2, 10, 5),
      ...rect(10, 14, 10, 17),
      ...rect(2, 10, 3, 10),
      ...rect(16, 10, 17, 10),
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
      // anneau intérieur avec passages
      ...rect(3, 3, 8, 3),
      ...rect(11, 3, 16, 3),
      ...rect(3, 16, 8, 16),
      ...rect(11, 16, 16, 16),
      ...rect(3, 4, 3, 8),
      ...rect(3, 11, 3, 15),
      ...rect(16, 4, 16, 8),
      ...rect(16, 11, 16, 15),
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Utilitaires                                                         */
/* ------------------------------------------------------------------ */

export const opposite = (dir: Direction): Direction => {
  switch (dir) {
    case "UP":
      return "DOWN";
    case "DOWN":
      return "UP";
    case "LEFT":
      return "RIGHT";
    case "RIGHT":
      return "LEFT";
  }
};

export const movePosition = (pos: Position, dir: Direction): Position => {
  switch (dir) {
    case "UP":
      return { x: pos.x, y: pos.y - 1 };
    case "DOWN":
      return { x: pos.x, y: pos.y + 1 };
    case "LEFT":
      return { x: pos.x - 1, y: pos.y };
    case "RIGHT":
      return { x: pos.x + 1, y: pos.y };
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

/* ------------------------------------------------------------------ */
/* État                                                                */
/* ------------------------------------------------------------------ */

export const createInitialState = (
  wallsOn: boolean,
  highScore: number,
): GameState => {
  const level = LEVELS[0];
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
  };
};

/** Lance (ou relance) un niveau donné en conservant score et options. */
export const startLevel = (state: GameState, levelIndex: number): GameState => {
  const level = LEVELS[levelIndex];
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
  };
};

export const computeSpeed = (levelIndex: number, apples: number): number => {
  const base = LEVELS[levelIndex].baseSpeed;
  return Math.max(MIN_SPEED, base - apples * SPEED_STEP);
};

export const pointsForApple = (levelIndex: number): number =>
  10 * (levelIndex + 1);

/* ------------------------------------------------------------------ */
/* Tick                                                                */
/* ------------------------------------------------------------------ */

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
      nextHead.x < 0 ||
      nextHead.x >= GRID_SIZE ||
      nextHead.y < 0 ||
      nextHead.y >= GRID_SIZE
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

  // Collision avec un obstacle
  if (state.obstacles.some((p) => equalPos(p, nextHead))) {
    return {
      kind: "died",
      state: { ...state, direction, phase: "gameover" },
    };
  }

  const ate = equalPos(nextHead, state.food);
  const body = ate ? state.snake : state.snake.slice(0, -1);

  // Collision avec soi-même
  if (body.some((p) => equalPos(p, nextHead))) {
    return {
      kind: "died",
      state: { ...state, direction, phase: "gameover" },
    };
  }

  const newSnake = [nextHead, ...body];

  if (!ate) {
    return {
      kind: "moved",
      state: { ...state, snake: newSnake, direction },
    };
  }

  const level = LEVELS[state.levelIndex];
  const applesInLevel = state.applesInLevel + 1;
  const score = state.score + pointsForApple(state.levelIndex);
  const highScore = Math.max(state.highScore, score);

  // Niveau terminé ?
  if (applesInLevel >= level.applesToClear) {
    const isLast = state.levelIndex >= LEVELS.length - 1;
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
      },
    };
  }

  return {
    kind: "ate",
    state: {
      ...state,
      snake: newSnake,
      food: randomFreePosition([...newSnake, ...state.obstacles]),
      direction,
      score,
      highScore,
      applesInLevel,
      speedMs: computeSpeed(state.levelIndex, applesInLevel),
    },
  };
};

export const setDirection = (state: GameState, next: Direction): GameState => {
  if (opposite(state.direction) === next) return state;
  return { ...state, pendingDirection: next };
};
