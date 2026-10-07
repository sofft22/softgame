import { useEffect, useRef, useState } from 'react';

const GRID_SIZE = 20;
const WALLET_KEY = 'softgame-wallet';
const HIGH_KEY = 'softgame-highscore';
const SOUND_KEY = 'softgame-sound';
const SKIN_KEY = 'softgame-skin';

type Position = { x: number; y: number };
type Direction = 'up' | 'down' | 'left' | 'right';
type Difficulty = 'easy' | 'normal' | 'hard';
type CoinType = '1' | '5' | '10';
type Food = Position & { type: CoinType };
type Skin = 'green' | 'gold';

type PowerUps = {
  extraLife: boolean;
  slowStart: boolean;
};

const DIFFICULTIES: Record<Difficulty, { label: string; tick: number; sub: string }> = {
  easy:   { label: 'Easy',   tick: 180, sub: 'Relaxed pace' },
  normal: { label: 'Normal', tick: 130, sub: 'Classic' },
  hard:   { label: 'Hard',   tick: 80,  sub: 'Reflexes only' },
};

const COIN_VALUE: Record<CoinType, number> = { '1': 10, '5': 25, '10': 50 };

type Level = { name: string; min: number; color: string };
const LEVELS: Level[] = [
  { name: 'Rookie',    min: 0,     color: '#b3aeaa' },
  { name: 'Collector', min: 200,   color: '#a8e0a4' },
  { name: 'Mogul',     min: 600,   color: '#7eb686' },
  { name: 'King',      min: 1500,  color: '#e8c667' },
  { name: 'Legend',    min: 3000,  color: '#e88a80' },
];

function levelFor(amount: number): Level {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (amount >= LEVELS[i].min) return LEVELS[i];
  }
  return LEVELS[0];
}

const SHOP_ITEMS = {
  extraLife: { label: 'Extra life', price: 500, sub: 'Survive one crash' },
  slowStart: { label: 'Slow start', price: 800, sub: 'Calmer first 10s' },
  goldSkin:  { label: 'Golden snake', price: 2000, sub: 'Permanent unlock' },
} as const;

const GRASS_SVG = encodeURIComponent(`
<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220' viewBox='0 0 220 220'>
  <g fill='none' stroke='rgba(255,255,255,0.09)' stroke-width='2' stroke-linecap='round'>
    <path d='M12 220 Q15 180 10 148'/><path d='M30 220 Q33 175 28 140'/>
    <path d='M52 220 Q55 185 50 155'/><path d='M74 220 Q78 178 72 145'/>
    <path d='M96 220 Q99 182 94 150'/><path d='M118 220 Q122 175 116 140'/>
    <path d='M140 220 Q143 185 138 155'/><path d='M162 220 Q166 178 160 145'/>
    <path d='M184 220 Q187 182 182 150'/><path d='M206 220 Q210 175 204 140'/>
  </g>
  <g fill='none' stroke='rgba(0,0,0,0.14)' stroke-width='2' stroke-linecap='round'>
    <path d='M20 220 Q23 180 18 148'/><path d='M42 220 Q45 185 40 155'/>
    <path d='M64 220 Q68 178 62 145'/><path d='M86 220 Q89 182 84 150'/>
    <path d='M108 220 Q112 175 106 140'/><path d='M130 220 Q133 185 128 155'/>
    <path d='M152 220 Q156 178 150 145'/><path d='M174 220 Q177 182 172 150'/>
    <path d='M196 220 Q200 175 194 140'/>
  </g>
</svg>
`);

function pickCoinType(): CoinType {
  const r = Math.random();
  if (r < 0.7) return '1';
  if (r < 0.95) return '5';
  return '10';
}

