import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Direction,
  GameState,
  LEVELS,
  createInitialState,
  setDirection,
  startLevel,
  tick,
} from "./game/snake";
import GameCanvas, { FxEvent, RenderData } from "./components/GameCanvas";
import { audio } from "./audio/engine";

const HIGH_SCORE_KEY = "snake-neon-record-v3";

const loadHighScore = (): number => {
  try {
    const raw = localStorage.getItem(HIGH_SCORE_KEY);
    if (raw == null) return 0;
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    return 0;
  }
};

const persistHighScore = (score: number) => {
  try {
    localStorage.setItem(HIGH_SCORE_KEY, String(score));
  } catch {
    /* ignoré */
  }
};

/* ------------------------------------------------------------------ */
/* Composants UI réutilisables                                         */
/* ------------------------------------------------------------------ */

const panel =
  "rounded-2xl border border-emerald-800/50 bg-slate-950/60 shadow-2xl shadow-emerald-950/50 backdrop-blur-sm";

const Stat = ({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) => (
  <motion.div
    whileTap={{ scale: 0.97 }}
    className={[
      "rounded-xl border px-3 py-2.5 text-center backdrop-blur-sm transition",
      highlight
        ? "border-amber-400/50 bg-amber-400/10 shadow-[0_0_18px_rgba(251,191,36,0.18)]"
        : "border-emerald-800/60 bg-emerald-950/40",
    ].join(" ")}
  >
    <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-300/70">
      {label}
    </div>
    <div
      className={[
        "text-xl font-bold tabular-nums sm:text-2xl",
        highlight ? "text-amber-200" : "text-emerald-50",
      ].join(" ")}
    >
      {value}
    </div>
  </motion.div>
);

const IconToggle = ({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <motion.button
    type="button"
    aria-label={label}
    aria-pressed={active}
    title={label}
    onClick={onClick}
    whileTap={{ scale: 0.88 }}
    whileHover={{ scale: 1.06 }}
    className={[
      "flex h-10 w-10 items-center justify-center rounded-xl border transition",
      active
        ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-200 shadow-[0_0_14px_rgba(16,185,129,0.3)]"
        : "border-emerald-900/70 bg-emerald-950/50 text-emerald-500/60 hover:text-emerald-300",
    ].join(" ")}
  >
    {children}
  </motion.button>
);

const PrimaryButton = ({
  onClick,
  children,
  className = "",
}: {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) => (
  <motion.button
    type="button"
    onClick={onClick}
    whileHover={{ scale: 1.02, filter: "brightness(1.1)" }}
    whileTap={{ scale: 0.96 }}
    className={[
      "rounded-xl bg-gradient-to-br from-lime-300 via-emerald-400 to-emerald-600 px-6 py-3 font-black text-emerald-950 shadow-lg shadow-emerald-500/30 transition",
      className,
    ].join(" ")}
  >
    {children}
  </motion.button>
);

const GhostButton = ({
  onClick,
  children,
  className = "",
}: {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) => (
  <motion.button
    type="button"
    onClick={onClick}
    whileTap={{ scale: 0.96 }}
    whileHover={{ scale: 1.03 }}
    className={[
      "rounded-xl border border-emerald-700/60 bg-emerald-900/40 px-4 py-2.5 text-sm font-bold text-emerald-100 transition hover:bg-emerald-800/50",
      className,
    ].join(" ")}
  >
    {children}
  </motion.button>
);

/* ------------------------------------------------------------------ */
/* Application                                                         */
/* ------------------------------------------------------------------ */

export default function App() {
  const [state, setState] = useState<GameState>(() =>
    createInitialState(true, loadHighScore()),
  );
  const [musicOn, setMusicOn] = useState(true);
  const [sfxOn, setSfxOn] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [newRecord, setNewRecord] = useState(false);

  const shellRef = useRef<HTMLDivElement | null>(null);
  const prevSnakeRef = useRef(state.snake);
  const lastSnakeRef = useRef(state.snake);
  const prevScoreRef = useRef(state.score);
  const prevPhaseRef = useRef(state.phase);
  const lastFoodRef = useRef(state.food);
  const recordRef = useRef(state.highScore);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const renderRef = useRef<RenderData>({
    snake: state.snake,
    prevSnake: state.snake,
    lastTickAt: performance.now(),
    speedMs: state.speedMs,
    food: state.food,
    obstacles: state.obstacles,
    phase: state.phase,
    direction: state.direction,
  });
  const fxRef = useRef<FxEvent[]>([]);

  const phase = state.phase;
  const level = LEVELS[state.levelIndex];

  /* ----------------------------- Actions ----------------------------- */

  const startGame = useCallback(() => {
    audio.unlock();
    audio.playClick();
    if (musicOn) audio.startMusic();
    setNewRecord(false);
    setState((prev) =>
      startLevel(
        { ...createInitialState(prev.wallsOn, prev.highScore) },
        0,
      ),
    );
  }, [musicOn]);

  const nextLevel = useCallback(() => {
    audio.playClick();
    setState((prev) =>
      prev.phase === "levelup" ? startLevel(prev, prev.levelIndex + 1) : prev,
    );
  }, []);

  const togglePause = useCallback(() => {
    setState((prev) => {
      if (prev.phase === "running") {
        audio.playPause();
        return { ...prev, phase: "paused" };
      }
      if (prev.phase === "paused") {
        audio.playClick();
        return { ...prev, phase: "running" };
      }
      return prev;
    });
  }, []);

  const toggleWalls = useCallback(() => {
    audio.playClick();
    setState((prev) => ({ ...prev, wallsOn: !prev.wallsOn }));
  }, []);

  const onDirection = useCallback((dir: Direction) => {
    audio.unlock();
    setState((prev) => {
      if (prev.phase === "paused") {
        return setDirection({ ...prev, phase: "running" }, dir);
      }
      if (prev.phase !== "running") return prev;
      return setDirection(prev, dir);
    });
  }, []);

  const toggleFullscreen = useCallback(() => {
    audio.playClick();
    if (!document.fullscreenElement) {
      void shellRef.current?.requestFullscreen?.();
    } else {
      void document.exitFullscreen();
    }
  }, []);

  const toggleMusic = useCallback(() => {
    audio.unlock();
    setMusicOn((prev) => {
      const next = !prev;
      audio.setMusicOn(next);
      if (next) audio.startMusic();
      return next;
    });
  }, []);

  const toggleSfx = useCallback(() => {
    audio.unlock();
    setSfxOn((prev) => {
      const next = !prev;
      audio.setSfxOn(next);
      if (next) audio.playClick();
      return next;
    });
  }, []);

  /* --------------------------- Plein écran --------------------------- */

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  /* ----------------------------- Clavier ----------------------------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const map: Record<string, Direction> = {
        arrowup: "UP",
        arrowdown: "DOWN",
        arrowleft: "LEFT",
        arrowright: "RIGHT",
        z: "UP",
        q: "LEFT",
        w: "UP",
        a: "LEFT",
        s: "DOWN",
        d: "RIGHT",
      };

      if (key === " " || key === "p") {
        e.preventDefault();
        if (phase === "running" || phase === "paused") togglePause();
        else if (phase === "menu" || phase === "gameover" || phase === "victory")
          startGame();
        else if (phase === "levelup") nextLevel();
        return;
      }
      if (key === "enter") {
        if (phase === "menu" || phase === "gameover" || phase === "victory") {
          e.preventDefault();
          startGame();
        } else if (phase === "levelup") {
          e.preventDefault();
          nextLevel();
        }
        return;
      }

      const dir = map[key];
      if (!dir) return;
      e.preventDefault();
      if (phase === "menu") startGame();
      else onDirection(dir);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, onDirection, togglePause, startGame, nextLevel]);

  /* ------------------------------ Tactile ----------------------------- */

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const start = touchStartRef.current;
      touchStartRef.current = null;
      if (!start) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (Math.abs(dx) < 24 && Math.abs(dy) < 24) {
        if (phase === "menu") startGame();
        return;
      }
      if (Math.abs(dx) > Math.abs(dy)) {
        onDirection(dx > 0 ? "RIGHT" : "LEFT");
      } else {
        onDirection(dy > 0 ? "DOWN" : "UP");
      }
    },
    [phase, onDirection, startGame],
  );

  /* --------------------------- Boucle de jeu -------------------------- */

  useEffect(() => {
    if (phase !== "running") return;
    const handle = window.setInterval(() => {
      setState((prev) => {
        const result = tick(prev);
        return result.kind === "noop" ? prev : result.state;
      });
    }, state.speedMs);
    return () => window.clearInterval(handle);
  }, [phase, state.speedMs]);

  /* ---------------------- Synchronisation du rendu -------------------- */

  useEffect(() => {
    if (lastSnakeRef.current !== state.snake) {
      prevSnakeRef.current = lastSnakeRef.current;
      lastSnakeRef.current = state.snake;
      renderRef.current.lastTickAt = performance.now();
    }
    renderRef.current.snake = state.snake;
    renderRef.current.prevSnake = prevSnakeRef.current;
    renderRef.current.speedMs = state.speedMs;
    renderRef.current.food = state.food;
    renderRef.current.obstacles = state.obstacles;
    renderRef.current.phase = state.phase;
    renderRef.current.direction = state.direction;
  }, [state]);

  /* ----------------------- Effets : score / phases -------------------- */

  useEffect(() => {
    if (state.score > prevScoreRef.current) {
      audio.playEat();
      fxRef.current.push({
        type: "eat",
        x: lastFoodRef.current.x,
        y: lastFoodRef.current.y,
        at: performance.now(),
      });
      if (state.score > recordRef.current) {
        persistHighScore(state.score);
        recordRef.current = state.score;
        setNewRecord(true);
      }
    }
    prevScoreRef.current = state.score;
    lastFoodRef.current = state.food;
  }, [state.score, state.food]);

  useEffect(() => {
    const prev = prevPhaseRef.current;
    if (prev !== state.phase) {
      if (state.phase === "gameover") {
        audio.playDie();
        const head = state.snake[0];
        fxRef.current.push({
          type: "die",
          x: head.x,
          y: head.y,
          at: performance.now(),
        });
      } else if (state.phase === "levelup") {
        audio.playLevelUp();
        const head = state.snake[0];
        fxRef.current.push({
          type: "level",
          x: head.x,
          y: head.y,
          at: performance.now(),
        });
      } else if (state.phase === "victory") {
        audio.playVictory();
      }
      prevPhaseRef.current = state.phase;
    }
  }, [state.phase, state.snake]);

  /* ------------------------------- Rendu ------------------------------ */

  const progress = Math.round(
    (state.applesInLevel / level.applesToClear) * 100,
  );

  const overlayTitle =
    phase === "menu"
      ? "Prêt à jouer ?"
      : phase === "paused"
        ? "Pause"
        : phase === "levelup"
          ? "Niveau terminé !"
          : phase === "gameover"
            ? "Partie terminée"
            : phase === "victory"
              ? "Victoire !"
              : "";

  const overlayBody =
    phase === "menu"
      ? `${LEVELS.length} niveaux à difficulté progressive vous attendent. Mangez les pommes, évitez les obstacles… et votre propre queue !`
      : phase === "paused"
        ? "Le serpent fait une petite sieste…"
        : phase === "levelup"
          ? `Prochain défi : ${LEVELS[state.levelIndex + 1]?.name}`
          : phase === "gameover"
            ? state.score >= state.highScore && state.score > 0
              ? "Nouveau record, bravo !"
              : "Le serpent s'est mordu la queue… ou pire."
            : phase === "victory"
              ? `Vous avez terminé les ${LEVELS.length} niveaux. Le serpent vous salue bien bas !`
              : "";

  const overlayAction =
    phase === "menu" || phase === "gameover" || phase === "victory"
      ? startGame
      : phase === "levelup"
        ? nextLevel
        : togglePause;

  const overlayActionLabel =
    phase === "menu"
      ? "Jouer"
      : phase === "gameover" || phase === "victory"
        ? "Rejouer"
        : phase === "levelup"
          ? "Niveau suivant →"
          : "Reprendre";

  return (
    <div
      ref={shellRef}
      className="min-h-screen overflow-y-auto bg-gradient-to-br from-slate-950 via-[#02150f] to-emerald-950 text-slate-100"
    >
      <style>{`
        @keyframes shimmer {
          0%, 100% { opacity: 0.85; }
          50% { opacity: 1; }
        }
      `}</style>

      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-4 px-3 py-4 sm:gap-5 sm:px-4 sm:py-8">
        {/* ------------------------------ En-tête ------------------------------ */}
        <motion.header
          initial={{ opacity: 0, y: -18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ rotate: [0, 8, -8, 0] }}
              transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-lime-300 to-emerald-600 text-emerald-950 shadow-lg shadow-emerald-700/50"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-6 w-6">
                <path d="M3 12c4-6 14-6 18 0" strokeLinecap="round" />
                <path d="M7 12c2-3 8-3 10 0" strokeLinecap="round" strokeOpacity={0.5} />
                <circle cx="18.5" cy="11.5" r="0.7" fill="currentColor" />
              </svg>
            </motion.div>
            <div>
              <h1 className="bg-gradient-to-r from-lime-200 via-emerald-300 to-teal-300 bg-clip-text text-xl font-black tracking-tight text-transparent sm:text-2xl">
                Snake Néon
              </h1>
              <p className="text-[11px] text-emerald-300/70">
                Le grand classique, version améliorée
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <IconToggle label={musicOn ? "Couper la musique" : "Activer la musique"} active={musicOn} onClick={toggleMusic}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
                <path d="M9 18V5l12-2v13" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </IconToggle>
            <IconToggle label={sfxOn ? "Couper les sons" : "Activer les sons"} active={sfxOn} onClick={toggleSfx}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
                <path d="M11 5 6 9H2v6h4l5 4V5Z" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M15.5 8.5a5 5 0 0 1 0 7" strokeLinecap="round" />
                <path d="M18.5 5.5a9 9 0 0 1 0 13" strokeLinecap="round" />
              </svg>
            </IconToggle>
            <IconToggle
              label={isFullscreen ? "Quitter le plein écran" : "Mode plein écran"}
              active={isFullscreen}
              onClick={toggleFullscreen}
            >
              {isFullscreen ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
                  <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </IconToggle>
          </div>
        </motion.header>

        {/* ------------------------------ Statistiques ------------------------- */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1 }}
          className="grid grid-cols-4 gap-2 sm:gap-3"
        >
          <Stat label="Score" value={state.score} />
          <Stat label="Record" value={state.highScore} highlight={newRecord} />
          <Stat label="Niveau" value={`${state.levelIndex + 1}/${LEVELS.length}`} />
          <Stat label="Longueur" value={state.snake.length} />
        </motion.div>

        {/* ------------------------------ Plateau ------------------------------ */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className={`${panel} p-2.5 sm:p-4`}
        >
          <div className="flex items-center justify-between gap-3 px-1 pb-2.5">
            <div className="min-w-0">
              <motion.div
                key={state.levelIndex}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="truncate text-sm font-bold text-emerald-100"
              >
                Niveau {state.levelIndex + 1} — {level.name}
              </motion.div>
              <div className="text-[11px] text-emerald-300/70">
                Pommes : {state.applesInLevel}/{level.applesToClear}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <motion.button
                type="button"
                onClick={toggleWalls}
                whileTap={{ scale: 0.93 }}
                className={[
                  "rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition",
                  state.wallsOn
                    ? "border-rose-500/50 bg-rose-500/15 text-rose-200"
                    : "border-cyan-500/50 bg-cyan-500/15 text-cyan-200",
                ].join(" ")}
              >
                {state.wallsOn ? "Murs : mortels" : "Murs : traversables"}
              </motion.button>
              {(phase === "running" || phase === "paused") && (
                <GhostButton onClick={togglePause} className="!py-1.5 !text-xs">
                  {phase === "paused" ? "Reprendre" : "Pause"}
                </GhostButton>
              )}
            </div>
          </div>

          <div className="mb-2.5 h-2 overflow-hidden rounded-full bg-emerald-950/80">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-lime-400 to-emerald-400 shadow-[0_0_10px_rgba(132,204,22,0.6)]"
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>

          <div
            className="relative select-none"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <GameCanvas dataRef={renderRef} fxRef={fxRef} />

            <AnimatePresence>
              {newRecord && phase === "running" && (
                <motion.div
                  initial={{ opacity: 0, y: -12, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full border border-amber-300/60 bg-gradient-to-r from-amber-400 to-yellow-300 px-4 py-1 text-[11px] font-black uppercase tracking-widest text-amber-950 shadow-lg shadow-amber-400/40"
                >
                  Nouveau record !
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {(phase === "menu" ||
                phase === "paused" ||
                phase === "levelup" ||
                phase === "gameover" ||
                phase === "victory") && (
                <motion.div
                  key={phase}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-slate-950/70 backdrop-blur-md"
                >
                  <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 260, damping: 22 }}
                    className="w-[min(92%,26rem)] rounded-2xl border border-emerald-700/50 bg-gradient-to-b from-slate-900/95 to-emerald-950/95 p-6 text-center shadow-2xl shadow-emerald-950/60"
                  >
                    <motion.div
                      animate={{ scale: [1, 1.08, 1], rotate: [0, 3, -3, 0] }}
                      transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                      className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-lime-300 to-emerald-500 text-emerald-950 shadow-lg shadow-emerald-600/30"
                    >
                      {phase === "menu" && (
                        <svg viewBox="0 0 24 24" fill="currentColor" className="ml-1 h-8 w-8">
                          <path d="M8 5v14l11-7L8 5Z" />
                        </svg>
                      )}
                      {phase === "paused" && (
                        <svg viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8">
                          <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
                        </svg>
                      )}
                      {phase === "levelup" && (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-8 w-8">
                          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21 1.18.54 2.03 2.03 2.03 4M18 2H6v7a6 6 0 0 0 12 0V2Z" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                      {phase === "gameover" && (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-8 w-8">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M8 15s1.5-2 4-2 4 2 4 2M9 9h.01M15 9h.01" strokeLinecap="round" />
                        </svg>
                      )}
                      {phase === "victory" && <span className="text-3xl">🏆</span>}
                    </motion.div>

                    <h2
                      className={[
                        "text-2xl font-black",
                        phase === "victory"
                          ? "bg-gradient-to-r from-amber-200 to-yellow-400 bg-clip-text text-transparent"
                          : "text-emerald-50",
                      ].join(" ")}
                    >
                      {overlayTitle}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-emerald-300/80">
                      {overlayBody}
                    </p>

                    {(phase === "levelup" || phase === "gameover" || phase === "victory") && (
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <Stat label="Score" value={state.score} />
                        <Stat label="Record" value={state.highScore} highlight />
                      </div>
                    )}

                    <PrimaryButton onClick={overlayAction} className="mt-5 w-full">
                      {overlayActionLabel}
                    </PrimaryButton>

                    {phase === "menu" && (
                      <p className="mt-4 text-[11px] leading-relaxed text-emerald-400/60">
                        Flèches / ZQSD / WASD pour se déplacer · Espace : pause
                        <br />
                        Sur mobile : glissez le doigt sur le plateau
                      </p>
                    )}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mx-auto mt-3 flex w-full max-w-md items-center gap-2 text-[11px] text-emerald-300/70">
            <span>Lent</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-emerald-950/80">
              <motion.div
                className={[
                  "h-full rounded-full",
                  state.speedMs <= 70
                    ? "bg-gradient-to-r from-amber-300 to-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.6)]"
                    : "bg-gradient-to-r from-emerald-400 to-lime-300",
                ].join(" ")}
                initial={false}
                animate={{
                  width: `${Math.max(4, Math.min(100, Math.round(((175 - state.speedMs) / (175 - 65)) * 100)))}%`,
                }}
                transition={{ duration: 0.4 }}
              />
            </div>
            <span>Rapide</span>
          </div>
        </motion.div>

        {/* --------------------------- Pavé directionnel ----------------------- */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mx-auto grid w-fit grid-cols-3 gap-2 sm:hidden"
        >
          {(
            [
              ["UP", "col-start-2", "M6 15l6-6 6 6"],
              ["LEFT", "col-start-1 row-start-2", "M15 6l-6 6 6 6"],
              ["DOWN", "col-start-2 row-start-2", "M6 9l6 6 6-6"],
              ["RIGHT", "col-start-3 row-start-2", "M9 6l6 6-6 6"],
            ] as [Direction, string, string][]
          ).map(([dir, cls, path]) => (
            <motion.button
              key={dir}
              type="button"
              whileTap={{ scale: 0.82 }}
              aria-label={
                dir === "UP" ? "Haut" : dir === "DOWN" ? "Bas" : dir === "LEFT" ? "Gauche" : "Droite"
              }
              onClick={() => (phase === "menu" ? startGame() : onDirection(dir))}
              className={[
                "h-14 w-14 rounded-xl border border-emerald-700/50 bg-emerald-900/40 text-emerald-200 transition hover:bg-emerald-800/50 active:bg-emerald-500/30",
                cls,
              ].join(" ")}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="mx-auto h-6 w-6">
                <path d={path} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.button>
          ))}
        </motion.div>

        {/* ------------------------------ Pied de page ------------------------- */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="pb-2 text-center"
        >
          <p className="text-[11px] text-emerald-400/60">
            {state.wallsOn
              ? "Les murs sont mortels."
              : "Les bords sont traversables."}{" "}
            La vitesse augmente à chaque pomme et à chaque niveau.
          </p>
          <p className="mt-1.5 text-[11px] font-medium text-emerald-300/50">
            Créé par <span className="text-emerald-200/80">Hylst — Geoffroy</span>{" "}
            avec l'aide d'une IA
          </p>
        </motion.footer>
      </div>
    </div>
  );
}
