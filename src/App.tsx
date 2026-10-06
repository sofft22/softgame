import { useEffect, useRef, useState } from 'react';

const GRID_SIZE = 20;
const TICK_MS = 130;

type Position = { x: number; y: number };
type Direction = 'up' | 'down' | 'left' | 'right';

export default function App() {
  const [snake, setSnake] = useState<Position[]>([
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ]);
  const [food, setFood] = useState<Position>({ x: 15, y: 10 });
  const [direction, setDirection] = useState<Direction>('right');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  // Refs so the interval always sees fresh values without restarting
  const directionRef = useRef<Direction>('right');
  const snakeRef = useRef<Position[]>(snake);
  const foodRef = useRef<Position>(food);
  const gameOverRef = useRef(false);
  const pausedRef = useRef(false);

  // Load high score from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('snake-highscore');
    if (saved) setHighScore(Number(saved));
  }, []);

  // Keep refs synced
  useEffect(() => { directionRef.current = direction; }, [direction]);
  useEffect(() => { snakeRef.current = snake; }, [snake]);
  useEffect(() => { foodRef.current = food; }, [food]);
  useEffect(() => { gameOverRef.current = isGameOver; }, [isGameOver]);
  useEffect(() => { pausedRef.current = isPaused; }, [isPaused]);

  // Keyboard input
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      if (key === ' ' || key === 'spacebar') {
        e.preventDefault();
        if (isGameOver) return;
        if (!hasStarted) setHasStarted(true);
        else setIsPaused((p) => !p);
        return;
      }

      let next: Direction | null = null;
      if (key === 'arrowup' || key === 'w') next = 'up';
      if (key === 'arrowdown' || key === 's') next = 'down';
      if (key === 'arrowleft' || key === 'a') next = 'left';
      if (key === 'arrowright' || key === 'd') next = 'right';
      if (!next) return;

      e.preventDefault();
      if (!hasStarted) setHasStarted(true);

      // prevent 180° reversal
      const cur = directionRef.current;
      if (cur === 'up' && next === 'down') return;
      if (cur === 'down' && next === 'up') return;
      if (cur === 'left' && next === 'right') return;
      if (cur === 'right' && next === 'left') return;

      setDirection(next);
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isGameOver, hasStarted]);

  // Touch swipe
  useEffect(() => {
    let touchStart: { x: number; y: number } | null = null;

    const onTouchStart = (e: TouchEvent) => {
      touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (!touchStart) return;
      const dx = e.changedTouches[0].clientX - touchStart.x;
      const dy = e.changedTouches[0].clientY - touchStart.y;
      if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;

      if (!hasStarted) setHasStarted(true);

      let next: Direction;
      if (Math.abs(dx) > Math.abs(dy)) next = dx > 0 ? 'right' : 'left';
      else next = dy > 0 ? 'down' : 'up';

      const cur = directionRef.current;
      if (cur === 'up' && next === 'down') return;
      if (cur === 'down' && next === 'up') return;
      if (cur === 'left' && next === 'right') return;
      if (cur === 'right' && next === 'left') return;

      setDirection(next);
    };

    window.addEventListener('touchstart', onTouchStart);
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [hasStarted]);

  // The game loop
  useEffect(() => {
    const interval = setInterval(() => {
      if (!hasStarted || pausedRef.current || gameOverRef.current) return;

      const currentSnake = snakeRef.current;
      const head = currentSnake[0];
      const dir = directionRef.current;

      const nextHead: Position = {
        x: head.x + (dir === 'right' ? 1 : dir === 'left' ? -1 : 0),
        y: head.y + (dir === 'down' ? 1 : dir === 'up' ? -1 : 0),
      };

      // Wall collision
      if (
        nextHead.x < 0 ||
        nextHead.x >= GRID_SIZE ||
        nextHead.y < 0 ||
        nextHead.y >= GRID_SIZE
      ) {
        setIsGameOver(true);
        return;
      }

      // Self collision
      if (currentSnake.some((s) => s.x === nextHead.x && s.y === nextHead.y)) {
        setIsGameOver(true);
        return;
      }

      const ateFood =
        nextHead.x === foodRef.current.x && nextHead.y === foodRef.current.y;

      const newSnake = [nextHead, ...currentSnake];
      if (!ateFood) newSnake.pop();

      setSnake(newSnake);

      if (ateFood) {
        setScore((s) => {
          const newScore = s + 10;
          if (newScore > highScore) {
            setHighScore(newScore);
            localStorage.setItem('snake-highscore', String(newScore));
          }
          return newScore;
        });

        // spawn new food not on the snake
        let newFood: Position;
        do {
          newFood = {
            x: Math.floor(Math.random() * GRID_SIZE),
            y: Math.floor(Math.random() * GRID_SIZE),
          };
        } while (newSnake.some((s) => s.x === newFood.x && s.y === newFood.y));
        setFood(newFood);
      }
    }, TICK_MS);

    return () => clearInterval(interval);
  }, [hasStarted, highScore]);

  const resetGame = () => {
    setSnake([
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ]);
    setFood({ x: 15, y: 10 });
    setDirection('right');
    setScore(0);
    setIsGameOver(false);
    setIsPaused(false);
    setHasStarted(false);
  };

  const isSnake = (x: number, y: number) =>
    snake.some((s) => s.x === x && s.y === y);
  const isHead = (x: number, y: number) =>
    snake[0].x === x && snake[0].y === y;
  const isFood = (x: number, y: number) => food.x === x && food.y === y;

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="mb-4 flex w-full max-w-[400px] items-center justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/40">
            Score
          </p>
          <p className="font-mono text-[22px] font-bold text-black">{score}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/40">
            Best
          </p>
          <p className="font-mono text-[22px] font-bold text-black">
            {highScore}
          </p>
        </div>
      </div>

      {/* Board */}
      <div className="relative">
        <div
          className="grid border border-[#eaeaea]"
          style={{
            gridTemplateColumns: `repeat(${GRID_SIZE}, 18px)`,
            gridTemplateRows: `repeat(${GRID_SIZE}, 18px)`,
            touchAction: 'none',
          }}
        >
          {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
            const x = i % GRID_SIZE;
            const y = Math.floor(i / GRID_SIZE);
            const head = isHead(x, y);
            const body = isSnake(x, y) && !head;
            const foodHere = isFood(x, y);

            let cls = 'border border-[#f5f5f5]';
            if (head) cls = 'bg-rose-700';
            else if (body) cls = 'bg-rose-500';
            else if (foodHere) cls = 'bg-black';

            return <div key={i} className={cls} />;
          })}
        </div>

        {/* Start overlay */}
        {!hasStarted && !isGameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-rose-600">
              Snake
            </p>
            <h1 className="mt-2 text-[28px] font-bold tracking-tight text-black">
              Ready?
            </h1>
            <p className="mt-3 max-w-[260px] text-center text-[12.5px] text-black/50">
              Arrow keys, WASD, or swipe to move. Space to pause.
            </p>
            <button
              onClick={() => setHasStarted(true)}
              className="mt-5 rounded-full bg-black px-6 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-white transition-colors hover:bg-rose-600"
            >
              Start
            </button>
          </div>
        )}

        {/* Paused overlay */}
        {isPaused && !isGameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-rose-600">
              Paused
            </p>
            <p className="mt-3 text-[13px] text-black/50">
              Press Space to resume
            </p>
          </div>
        )}

        {/* Game over overlay */}
        {isGameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-rose-600">
              Game over
            </p>
            <h2 className="mt-2 font-mono text-[32px] font-bold text-black">
              {score}
            </h2>
            <p className="mt-1 text-[12.5px] text-black/50">
              Best: {highScore}
            </p>
            <button
              onClick={resetGame}
              className="mt-5 rounded-full bg-black px-6 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-white transition-colors hover:bg-rose-600"
            >
              Play again
            </button>
          </div>
        )}
      </div>

      {/* Footer hint */}
      <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.18em] text-black/30">
        Arrow keys · WASD · swipe
      </p>
    </div>
  );
}