function Coin({ size, type }: { size: number; type: CoinType }) {
  const palette = {
    '1':  { rim: '#8a5a2b', base: '#c98a4b', shine: '#f0c28a', text: '#3d2414' },
    '5':  { rim: '#7a7a80', base: '#b6b8bd', shine: '#e8e9ec', text: '#2f2f34' },
    '10': { rim: '#8a6b13', base: '#e0b53a', shine: '#fce18a', text: '#3d2f06' },
  }[type];

  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ display: 'block' }}>
      <defs>
        <radialGradient id={`coin-g-${type}`} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor={palette.shine} />
          <stop offset="55%" stopColor={palette.base} />
          <stop offset="100%" stopColor={palette.rim} />
        </radialGradient>
      </defs>
      <circle cx="20" cy="20" r="19" fill={palette.rim} />
      <circle cx="20" cy="20" r="17" fill={`url(#coin-g-${type})`} />
      <circle cx="20" cy="20" r="14" fill="none" stroke={palette.rim} strokeWidth="0.7" opacity="0.5" />
      <text x="20" y="24" textAnchor="middle" fontSize="14" fontWeight="700" fontFamily="Inter, sans-serif" fill={palette.text}>
        ₦
      </text>
      <text x="20" y="33" textAnchor="middle" fontSize="7" fontWeight="600" fontFamily="Inter, sans-serif" fill={palette.text} opacity="0.75">
        {type}
      </text>
      <path d="M9 13 Q12 8 20 7" fill="none" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}

