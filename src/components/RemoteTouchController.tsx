import React, { useState, useEffect } from 'react';
import { CustomGridStyle, GridSize, ThemeConfig } from '../types.ts';
import { PatternGrid } from './PatternGrid.tsx';
import { arePatternsEqual } from '../utils/patternLogic.ts';
import { playErrorSound, playLockSound, playSuccessSound, triggerHaptic } from '../utils/sound.ts';
import { sendSyncMessage } from '../utils/syncChannel.ts';
import {
  Smartphone,
  Lock,
  Unlock,
  Wifi,
  Radio,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Sliders,
} from 'lucide-react';

interface RemoteTouchControllerProps {
  masterPattern: number[];
  gridSize: GridSize;
  theme: ThemeConfig;
  customStyle: CustomGridStyle;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  hideTrail: boolean;
  showNumbers: boolean;
  sessionId: string;
  onExitRemoteMode: () => void;
  onOpenSettings: () => void;
}

export const RemoteTouchController: React.FC<RemoteTouchControllerProps> = ({
  masterPattern,
  gridSize,
  theme,
  customStyle,
  soundEnabled,
  hapticsEnabled,
  hideTrail,
  showNumbers,
  sessionId,
  onExitRemoteMode,
  onOpenSettings,
}) => {
  const [status, setStatus] = useState<'idle' | 'drawing' | 'success' | 'error'>('idle');
  const [feedback, setFeedback] = useState('Desliza tu dedo para desbloquear tu PC');
  const [unlockCount, setUnlockCount] = useState(0);

  const [realDeviceName, setRealDeviceName] = useState<string>('Teléfono Móvil');
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);

  // Send Hello on mount with real device telemetry
  useEffect(() => {
    let devName = 'Teléfono Móvil';
    const ua = navigator.userAgent;
    if (/Moto|Motorola/i.test(ua)) {
      if (/edge/i.test(ua)) devName = 'Motorola Edge';
      else if (/razr/i.test(ua)) devName = 'Motorola Razr';
      else if (/thinkphone/i.test(ua)) devName = 'Motorola ThinkPhone';
      else if (/moto\s*g/i.test(ua)) devName = 'Motorola Moto G';
      else if (/moto\s*e/i.test(ua)) devName = 'Motorola Moto E';
      else devName = 'Motorola Smartphone';
    } else if (/Samsung/i.test(ua)) {
      devName = 'Samsung Galaxy';
    } else if (/iPhone/i.test(ua)) {
      devName = 'Apple iPhone';
    } else if (/Pixel/i.test(ua)) {
      devName = 'Google Pixel';
    } else if (/Xiaomi/i.test(ua)) {
      devName = 'Xiaomi';
    } else if (/Android/i.test(ua)) {
      devName = 'Smartphone Android';
    }
    setRealDeviceName(devName);

    // Read real battery if supported
    const notifyConnect = (batPercent?: number) => {
      const batStr = batPercent !== undefined ? ` (Bat: ${batPercent}%)` : '';
      const fullDevInfo = `${devName}${batStr}`;
      sendSyncMessage({
        type: 'DEVICE_CONNECTED',
        sessionId,
        deviceInfo: fullDevInfo,
      });
    };

    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        const pct = Math.round(battery.level * 100);
        setBatteryLevel(pct);
        notifyConnect(pct);
      }).catch(() => {
        notifyConnect();
      });
    } else {
      notifyConnect();
    }
  }, [sessionId]);

  const handlePatternChange = (currentTrail: number[]) => {
    if (currentTrail.length === 0) return;
    const lastNode = currentTrail[currentTrail.length - 1];
    const row = Math.floor(lastNode / gridSize);
    const col = lastNode % gridSize;

    // Send real-time touch position and trail
    sendSyncMessage({
      type: 'REAL_TOUCH_MOVE',
      sessionId,
      touchData: {
        xRatio: (col + 0.5) / gridSize,
        yRatio: (row + 0.5) / gridSize,
        isDrawing: true,
        nodeIndex: lastNode,
        activeTrail: currentTrail,
      },
      payload: { length: currentTrail.length, lastNode, trail: currentTrail },
    });
  };

  const handlePatternComplete = (pattern: number[]) => {
    const isMatch = arePatternsEqual(pattern, masterPattern);

    // Clear active touch stroke on mirror
    sendSyncMessage({
      type: 'REAL_TOUCH_MOVE',
      sessionId,
      touchData: {
        xRatio: 0.5,
        yRatio: 0.5,
        isDrawing: false,
        activeTrail: [],
      },
    });

    if (isMatch) {
      setStatus('success');
      setFeedback('¡Desbloqueo remoto enviado con éxito a tu PC!');
      playSuccessSound(soundEnabled);
      triggerHaptic('success', hapticsEnabled);
      setUnlockCount((prev) => prev + 1);

      // Broadcast unlock event to the connected desktop!
      sendSyncMessage({
        type: 'UNLOCK_SUCCESS',
        sessionId,
        payload: { patternLength: pattern.length, device: realDeviceName },
      });

      setTimeout(() => {
        setStatus('idle');
        setFeedback('Desliza tu dedo para desbloquear tu PC');
      }, 1800);
    } else {
      setStatus('error');
      setFeedback('Patrón incorrecto. Intenta de nuevo.');
      playErrorSound(soundEnabled);
      triggerHaptic('error', hapticsEnabled);

      sendSyncMessage({
        type: 'PATTERN_COMPLETE',
        sessionId,
        payload: { success: false },
      });

      setTimeout(() => {
        setStatus('idle');
        setFeedback('Desliza tu dedo para desbloquear tu PC');
      }, 1500);
    }
  };

  const handleRemoteLock = () => {
    playLockSound(soundEnabled);
    triggerHaptic('medium', hapticsEnabled);
    sendSyncMessage({
      type: 'LOCK_DEVICE',
      sessionId,
    });
    setFeedback('Comando de bloqueo enviado a la computadora.');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 max-w-md mx-auto select-none touch-none">
      {/* Top Remote Status Bar */}
      <div className="w-full pt-2">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
          <button
            onClick={onExitRemoteMode}
            className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Modo Normal</span>
          </button>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 font-mono text-[11px]">
            <Radio className="w-3 h-3 animate-pulse" />
            <span>Enlazado (Sesión {sessionId})</span>
          </div>

          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded-lg bg-slate-900 text-slate-300 hover:text-white"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>

        <div className="text-center mt-2">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30 mb-2">
            <Smartphone className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-white">Mando Táctil Remoto</h2>
          <p className="text-xs text-slate-400">
            Control de desbloqueo biométrico en tiempo real
          </p>
        </div>

        {/* Dynamic status pill */}
        <div className="mt-3 flex items-center justify-center">
          <div
            className={`text-xs px-4 py-1.5 rounded-full font-medium transition-all flex items-center gap-1.5 ${
              status === 'error'
                ? 'bg-rose-950 text-rose-300 border border-rose-500/50'
                : status === 'success'
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/50'
                : 'bg-slate-900 text-slate-300 border border-slate-800'
            }`}
          >
            {status === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
            {status === 'error' && <AlertCircle className="w-3.5 h-3.5 text-rose-400" />}
            <span>{feedback}</span>
          </div>
        </div>
      </div>

      {/* Main Touch Pattern Pad */}
      <div className="my-auto py-4">
        <PatternGrid
          gridSize={gridSize}
          theme={theme}
          customStyle={customStyle}
          status={status}
          hideTrail={hideTrail}
          soundEnabled={soundEnabled}
          hapticsEnabled={hapticsEnabled}
          showNumbers={showNumbers}
          onPatternChange={handlePatternChange}
          onPatternComplete={handlePatternComplete}
        />
      </div>

      {/* Bottom Remote Commands */}
      <div className="w-full space-y-2 pb-2">
        <div className="flex gap-2">
          <button
            onClick={handleRemoteLock}
            className="flex-1 py-3 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-2xl text-xs font-semibold text-rose-400 flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <Lock className="w-4 h-4" />
            <span>Bloquear Computadora</span>
          </button>
        </div>

        <div className="text-center text-[10px] text-slate-500">
          Desbloqueos remotos exitosos en esta sesión: {unlockCount}
        </div>
      </div>
    </div>
  );
};
