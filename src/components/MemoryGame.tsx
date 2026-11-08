import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PatternGrid } from './PatternGrid.tsx';
import { CustomGridStyle, GridSize, ThemeConfig } from '../types.ts';
import { arePatternsEqual, getCoordinates, getIdFromCoordinates, getIntermediateNodes } from '../utils/patternLogic.ts';
import { playErrorSound, playSuccessSound, playDotSound, triggerHaptic } from '../utils/sound.ts';
import { Brain, Trophy, Zap, Play, RotateCcw, Award, CheckCircle2, XCircle, Flame } from 'lucide-react';

interface MemoryGameProps {
  theme: ThemeConfig;
  gridSize: GridSize;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  showNumbers: boolean;
  customStyle?: Partial<CustomGridStyle>;
}

export const MemoryGame: React.FC<MemoryGameProps> = ({
  theme,
  gridSize,
  soundEnabled,
  hapticsEnabled,
  showNumbers,
  customStyle,
}) => {
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [highScore, setHighScore] = useState(0);

  // 'idle' | 'showing' | 'player_turn' | 'success' | 'failed'
  const [gameState, setGameState] = useState<'idle' | 'showing' | 'player_turn' | 'success' | 'failed'>('idle');
  const [targetPattern, setTargetPattern] = useState<number[]>([]);
  const [animatedSequence, setAnimatedSequence] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<string>('Pulsa "Comenzar Reto" para iniciar el entrenamiento');
  const [gridStatus, setGridStatus] = useState<'idle' | 'drawing' | 'success' | 'error'>('idle');

  const timeoutRefs = useRef<NodeJS.Timeout[]>([]);

  const clearAllTimeouts = () => {
    timeoutRefs.current.forEach((t) => clearTimeout(t));
    timeoutRefs.current = [];
  };

  useEffect(() => {
    return () => clearAllTimeouts();
  }, []);

  // Generate a random valid pattern of specified length
  const generateRandomPattern = useCallback(
    (length: number): number[] => {
      const totalDots = gridSize * gridSize;
      const pattern: number[] = [];
      const visited = new Set<number>();

      let current = Math.floor(Math.random() * totalDots);
      pattern.push(current);
      visited.add(current);

      while (pattern.length < length) {
        // Collect candidate dots
        const candidates: number[] = [];
        for (let i = 0; i < totalDots; i++) {
          if (!visited.has(i)) {
            candidates.push(i);
          }
        }
        if (candidates.length === 0) break;

        // Pick a candidate that doesn't skip too many nodes or is adjacent
        const next = candidates[Math.floor(Math.random() * candidates.length)];
        const intermediate = getIntermediateNodes(current, next, gridSize, visited);

        // Add intermediate nodes first
        for (const inter of intermediate) {
          if (!visited.has(inter) && pattern.length < length) {
            pattern.push(inter);
            visited.add(inter);
          }
        }

        if (pattern.length < length && !visited.has(next)) {
          pattern.push(next);
          visited.add(next);
          current = next;
        }
      }

      return pattern;
    },
    [gridSize]
  );

  const startLevel = useCallback(
    (lvl: number) => {
      clearAllTimeouts();
      // Length grows with level (min 4, max 9 for 3x3)
      const targetLength = Math.min(gridSize * gridSize, 3 + lvl);
      const newPattern = generateRandomPattern(targetLength);
      setTargetPattern(newPattern);
      setGameState('showing');
      setGridStatus('idle');
      setAnimatedSequence([]);
      setFeedback(`Nivel ${lvl}: Observa y memoriza el patrón (${newPattern.length} nodos)...`);

      // Play step-by-step animation
      const speed = Math.max(200, 500 - lvl * 25);

      newPattern.forEach((_, idx) => {
        const t = setTimeout(() => {
          setAnimatedSequence(newPattern.slice(0, idx + 1));
          playDotSound(idx, soundEnabled);
          triggerHaptic('light', hapticsEnabled);
        }, (idx + 1) * speed);
        timeoutRefs.current.push(t);
      });

      const finishAnimation = setTimeout(() => {
        setAnimatedSequence([]);
        setGameState('player_turn');
        setFeedback('¡Tu turno! Dibuja la secuencia exacta.');
      }, (newPattern.length + 1) * speed + 200);
      timeoutRefs.current.push(finishAnimation);
    },
    [generateRandomPattern, gridSize, hapticsEnabled, soundEnabled]
  );

  const handleStartGame = () => {
    setLevel(1);
    setScore(0);
    setStreak(0);
    startLevel(1);
  };

  const handleReplayPattern = () => {
    if (targetPattern.length === 0 || gameState === 'showing') return;
    clearAllTimeouts();
    setGameState('showing');
    setAnimatedSequence([]);
    setFeedback('Repitiendo patrón...');

    targetPattern.forEach((_, idx) => {
      const t = setTimeout(() => {
        setAnimatedSequence(targetPattern.slice(0, idx + 1));
        playDotSound(idx, soundEnabled);
      }, (idx + 1) * 350);
      timeoutRefs.current.push(t);
    });

    const finish = setTimeout(() => {
      setAnimatedSequence([]);
      setGameState('player_turn');
      setFeedback('¡Tu turno! Dibuja la secuencia exacta.');
    }, (targetPattern.length + 1) * 350 + 200);
    timeoutRefs.current.push(finish);
  };

  const handlePatternComplete = (pattern: number[]) => {
    if (gameState !== 'player_turn') return;

    const isCorrect = arePatternsEqual(pattern, targetPattern);

    if (isCorrect) {
      setGridStatus('success');
      setGameState('success');
      playSuccessSound(soundEnabled);
      triggerHaptic('success', hapticsEnabled);

      const addedScore = 100 * level + streak * 25;
      const newScore = score + addedScore;
      const newStreak = streak + 1;

      setScore(newScore);
      setStreak(newStreak);
      if (newStreak > bestStreak) setBestStreak(newStreak);
      if (newScore > highScore) setHighScore(newScore);

      setFeedback(`¡Perfecto! +${addedScore} puntos. Pasando al Nivel ${level + 1}...`);

      const t = setTimeout(() => {
        const nextLvl = level + 1;
        setLevel(nextLvl);
        startLevel(nextLvl);
      }, 1400);
      timeoutRefs.current.push(t);
    } else {
      setGridStatus('error');
      setGameState('failed');
      playErrorSound(soundEnabled);
      triggerHaptic('error', hapticsEnabled);
      setStreak(0);
      setFeedback('¡Patrón incorrecto! Puedes repetir la demostración o reintentar.');
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-2 px-3">
      {/* Top Game Header & Stats Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 mb-4 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Entrenamiento y Desafío de Memoria
              </h2>
              <p className="text-xs text-slate-400">
                Memoriza las secuencias de patrones a alta velocidad y fortalece tu memoria espacial.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {gameState === 'idle' ? (
              <button
                onClick={handleStartGame}
                className="w-full sm:w-auto px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/40 transition-all active:scale-95"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                <span>Comenzar Reto</span>
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={handleReplayPattern}
                  disabled={gameState === 'showing'}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Repetir Demo</span>
                </button>
                <button
                  onClick={handleStartGame}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors"
                >
                  Reiniciar
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800/80">
          <div className="bg-slate-950/80 rounded-2xl p-2.5 border border-slate-800/80 text-center">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Nivel</span>
            <div className="text-xl font-black text-cyan-400 font-mono mt-0.5">{level}</div>
          </div>
          <div className="bg-slate-950/80 rounded-2xl p-2.5 border border-slate-800/80 text-center">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Puntuación</span>
            <div className="text-xl font-black text-white font-mono mt-0.5">{score}</div>
          </div>
          <div className="bg-slate-950/80 rounded-2xl p-2.5 border border-slate-800/80 text-center">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold flex items-center justify-center gap-1">
              <Flame className="w-3 h-3 text-amber-400" /> Racha
            </span>
            <div className="text-xl font-black text-amber-400 font-mono mt-0.5">{streak}</div>
          </div>
          <div className="bg-slate-950/80 rounded-2xl p-2.5 border border-slate-800/80 text-center">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold flex items-center justify-center gap-1">
              <Trophy className="w-3 h-3 text-yellow-400" /> Récord
            </span>
            <div className="text-xl font-black text-yellow-400 font-mono mt-0.5">{highScore}</div>
          </div>
        </div>
      </div>

      {/* Main Game Board */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 flex flex-col items-center">
        {/* State Banner */}
        <div
          className={`w-full max-w-md py-2.5 px-4 rounded-2xl text-xs font-semibold text-center mb-4 transition-all flex items-center justify-center gap-2 ${
            gameState === 'showing'
              ? 'bg-cyan-950/70 border border-cyan-500/40 text-cyan-300'
              : gameState === 'player_turn'
              ? 'bg-amber-950/60 border border-amber-500/40 text-amber-300'
              : gameState === 'success'
              ? 'bg-emerald-950/70 border border-emerald-500/40 text-emerald-300'
              : gameState === 'failed'
              ? 'bg-rose-950/70 border border-rose-500/40 text-rose-300'
              : 'bg-slate-950 border border-slate-800 text-slate-300'
          }`}
        >
          {gameState === 'showing' && <Zap className="w-4 h-4 animate-bounce text-cyan-400" />}
          {gameState === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          {gameState === 'failed' && <XCircle className="w-4 h-4 text-rose-400" />}
          <span>{feedback}</span>
        </div>

        {/* Pattern Grid with active animation / player drawing */}
        <div className="w-full flex justify-center py-2">
          <PatternGrid
            gridSize={gridSize}
            theme={theme}
            customStyle={customStyle}
            status={gridStatus}
            soundEnabled={soundEnabled}
            hapticsEnabled={hapticsEnabled}
            disabled={gameState !== 'player_turn'}
            onPatternComplete={handlePatternComplete}
            highlightPattern={animatedSequence}
            showNumbers={showNumbers}
          />
        </div>

        {/* Action Controls for failed state */}
        {gameState === 'failed' && (
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => {
                setGridStatus('idle');
                setGameState('player_turn');
                setFeedback('Reintentando... Dibuja el patrón');
              }}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl shadow-md transition-colors"
            >
              Reintentar Trazado
            </button>
            <button
              onClick={handleReplayPattern}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors"
            >
              Ver Demostración de Nuevo
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