export default function App() {
  const [snake, setSnake] = useState<Position[]>([
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ]);
  const [food, setFood] = useState<Food>({ x: 15, y: 10, type: '1' });
  const [direction, setDirection] = useState<Direction>('right');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [wallet, setWallet] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [soundOn, setSoundOn] = useState(true);
  const [skin, setSkin] = useState<Skin>('green');
  const [showShop, setShowShop] = useState(false);
  const [boardSize, setBoardSize] = useState(360);

  // Active power-ups for the current game
  const [powerUps, setPowerUps] = useState<PowerUps>({
    extraLife: false,
    slowStart: false,
  });
  const [livesLeft, setLivesLeft] = useState(1);
  const [gameStartTime, setGameStartTime] = useState(0);

  const directionRef = useRef<Direction>('right');
  const snakeRef = useRef<Position[]>(snake);
  const foodRef = useRef<Food>(food);
  const gameOverRef = useRef(false);
  const pausedRef = useRef(false);
  const livesRef = useRef(1);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const update = () => {
      const w = Math.min(window.innerWidth * 0.9, 420);
      setBoardSize(Math.floor(w));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    const hs = localStorage.getItem(HIGH_KEY);
    if (hs) setHighScore(Number(hs));
    const w = localStorage.getItem(WALLET_KEY);
    if (w) setWallet(Number(w));
    const s = localStorage.getItem(SOUND_KEY);
    if (s !== null) setSoundOn(s === 'true');
    const sk = localStorage.getItem(SKIN_KEY);
    if (sk === 'gold') setSkin('gold');
  }, []);

  useEffect(() => { directionRef.current = direction; }, [direction]);
  useEffect(() => { snakeRef.current = snake; }, [snake]);
  useEffect(() => { foodRef.current = food; }, [food]);
  useEffect(() => { gameOverRef.current = isGameOver; }, [isGameOver]);
  useEffect(() => { pausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { livesRef.current = livesLeft; }, [livesLeft]);

  // ─── SOUND ─────────────────────────────────────────────
  const getCtx = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtxRef.current;
  };

  const tone = (
    freq: number,
    duration: number,
    opts: { type?: OscillatorType; volume?: number; delay?: number } = {}
  ) => {
    if (!soundOn) return;
    try {
      const ctx = getCtx();
      if (!ctx) return;
      const { type = 'sine', volume = 0.10, delay = 0 } = opts;
      const start = ctx.currentTime + delay;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.02);
    } catch {}
  };

  const playEat = (type: CoinType) => {
    if (type === '1') {
      tone(660, 0.08, { volume: 0.08 });
      tone(880, 0.10, { volume: 0.06, delay: 0.05 });
    } else if (type === '5') {
      tone(720, 0.10, { volume: 0.10 });
      tone(1000, 0.12, { volume: 0.08, delay: 0.06 });
      tone(1320, 0.14, { volume: 0.06, delay: 0.13 });
    } else {
      tone(660, 0.09, { volume: 0.11 });
      tone(880, 0.09, { volume: 0.11, delay: 0.08 });
      tone(1100, 0.10, { volume: 0.11, delay: 0.16 });
      tone(1480, 0.22, { volume: 0.10, delay: 0.25 });
    }
  };
  const playGameOver = () => {
    tone(380, 0.20, { volume: 0.10 });
    tone(280, 0.22, { volume: 0.09, delay: 0.14 });
    tone(180, 0.35, { volume: 0.08, delay: 0.30 });
  };
  const playNewHighScore = () => {
    tone(523, 0.12, { volume: 0.10 });
    tone(659, 0.12, { volume: 0.10, delay: 0.10 });
    tone(784, 0.16, { volume: 0.10, delay: 0.20 });
    tone(1046, 0.28, { volume: 0.09, delay: 0.34 });
  };
  const playStart = () => {
    tone(480, 0.10, { volume: 0.08 });
    tone(720, 0.14, { volume: 0.08, delay: 0.07 });
  };
  const playBuy = () => {
    tone(880, 0.08, { volume: 0.10 });
    tone(1320, 0.10, { volume: 0.10, delay: 0.06 });
    tone(1760, 0.14, { volume: 0.10, delay: 0.13 });
  };
  const playSaveLife = () => {
    tone(440, 0.12, { volume: 0.10 });
    tone(660, 0.12, { volume: 0.10, delay: 0.08 });
    tone(880, 0.18, { volume: 0.10, delay: 0.16 });
  };

  // ─── KEYBOARD ──────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      if (key === ' ' || key === 'spacebar') {
        e.preventDefault();
        if (isGameOver) return;
        if (!hasStarted) { startGame(); }
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
      if (!hasStarted) { startGame(); }

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

  // ─── TOUCH ─────────────────────────────────────────────
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

      if (!hasStarted) { startGame(); }

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

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [hasStarted]);

  const startGame = () => {
    setHasStarted(true);
    setGameStartTime(Date.now());
    setLivesLeft(powerUps.extraLife ? 2 : 1);
    playStart();
  };

  // ─── GAME LOOP ─────────────────────────────────────────
  useEffect(() => {
    const baseTick = DIFFICULTIES[difficulty].tick;
    const elapsed = Date.now() - gameStartTime;
    const inSlowStart = powerUps.slowStart && elapsed < 10000;
    const tickMs = inSlowStart ? baseTick * 1.8 : baseTick;

    const interval = setInterval(() => {
      if (!hasStarted || pausedRef.current || gameOverRef.current) return;

      const currentSnake = snakeRef.current;
      const head = currentSnake[0];
      const dir = directionRef.current;

      const nextHead: Position = {
        x: head.x + (dir === 'right' ? 1 : dir === 'left' ? -1 : 0),
        y: head.y + (dir === 'down' ? 1 : dir === 'up' ? -1 : 0),
      };

      const hitWall =
        nextHead.x < 0 ||
        nextHead.x >= GRID_SIZE ||
        nextHead.y < 0 ||
        nextHead.y >= GRID_SIZE;
      const hitSelf = currentSnake.some(
        (s) => s.x === nextHead.x && s.y === nextHead.y
      );

      if (hitWall || hitSelf) {
        if (livesRef.current > 1) {
          // Consume a life, reset snake position
          setLivesLeft((l) => l - 1);
          playSaveLife();
          const safeSnake: Position[] = [
            { x: 10, y: 10 },
            { x: 9, y: 10 },
            { x: 8, y: 10 },
          ];
          setSnake(safeSnake);
          setDirection('right');
          return;
        }
        playGameOver();
        setIsGameOver(true);
        return;
      }

      const ateFood =
        nextHead.x === foodRef.current.x && nextHead.y === foodRef.current.y;

      const newSnake = [nextHead, ...currentSnake];
      if (!ateFood) newSnake.pop();

      setSnake(newSnake);

      if (ateFood) {
        const coinType = foodRef.current.type;
        playEat(coinType);
        const value = COIN_VALUE[coinType];

        setScore((s) => {
          const newScore = s + value;
          if (newScore > highScore) {
            setHighScore(newScore);
            localStorage.setItem(HIGH_KEY, String(newScore));
            if (highScore > 0) playNewHighScore();
          }
          return newScore;
        });

        let newFood: Food;
        do {
          newFood = {
            x: Math.floor(Math.random() * GRID_SIZE),
            y: Math.floor(Math.random() * GRID_SIZE),
            type: pickCoinType(),
          };
        } while (newSnake.some((s) => s.x === newFood.x && s.y === newFood.y));
        setFood(newFood);
      }
    }, tickMs);

    return () => clearInterval(interval);
  }, [hasStarted, highScore, difficulty, gameStartTime, powerUps]);

  // When the game ends, save earnings to wallet
  useEffect(() => {
    if (isGameOver && score > 0) {
      setWallet((w) => {
        const next = w + score;
        localStorage.setItem(WALLET_KEY, String(next));
        return next;
      });
    }
  }, [isGameOver]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetGame = () => {
    setSnake([
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ]);
    setFood({ x: 15, y: 10, type: '1' });
    setDirection('right');
    setScore(0);
    setIsGameOver(false);
    setIsPaused(false);
    setHasStarted(false);
    setPowerUps({ extraLife: false, slowStart: false });
    setLivesLeft(1);
  };

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    localStorage.setItem(SOUND_KEY, String(next));
    if (next) setTimeout(() => tone(880, 0.08, { volume: 0.08 }), 50);
  };

  // ─── SHOP ──────────────────────────────────────────────
  const buyItem = (id: 'extraLife' | 'slowStart' | 'goldSkin') => {
    const price = SHOP_ITEMS[id].price;
    if (wallet < price) return;
    if (id === 'goldSkin' && skin === 'gold') return;

    setWallet((w) => {
      const next = w - price;
      localStorage.setItem(WALLET_KEY, String(next));
      return next;
    });

    if (id === 'extraLife') setPowerUps((p) => ({ ...p, extraLife: true }));
    if (id === 'slowStart') setPowerUps((p) => ({ ...p, slowStart: true }));
    if (id === 'goldSkin') {
      setSkin('gold');
      localStorage.setItem(SKIN_KEY, 'gold');
    }

    playBuy();
  };

  // ─── GEOMETRY ──────────────────────────────────────────
  const cellSize = boardSize / GRID_SIZE;

  const buildSnakePath = (): string => {
    if (snake.length === 0) return '';

    const centerOf = (p: Position) => ({
      cx: p.x * cellSize + cellSize / 2,
      cy: p.y * cellSize + cellSize / 2,
    });

    if (snake.length === 1) {
      const c = centerOf(snake[0]);
      return `M ${c.cx} ${c.cy} L ${c.cx} ${c.cy}`;
    }

    const head = centerOf(snake[0]);
    let d = `M ${head.cx} ${head.cy}`;

    for (let i = 1; i < snake.length; i++) {
      const prev = centerOf(snake[i - 1]);
      const curr = centerOf(snake[i]);
      const next = i < snake.length - 1 ? centerOf(snake[i + 1]) : null;

      if (!next) {
        d += ` L ${curr.cx} ${curr.cy}`;
        break;
      }

      const v1 = { x: curr.cx - prev.cx, y: curr.cy - prev.cy };
      const v2 = { x: next.cx - curr.cx, y: next.cy - curr.cy };

      if (v1.x === v2.x && v1.y === v2.y) {
        d += ` L ${curr.cx} ${curr.cy}`;
      } else {
        const r = cellSize / 2.2;
        const before = {
          x: curr.cx - Math.sign(v1.x) * r,
          y: curr.cy - Math.sign(v1.y) * r,
        };
        const after = {
          x: curr.cx + Math.sign(v2.x) * r,
          y: curr.cy + Math.sign(v2.y) * r,
        };
        d += ` L ${before.x} ${before.y}`;
        d += ` Q ${curr.cx} ${curr.cy} ${after.x} ${after.y}`;
      }
    }

    return d;
  };

  const snakePath = buildSnakePath();
  const snakeStroke = cellSize * 0.72;
  const head = snake[0];
  const headCenter = head
    ? { cx: head.x * cellSize + cellSize / 2, cy: head.y * cellSize + cellSize / 2 }
    : null;

  const eyeOffset = cellSize * 0.2;
  const eyeRadius = cellSize * 0.12;

  const eyePositions = (() => {
    if (!headCenter) return [];
    const c = headCenter;
    const o = eyeOffset;
    if (direction === 'right') return [{ x: c.cx + o, y: c.cy - o }, { x: c.cx + o, y: c.cy + o }];
    if (direction === 'left')  return [{ x: c.cx - o, y: c.cy - o }, { x: c.cx - o, y: c.cy + o }];
    if (direction === 'up')    return [{ x: c.cx - o, y: c.cy - o }, { x: c.cx + o, y: c.cy - o }];
    return [{ x: c.cx - o, y: c.cy + o }, { x: c.cx + o, y: c.cy + o }];
  })();

  const currentLevel = levelFor(score);
  const nextLevel = LEVELS[LEVELS.findIndex((l) => l.name === currentLevel.name) + 1];
  const progressToNext = nextLevel
    ? Math.min(1, (score - currentLevel.min) / (nextLevel.min - currentLevel.min))
    : 1;

  const snakeGradStart = skin === 'gold' ? '#fce18a' : '#86efac';
  const snakeGradEnd = skin === 'gold' ? '#b8860b' : '#22c55e';

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center p-4 select-none overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #2f6b38 0%, #1f4a26 100%)',
        fontFamily: 'Inter, system-ui, sans-serif',
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <style>{`
        @keyframes bgDrift {
          0%   { background-position: 0px 0px; }
          100% { background-position: 440px 220px; }
        }
        .grass-bg {
          animation: bgDrift 90s linear infinite;
          will-change: background-position;
        }
        @media (prefers-reduced-motion: reduce) {
          .grass-bg { animation: none !important; }
        }
      `}</style>

      <div
        className="grass-bg pointer-events-none fixed inset-0"
        style={{
          zIndex: 0,
          backgroundImage: `url("data:image/svg+xml;utf8,${GRASS_SVG}")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '220px 220px',
          backgroundColor: '#2f6b38',
        }}
        aria-hidden="true"
      />

      <div
        className="pointer-events-none fixed inset-0"
        style={{
          zIndex: 0,
          background:
            'radial-gradient(ellipse at 50% 50%, transparent 45%, rgba(0,0,0,0.30) 100%)',
        }}
        aria-hidden="true"
      />

      <div className="relative flex flex-col items-center" style={{ zIndex: 1 }}>
        {/* Brand + wallet */}
        <div
          className="mb-4 flex items-center justify-between"
          style={{ width: boardSize }}
        >
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full" style={{ background: '#a8e0a4' }} />
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.3em]"
              style={{ color: 'rgba(255,255,255,0.9)' }}
            >
              Softgame
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="font-mono text-[12px] font-semibold"
              style={{ color: '#e8c667' }}
            >
              ₦{wallet.toLocaleString()}
            </span>
            <button
              onClick={toggleSound}
              className="text-[13px] transition-opacity hover:opacity-70"
              style={{ color: 'rgba(255,255,255,0.6)' }}
              aria-label="Toggle sound"
            >
              {soundOn ? '🔊' : '🔇'}
            </button>
          </div>
        </div>

        {/* Score bar */}
        <div
          className="mb-2 flex items-end justify-between"
          style={{ width: boardSize }}
        >
          <div>
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.2em]"
              style={{ color: 'rgba(255,255,255,0.6)' }}
            >
              Score
            </p>
            <p
              className="mt-0.5 font-mono text-[20px] font-semibold leading-none"
              style={{ color: '#ffffff' }}
            >
              ₦{score.toLocaleString()}
            </p>
          </div>
          {livesLeft > 1 && (
            <div className="flex items-center gap-1">
              {Array.from({ length: livesLeft }).map((_, i) => (
                <span key={i} style={{ fontSize: 14 }}>❤️</span>
              ))}
            </div>
          )}
          <div className="text-right">
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.2em]"
              style={{ color: 'rgba(255,255,255,0.6)' }}
            >
              Best
            </p>
            <p
              className="mt-0.5 font-mono text-[20px] font-semibold leading-none"
              style={{ color: '#ffffff' }}
            >
              ₦{highScore.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Level bar */}
        <div className="mb-3 flex items-center gap-2" style={{ width: boardSize }}>
          <span
            className="text-[10px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: currentLevel.color }}
          >
            {currentLevel.name}
          </span>
          <div
            className="flex-1 h-1 rounded-full overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.12)' }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${progressToNext * 100}%`,
                background: currentLevel.color,
                transition: 'width 300ms ease',
              }}
            />
          </div>
          {nextLevel && (
            <span
              className="text-[10px] font-mono"
              style={{ color: 'rgba(255,255,255,0.4)' }}
            >
              ₦{nextLevel.min.toLocaleString()}
            </span>
          )}
        </div>

        {/* Board */}
        <div className="relative">
          <div
            className="rounded-[20px] overflow-hidden"
            style={{
              width: boardSize,
              height: boardSize,
              background: 'linear-gradient(180deg, #8b6a4a 0%, #6e5238 100%)',
              border: '2px solid #4d3826',
              boxShadow:
                '0 16px 40px -16px rgba(0,0,0,0.5), inset 0 2px 8px rgba(0,0,0,0.25)',
              touchAction: 'none',
              position: 'relative',
            }}
          >
            {/* Soil speckle */}
            <svg
              width={boardSize}
              height={boardSize}
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.25 }}
            >
              <defs>
                <pattern id="soil" width="14" height="14" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="3" r="0.6" fill="#3a2718" />
                  <circle cx="8" cy="6" r="0.4" fill="#3a2718" />
                  <circle cx="11" cy="11" r="0.5" fill="#3a2718" />
                  <circle cx="4" cy="10" r="0.3" fill="#3a2718" />
                  <circle cx="10" cy="2" r="0.4" fill="#3a2718" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#soil)" />
            </svg>

            {/* Snake */}
            <svg
              width={boardSize}
              height={boardSize}
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
            >
              {snakePath && (
                <>
                  <path
                    d={snakePath}
                    fill="none"
                    stroke="#1c0f06"
                    strokeWidth={snakeStroke + 2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.45}
                    transform="translate(0, 1.5)"
                  />
                  <path
                    d={snakePath}
                    fill="none"
                    stroke="url(#snakeGrad)"
                    strokeWidth={snakeStroke}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d={snakePath}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth={snakeStroke * 0.22}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.35}
                    transform="translate(-0.8, -0.8)"
                  />
                  <defs>
                    <linearGradient id="snakeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={snakeGradStart} />
                      <stop offset="100%" stopColor={snakeGradEnd} />
                    </linearGradient>
                  </defs>
                </>
              )}

              {eyePositions.map((p, i) => (
                <g key={i}>
                  <circle cx={p.x} cy={p.y} r={eyeRadius + 0.6} fill="#0a1f0d" />
                  <circle cx={p.x} cy={p.y} r={eyeRadius} fill="#ffffff" />
                </g>
              ))}
            </svg>

            {/* Coin */}
            {snake.length > 0 && (
              <div
                className="absolute"
                style={{
                  left: food.x * cellSize,
                  top: food.y * cellSize,
                  width: cellSize,
                  height: cellSize,
                  pointerEvents: 'none',
                  padding: cellSize * 0.06,
                }}
              >
                <Coin size={cellSize * 0.88} type={food.type} />
              </div>
            )}

            {/* START OVERLAY */}
            {!hasStarted && !isGameOver && !showShop && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center rounded-[20px]"
                style={{ background: 'rgba(78,56,38,0.96)', padding: '16px' }}
              >
                <p
                  className="text-[10px] font-semibold uppercase tracking-[0.32em]"
                  style={{ color: '#a8e0a4' }}
                >
                  Softgame
                </p>
                <h1
                  className="mt-3 text-center text-[22px] font-semibold tracking-tight sm:text-[26px]"
                  style={{ color: '#ffffff' }}
                >
                  Ready to play?
                </h1>

                <div className="mt-5 flex gap-1.5">
                  {(Object.keys(DIFFICULTIES) as Difficulty[]).map((d) => {
                    const active = difficulty === d;
                    return (
                      <button
                        key={d}
                        onClick={() => setDifficulty(d)}
                        className="rounded-full border px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] transition-all"
                        style={{
                          borderColor: active ? '#a8e0a4' : 'rgba(255,255,255,0.2)',
                          background: active ? '#a8e0a4' : 'rgba(255,255,255,0.05)',
                          color: active ? '#3a2718' : 'rgba(255,255,255,0.75)',
                          minHeight: 36,
                        }}
                      >
                        {DIFFICULTIES[d].label}
                      </button>
                    );
                  })}
                </div>

                {powerUps.extraLife || powerUps.slowStart ? (
                  <p
                    className="mt-3 text-[10.5px] font-semibold uppercase tracking-[0.14em]"
                    style={{ color: '#e8c667' }}
                  >
                    {powerUps.extraLife && '❤️ Extra life'}
                    {powerUps.extraLife && powerUps.slowStart && ' · '}
                    {powerUps.slowStart && '🐢 Slow start'}
                  </p>
                ) : (
                  <p
                    className="mt-3 text-[11.5px] font-medium"
                    style={{ color: 'rgba(255,255,255,0.5)' }}
                  >
                    {DIFFICULTIES[difficulty].sub}
                  </p>
                )}

                <div className="mt-5 flex gap-2">
                  <button
                    onClick={startGame}
                    className="rounded-full px-7 py-3.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition-all"
                    style={{
                      background: '#a8e0a4',
                      color: '#3a2718',
                      boxShadow: '0 4px 12px -4px rgba(168,224,164,0.5)',
                      minHeight: 44,
                    }}
                  >
                    Start
                  </button>
                  <button
                    onClick={() => setShowShop(true)}
                    className="rounded-full border px-6 py-3.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition-all"
                    style={{
                      borderColor: 'rgba(232,198,103,0.5)',
                      background: 'rgba(232,198,103,0.08)',
                      color: '#e8c667',
                      minHeight: 44,
                    }}
                  >
                    Shop
                  </button>
                </div>
              </div>
            )}

            {/* SHOP OVERLAY */}
            {showShop && !isGameOver && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-start rounded-[20px] overflow-y-auto"
                style={{ background: 'rgba(78,56,38,0.98)', padding: '20px 16px' }}
              >
                <p
                  className="text-[10px] font-semibold uppercase tracking-[0.32em]"
                  style={{ color: '#e8c667' }}
                >
                  Shop
                </p>
                <p
                  className="mt-2 font-mono text-[18px] font-semibold"
                  style={{ color: '#ffffff' }}
                >
                  ₦{wallet.toLocaleString()}
                </p>

                <div className="mt-5 w-full flex flex-col gap-2">
                  {/* Extra life */}
                  <button
                    onClick={() => buyItem('extraLife')}
                    disabled={wallet < SHOP_ITEMS.extraLife.price || powerUps.extraLife}
                    className="flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left transition-all disabled:opacity-40"
                    style={{
                      borderColor: powerUps.extraLife ? '#a8e0a4' : 'rgba(255,255,255,0.15)',
                      background: powerUps.extraLife ? 'rgba(168,224,164,0.12)' : 'rgba(255,255,255,0.03)',
                    }}
                  >
                    <div>
                      <p className="text-[12px] font-semibold" style={{ color: '#ffffff' }}>
                        {powerUps.extraLife ? '❤️ Extra life ✓' : '❤️ Extra life'}
                      </p>
                      <p className="text-[10.5px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
                        {SHOP_ITEMS.extraLife.sub}
                      </p>
                    </div>
                    <span className="font-mono text-[12px] font-semibold" style={{ color: '#e8c667' }}>
                      ₦{SHOP_ITEMS.extraLife.price}
                    </span>
                  </button>

                  {/* Slow start */}
                  <button
                    onClick={() => buyItem('slowStart')}
                    disabled={wallet < SHOP_ITEMS.slowStart.price || powerUps.slowStart}
                    className="flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left transition-all disabled:opacity-40"
                    style={{
                      borderColor: powerUps.slowStart ? '#a8e0a4' : 'rgba(255,255,255,0.15)',
                      background: powerUps.slowStart ? 'rgba(168,224,164,0.12)' : 'rgba(255,255,255,0.03)',
                    }}
                  >
                    <div>
                      <p className="text-[12px] font-semibold" style={{ color: '#ffffff' }}>
                        {powerUps.slowStart ? '🐢 Slow start ✓' : '🐢 Slow start'}
                      </p>
                      <p className="text-[10.5px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
                        {SHOP_ITEMS.slowStart.sub}
                      </p>
                    </div>
                    <span className="font-mono text-[12px] font-semibold" style={{ color: '#e8c667' }}>
                      ₦{SHOP_ITEMS.slowStart.price}
                    </span>
                  </button>

                  {/* Gold skin */}
                  <button
                    onClick={() => buyItem('goldSkin')}
                    disabled={wallet < SHOP_ITEMS.goldSkin.price || skin === 'gold'}
                    className="flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left transition-all disabled:opacity-40"
                    style={{
                      borderColor: skin === 'gold' ? '#e8c667' : 'rgba(255,255,255,0.15)',
                      background: skin === 'gold' ? 'rgba(232,198,103,0.12)' : 'rgba(255,255,255,0.03)',
                    }}
                  >
                    <div>
                      <p className="text-[12px] font-semibold" style={{ color: '#ffffff' }}>
                        {skin === 'gold' ? '✨ Golden snake ✓' : '✨ Golden snake'}
                      </p>
                      <p className="text-[10.5px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
                        {SHOP_ITEMS.goldSkin.sub}
                      </p>
                    </div>
                    <span className="font-mono text-[12px] font-semibold" style={{ color: '#e8c667' }}>
                      ₦{SHOP_ITEMS.goldSkin.price}
                    </span>
                  </button>
                </div>

                <button
                  onClick={() => setShowShop(false)}
                  className="mt-6 rounded-full border px-6 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.18em]"
                  style={{
                    borderColor: 'rgba(255,255,255,0.2)',
                    background: 'transparent',
                    color: 'rgba(255,255,255,0.7)',
                    minHeight: 40,
                  }}
                >
                  Back
                </button>
              </div>
            )}

            {/* PAUSED */}
            {isPaused && !isGameOver && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center rounded-[20px]"
                style={{ background: 'rgba(78,56,38,0.96)' }}
              >
                <p
                  className="text-[10px] font-semibold uppercase tracking-[0.32em]"
                  style={{ color: '#a8e0a4' }}
                >
                  Paused
                </p>
                <p
                  className="mt-3 text-[12px] font-medium"
                  style={{ color: 'rgba(255,255,255,0.6)' }}
                >
                  Press Space to resume
                </p>
              </div>
            )}

            {/* GAME OVER */}
            {isGameOver && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center rounded-[20px]"
                style={{ background: 'rgba(78,56,38,0.97)', padding: '16px' }}
              >
                <p
                  className="text-[10px] font-semibold uppercase tracking-[0.32em]"
                  style={{ color: '#a8e0a4' }}
                >
                  Softgame
                </p>
                <h2
                  className="mt-3 font-mono text-[32px] font-semibold leading-none"
                  style={{ color: '#ffffff' }}
                >
                  ₦{score.toLocaleString()}
                </h2>
                <p
                  className="mt-2 text-[11px] font-semibold uppercase tracking-[0.2em]"
                  style={{ color: 'rgba(255,255,255,0.55)' }}
                >
                  Best · ₦{highScore.toLocaleString()}
                </p>
                <p
                  className="mt-3 text-[10.5px] font-semibold uppercase tracking-[0.14em]"
                  style={{ color: '#e8c667' }}
                >
                  Wallet · ₦{wallet.toLocaleString()}
                </p>
                <button
                  onClick={resetGame}
                  className="mt-6 rounded-full px-8 py-3.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition-all"
                  style={{
                    background: '#a8e0a4',
                    color: '#3a2718',
                    boxShadow: '0 4px 12px -4px rgba(168,224,164,0.5)',
                    minHeight: 44,
                  }}
                >
                  Play again
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer hint */}
        <div className="mt-5 flex items-center gap-2.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Arrows
          </span>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: 'rgba(255,255,255,0.55)' }}>
            WASD
          </span>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Swipe
          </span>
        </div>
      </div>
    </div>
  );
}