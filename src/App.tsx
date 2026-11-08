import React, { useState, useEffect } from 'react';
import { AppMode, CustomGridStyle, GridSize, ThemeConfig, ThemeId, UnlockAttempt } from './types.ts';
import { THEMES } from './utils/themes.ts';
import { LockScreen } from './components/LockScreen.tsx';
import { PatternAnalyzer } from './components/PatternAnalyzer.tsx';
import { VaultView } from './components/VaultView.tsx';
import { MemoryGame } from './components/MemoryGame.tsx';
import { SettingsModal } from './components/SettingsModal.tsx';
import { PhoneConnectModal } from './components/PhoneConnectModal.tsx';
import { RemoteTouchController } from './components/RemoteTouchController.tsx';
import { UnlockAgentModal } from './components/UnlockAgentModal.tsx';
import { PhoneScreenMirror } from './components/PhoneScreenMirror.tsx';
import { DeviceDataViewer } from './components/DeviceDataViewer.tsx';
import {
  initAuth,
  signInWithGoogle,
  logoutGoogle,
  testFirestoreConnection,
  saveAttemptToFirestore,
  loadUserAttemptsFromFirestore,
} from './lib/firebase.ts';
import type { User } from 'firebase/auth';
import { playClickSound, playLockSound, playSuccessSound } from './utils/sound.ts';
import { subscribeToSyncMessages } from './utils/syncChannel.ts';
import { arePatternsEqual } from './utils/patternLogic.ts';
import {
  Lock,
  Unlock,
  ShieldCheck,
  Brain,
  Sliders,
  Palette,
  Sparkles,
  Smartphone,
  Check,
  Shapes,
  Radio,
  Wifi,
  Cable,
  Usb,
  QrCode,
  Bot,
  Database,
} from 'lucide-react';

const DEFAULT_MASTER_PATTERN = [0, 1, 2, 4, 6, 7, 8]; // Classic Z pattern for initial demo

const DEFAULT_CUSTOM_STYLE: CustomGridStyle = {
  nodeShape: 'dots',
  nodeColor: '#334155',
  connectionColor: '#06b6d4',
  successColor: '#10b981',
  errorColor: '#f43f5e',
  lineWidth: 'medium',
  glowIntensity: 'vibrant',
  gridBg: 'clean',
};

function generateSessionId(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `PAIR-${num}`;
}

export default function App() {
  // Check if current device opened as Remote Controller (e.g. from Phone scanning QR)
  const [isRemoteControllerMode, setIsRemoteControllerMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('mode') === 'remote';
  });

  // Pairing Session ID
  const [sessionId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const pair = params.get('pair');
      if (pair) return pair;
      const saved = localStorage.getItem('patternlock_session_id');
      if (saved) return saved;
      const created = generateSessionId();
      localStorage.setItem('patternlock_session_id', created);
      return created;
    }
    return 'PAIR-7720';
  });

  // Master pattern & unlock state
  const [masterPattern, setMasterPattern] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('patternlock_master');
      return saved ? JSON.parse(saved) : DEFAULT_MASTER_PATTERN;
    } catch {
      return DEFAULT_MASTER_PATTERN;
    }
  });

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [appMode, setAppMode] = useState<AppMode>('lockscreen');
  const [gridSize, setGridSize] = useState<GridSize>(3);
  const [themeId, setThemeId] = useState<ThemeId>('cyber-neon');

  // Customization Style State (Shapes & Colors)
  const [customStyle, setCustomStyle] = useState<CustomGridStyle>(() => {
    try {
      const saved = localStorage.getItem('patternlock_custom_style');
      return saved ? JSON.parse(saved) : DEFAULT_CUSTOM_STYLE;
    } catch {
      return DEFAULT_CUSTOM_STYLE;
    }
  });

  // Toggles & preferences
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [hideTrail, setHideTrail] = useState(false);
  const [showNumbers, setShowNumbers] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPhoneConnectOpen, setIsPhoneConnectOpen] = useState(false);
  const [isAgentOpen, setIsAgentOpen] = useState(false);
  const [pairedDevice, setPairedDevice] = useState<string | null>(() => {
    try {
      return localStorage.getItem('patternlock_paired_device');
    } catch {
      return null;
    }
  });
  const [toastNotification, setToastNotification] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isSigningInGoogle, setIsSigningInGoogle] = useState(false);

  // Security attempt log
  const [unlockAttempts, setUnlockAttempts] = useState<UnlockAttempt[]>(() => {
    try {
      const saved = localStorage.getItem('patternlock_attempts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Test Firestore connection on boot and attach auth listener
  useEffect(() => {
    testFirestoreConnection();
    const unsubscribe = initAuth(
      async (user) => {
        setCurrentUser(user);
        try {
          const cloudAttempts = await loadUserAttemptsFromFirestore(user.uid);
          if (cloudAttempts && cloudAttempts.length > 0) {
            setUnlockAttempts((prev) => {
              const map = new Map<string, UnlockAttempt>();
              [...cloudAttempts, ...prev].forEach((a) => map.set(a.id, a));
              return Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
            });
          }
        } catch (err) {
          console.warn('Could not load user attempts from firestore:', err);
        }
      },
      () => {
        setCurrentUser(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleGoogleSignIn = async () => {
    playClickSound(soundEnabled);
    setIsSigningInGoogle(true);
    try {
      const res = await signInWithGoogle();
      if (res?.user) {
        showToast(`¡Bienvenido ${res.user.displayName || res.user.email}! Sesión iniciada con Google.`);
        playSuccessSound(soundEnabled);
      }
    } catch (err: any) {
      console.error('Sign-in error:', err);
      showToast('No se pudo completar el inicio de sesión con Google');
    } finally {
      setIsSigningInGoogle(false);
    }
  };

  const handleGoogleSignOut = async () => {
    playClickSound(soundEnabled);
    await logoutGoogle();
    showToast('Sesión de Google cerrada.');
  };

  // Sync to local storage
  useEffect(() => {
    try {
      localStorage.setItem('patternlock_master', JSON.stringify(masterPattern));
    } catch {
      // ignore
    }
  }, [masterPattern]);

  useEffect(() => {
    try {
      localStorage.setItem('patternlock_custom_style', JSON.stringify(customStyle));
    } catch {
      // ignore
    }
  }, [customStyle]);

  useEffect(() => {
    try {
      localStorage.setItem('patternlock_attempts', JSON.stringify(unlockAttempts));
    } catch {
      // ignore
    }
  }, [unlockAttempts]);

  useEffect(() => {
    if (pairedDevice) {
      localStorage.setItem('patternlock_paired_device', pairedDevice);
    } else {
      localStorage.removeItem('patternlock_paired_device');
    }
  }, [pairedDevice]);

  // Subscribe to real-time phone sync messages
  useEffect(() => {
    const unsubscribe = subscribeToSyncMessages((msg) => {
      if (msg.sessionId !== sessionId) return;

      if (msg.type === 'DEVICE_CONNECTED') {
        const devName = msg.deviceInfo || 'Teléfono Móvil';
        setPairedDevice(devName);
        showToast(`📱 ${devName} conectado en tiempo real`);
        playSuccessSound(soundEnabled);
      } else if (msg.type === 'UNLOCK_SUCCESS') {
        setIsUnlocked(true);
        setAppMode('vault');
        playSuccessSound(soundEnabled);
        showToast('🔓 ¡Desbloqueado remotamente desde tu teléfono!');
        handleRecordAttempt({
          success: true,
          length: msg.payload?.patternLength || 5,
          patternMasked: '●●●●●',
          deviceInfo: `Mando Remoto (${pairedDevice || 'Teléfono Móvil'})`,
        });
      } else if (msg.type === 'LOCK_DEVICE') {
        setIsUnlocked(false);
        setAppMode('lockscreen');
        playLockSound(soundEnabled);
        showToast('🔒 Computadora bloqueada desde el teléfono');
      }
    }, sessionId);

    return () => unsubscribe();
  }, [pairedDevice, sessionId, soundEnabled]);

  const showToast = (text: string) => {
    setToastNotification(text);
    setTimeout(() => {
      setToastNotification((curr) => (curr === text ? null : curr));
    }, 3800);
  };

  const activeTheme: ThemeConfig = THEMES[themeId] || THEMES['cyber-neon'];

  const handleUnlockSuccess = () => {
    setIsUnlocked(true);
    setAppMode('vault');
  };

  const handleLockDevice = () => {
    playLockSound(soundEnabled);
    setIsUnlocked(false);
    setAppMode('lockscreen');
  };

  const handleRecordAttempt = (data: Omit<UnlockAttempt, 'id' | 'timestamp'>) => {
    const newAttempt: UnlockAttempt = {
      ...data,
      id: `attempt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
    };
    setUnlockAttempts((prev) => [newAttempt, ...prev.slice(0, 49)]);

    if (currentUser) {
      saveAttemptToFirestore(newAttempt, currentUser.uid).catch((err) => {
        console.warn('Failed to save attempt to Firestore:', err);
      });
    }
  };

  const handleSaveMasterPattern = (newPattern: number[]) => {
    setMasterPattern(newPattern);
    playSuccessSound(soundEnabled);
  };

  const handleResetToDefaultPattern = () => {
    setMasterPattern(DEFAULT_MASTER_PATTERN);
    playSuccessSound(soundEnabled);
  };

  const handleClearAttempts = () => {
    playClickSound(soundEnabled);
    setUnlockAttempts([]);
  };

  const handleAgentUnlock = (pattern: number[], isMaster: boolean) => {
    playSuccessSound(soundEnabled);
    const isMatch = isMaster || arePatternsEqual(pattern, masterPattern);

    handleRecordAttempt({
      success: isMatch,
      length: pattern.length,
      patternMasked: pattern.map(() => '●').join(''),
      deviceInfo: 'CipherAgent (Gemini 3.8 Flash)',
    });

    if (isMatch) {
      setToastNotification('¡Dispositivo desbloqueado por CipherAgent!');
      setTimeout(() => {
        handleUnlockSuccess();
        setTimeout(() => setToastNotification(null), 3000);
      }, 400);
    } else {
      setToastNotification(`Patrón ejecutado: ${pattern.join(' ➔ ')}`);
      setTimeout(() => setToastNotification(null), 3000);
    }
  };

  // If opened specifically in Remote Phone Controller mode (e.g. from QR scan)
  if (isRemoteControllerMode) {
    return (
      <RemoteTouchController
        masterPattern={masterPattern}
        gridSize={gridSize}
        theme={activeTheme}
        customStyle={customStyle}
        soundEnabled={soundEnabled}
        hapticsEnabled={hapticsEnabled}
        hideTrail={hideTrail}
        showNumbers={showNumbers}
        sessionId={sessionId}
        onExitRemoteMode={() => setIsRemoteControllerMode(false)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
    );
  }

  return (
    <div className={`min-h-screen bg-gradient-to-b ${activeTheme.bgGradient} text-slate-100 flex flex-col relative`}>
      {/* Toast Notification Banner */}
      {toastNotification && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border border-cyan-500/50 shadow-2xl shadow-cyan-950/50 rounded-2xl px-4 py-2.5 flex items-center gap-2 text-xs font-semibold text-white animate-bounce">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span>{toastNotification}</span>
        </div>
      )}

      {/* Top Bar Contract (§2) */}
      <header className="flex items-center justify-between gap-4 sm:gap-8 px-4 sm:px-8 py-3.5 border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md sticky top-0 z-40">
        {/* Zone 1: Single text element Brand wordmark */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-slate-950 shadow-md transition-colors"
            style={{ backgroundColor: customStyle.connectionColor }}
          >
            {isUnlocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          </div>
          <span className="text-base font-extrabold tracking-tight text-white whitespace-nowrap shrink-0">
            PatternLock <span className="text-xs font-mono font-medium text-slate-400">Security</span>
          </span>
        </div>

        {/* Zone 2: 5 single-line clean navigation links */}
        <nav className="hidden md:flex items-center gap-5 text-xs font-semibold text-slate-300">
          <button
            onClick={() => {
              playClickSound(soundEnabled);
              setAppMode('lockscreen');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 py-1 ${
              appMode === 'lockscreen' ? 'text-white border-b-2' : 'hover:text-white'
            }`}
            style={{
              borderColor: appMode === 'lockscreen' ? customStyle.connectionColor : 'transparent',
            }}
          >
            Pantalla de Bloqueo
          </button>
          <button
            onClick={() => {
              playClickSound(soundEnabled);
              setAppMode('mirror');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 py-1 flex items-center gap-1.5 ${
              appMode === 'mirror' ? 'text-white border-b-2 font-bold' : 'hover:text-white'
            }`}
            style={{
              borderColor: appMode === 'mirror' ? '#10b981' : 'transparent',
            }}
          >
            <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
            <span>Pantalla USB en Vivo</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </button>
          <button
            onClick={() => {
              playClickSound(soundEnabled);
              setAppMode('device-data');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 py-1 flex items-center gap-1.5 ${
              appMode === 'device-data' ? 'text-white border-b-2 font-bold' : 'hover:text-white'
            }`}
            style={{
              borderColor: appMode === 'device-data' ? '#06b6d4' : 'transparent',
            }}
          >
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span>Leer Datos Dispositivo</span>
          </button>
          <button
            onClick={() => {
              playClickSound(soundEnabled);
              setAppMode('vault');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 py-1 flex items-center gap-1.5 ${
              appMode === 'vault' ? 'text-white border-b-2' : 'hover:text-white'
            }`}
            style={{
              borderColor: appMode === 'vault' ? customStyle.connectionColor : 'transparent',
            }}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Bóveda Protegida</span>
          </button>
          <button
            onClick={() => {
              playClickSound(soundEnabled);
              setAppMode('analyzer');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 py-1 ${
              appMode === 'analyzer' ? 'text-white border-b-2' : 'hover:text-white'
            }`}
            style={{
              borderColor: appMode === 'analyzer' ? customStyle.connectionColor : 'transparent',
            }}
          >
            Laboratorio & Claves
          </button>
          <button
            onClick={() => {
              playClickSound(soundEnabled);
              setAppMode('game');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 py-1 flex items-center gap-1.5 ${
              appMode === 'game' ? 'text-white border-b-2' : 'hover:text-white'
            }`}
            style={{
              borderColor: appMode === 'game' ? customStyle.connectionColor : 'transparent',
            }}
          >
            <Brain className="w-3.5 h-3.5" />
            <span>Reto</span>
          </button>
        </nav>

        {/* Zone 3: Actions + Google OAuth + Phone Connect & Agent Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Google OAuth Login / User Profile */}
          {currentUser ? (
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 py-1 text-xs shadow-sm">
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName || 'Usuario'}
                  className="w-5 h-5 rounded-full object-cover border border-emerald-400"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-cyan-700 text-[10px] font-bold flex items-center justify-center text-white">
                  {(currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}
                </div>
              )}
              <span className="text-[11px] font-semibold text-slate-200 hidden lg:inline max-w-[110px] truncate">
                {currentUser.displayName || currentUser.email}
              </span>
              <button
                onClick={handleGoogleSignOut}
                className="text-[10px] text-slate-400 hover:text-rose-400 ml-1 font-semibold transition-colors"
                title="Cerrar sesión"
              >
                Salir
              </button>
            </div>
          ) : (
            <button
              onClick={handleGoogleSignIn}
              disabled={isSigningInGoogle}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-xl bg-white hover:bg-slate-100 text-slate-900 border border-slate-300 flex items-center gap-1.5 transition-all shadow-sm active:scale-95 whitespace-nowrap shrink-0"
              title="Acceder con Google OAuth"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              <span className="hidden sm:inline">Google OAuth</span>
              <span className="sm:hidden">OAuth</span>
            </button>
          )}

          {/* Conectar y Leer Todos los Datos Button */}
          <button
            onClick={() => {
              playClickSound(soundEnabled);
              setAppMode('device-data');
            }}
            className="px-3 py-1.5 text-xs font-bold rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-slate-950 flex items-center gap-1.5 transition-all shadow-md active:scale-95 whitespace-nowrap shrink-0"
            title="Conectar con dispositivo y leer todos los datos técnicos y de seguridad"
          >
            <Database className="w-3.5 h-3.5 text-slate-950" />
            <span className="hidden sm:inline">Leer Todos los Datos</span>
            <span className="sm:hidden">Datos</span>
          </button>

          {/* Agente IA Button */}
          <button
            onClick={() => {
              playClickSound(soundEnabled);
              setIsAgentOpen(true);
            }}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-800/80 text-cyan-300 flex items-center gap-1.5 transition-all shadow-sm active:scale-95 whitespace-nowrap shrink-0"
          >
            <Bot className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span className="hidden sm:inline">Agente IA</span>
            <span className="sm:hidden">Agente</span>
          </button>

          {/* Conectar con Teléfono Button (USB / QR) */}
          <button
            onClick={() => {
              playClickSound(soundEnabled);
              setIsPhoneConnectOpen(true);
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              pairedDevice
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                : 'bg-slate-900 border-slate-800 text-slate-200 hover:border-cyan-500/50 hover:text-white'
            }`}
          >
            {pairedDevice?.includes('USB') ? (
              <Cable className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Usb className="w-3.5 h-3.5 text-cyan-400" />
            )}
            <span className="hidden sm:inline">
              {pairedDevice ? pairedDevice : 'Vincular Teléfono (USB / QR)'}
            </span>
            <span className="sm:hidden">
              {pairedDevice ? (pairedDevice.includes('USB') ? 'USB Conectado' : 'Conectado') : 'Vincular USB'}
            </span>
            {pairedDevice ? (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
            )}
          </button>

          {/* Settings Customizer */}
          <button
            onClick={() => {
              playClickSound(soundEnabled);
              setIsSettingsOpen(true);
            }}
            className="px-3.5 py-1.5 text-xs font-bold text-slate-950 rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1.5 whitespace-nowrap shrink-0"
            style={{ backgroundColor: customStyle.connectionColor }}
          >
            <Sliders className="w-3.5 h-3.5 text-slate-950" />
            <span className="hidden sm:inline">Personalizar</span>
          </button>
        </div>
      </header>

      {/* Quick Visual Customization Floating Banner */}
      <div className="w-full bg-slate-900/60 backdrop-blur-sm border-b border-slate-800/80 px-4 py-2">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Quick Shape Selector */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
              <Shapes className="w-3.5 h-3.5 text-cyan-400" /> Forma de Puntos:
            </span>
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              {[
                { id: 'dots', label: 'Puntos', icon: '●' },
                { id: 'circles', label: 'Círculos', icon: '◎' },
                { id: 'squares', label: 'Cuadrados', icon: '■' },
                { id: 'diamonds', label: 'Rombos', icon: '◆' },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    playClickSound(soundEnabled);
                    setCustomStyle((prev) => ({ ...prev, nodeShape: s.id as any }));
                  }}
                  className={`px-2 py-1 rounded-lg font-medium transition-colors flex items-center gap-1 ${
                    customStyle.nodeShape === s.id
                      ? 'bg-slate-800 text-white font-bold shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  style={{
                    color: customStyle.nodeShape === s.id ? customStyle.connectionColor : undefined,
                  }}
                >
                  <span className="text-sm leading-none">{s.icon}</span>
                  <span className="text-[11px]">{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Color Palette */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
              <Palette className="w-3.5 h-3.5 text-cyan-400" /> Color de Conexión:
            </span>
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
              {[
                { name: 'Cian', hex: '#06b6d4' },
                { name: 'Esmeralda', hex: '#10b981' },
                { name: 'Cielo', hex: '#38bdf8' },
                { name: 'Violeta', hex: '#a855f7' },
                { name: 'Ámbar', hex: '#f59e0b' },
                { name: 'Rosa', hex: '#f43f5e' },
                { name: 'Blanco', hex: '#ffffff' },
              ].map((c) => (
                <button
                  key={c.hex}
                  onClick={() => {
                    playClickSound(soundEnabled);
                    setCustomStyle((prev) => ({ ...prev, connectionColor: c.hex }));
                  }}
                  className="w-5 h-5 rounded-full border border-black/40 flex items-center justify-center transition-transform hover:scale-110"
                  style={{ backgroundColor: c.hex }}
                  title={c.name}
                >
                  {customStyle.connectionColor.toLowerCase() === c.hex.toLowerCase() && (
                    <Check className="w-3 h-3 text-slate-950 stroke-[3]" />
                  )}
                </button>
              ))}

              {/* Native color picker */}
              <input
                type="color"
                value={customStyle.connectionColor}
                onChange={(e) => setCustomStyle((prev) => ({ ...prev, connectionColor: e.target.value }))}
                className="w-5 h-5 rounded cursor-pointer border border-slate-700 bg-transparent ml-1"
                title="Color personalizado"
              />
            </div>
          </div>

          {/* Phone Link Status Pill */}
          <button
            onClick={() => {
              playClickSound(soundEnabled);
              setIsPhoneConnectOpen(true);
            }}
            className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-500/50 text-slate-300 transition-colors"
          >
            <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>{pairedDevice ? `📱 ${pairedDevice}` : '📱 Conectar Celular (QR)'}</span>
          </button>
        </div>
      </div>

      {/* Main Responsive Body Canvas */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 py-6 flex flex-col justify-center">
        {/* MODE 1: Lockscreen Simulator */}
        {appMode === 'lockscreen' && (
          <div className="w-full flex flex-col items-center justify-center">
            {/* Realistic smartphone bezel frame on desktop */}
            <div
              className={`relative w-full max-w-[390px] rounded-[48px] p-4 border-[10px] ${activeTheme.phoneFrameClass} transition-all duration-300`}
            >
              {/* Dynamic Island / Speaker Notch */}
              <div className="w-24 h-4 bg-slate-900 border border-slate-800 rounded-full mx-auto mb-2 flex items-center justify-center gap-2">
                <div className="w-2 h-2 rounded-full bg-slate-950" />
                <div className="w-2.5 h-2.5 rounded-full bg-cyan-950 border border-cyan-800" />
              </div>

              {/* Lockscreen Component */}
              <LockScreen
                masterPattern={masterPattern}
                gridSize={gridSize}
                theme={activeTheme}
                customStyle={customStyle}
                hideTrail={hideTrail}
                soundEnabled={soundEnabled}
                hapticsEnabled={hapticsEnabled}
                showNumbers={showNumbers}
                onUnlockSuccess={handleUnlockSuccess}
                onRecordAttempt={handleRecordAttempt}
                onOpenSettings={() => setIsSettingsOpen(true)}
                pairedDevice={pairedDevice}
                onOpenPhoneConnect={() => setIsPhoneConnectOpen(true)}
                onOpenAgent={() => setIsAgentOpen(true)}
              />

              {/* Bottom Home Indicator Bar */}
              <div className="w-32 h-1 bg-slate-700/80 rounded-full mx-auto mt-2" />
            </div>

            {/* Quick Agent & Phone Connect Callout Buttons underneath phone simulator */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => {
                  playClickSound(soundEnabled);
                  setAppMode('mirror');
                }}
                className="px-4 py-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white rounded-2xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-950/40 active:scale-95"
              >
                <Smartphone className="w-4 h-4 text-emerald-200 animate-pulse" />
                <span>Ver Pantalla USB en Tiempo Real & Desbloqueo IA</span>
              </button>

              <button
                onClick={() => {
                  playClickSound(soundEnabled);
                  setIsAgentOpen(true);
                }}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-2xl text-xs font-semibold text-cyan-300 flex items-center gap-1.5 transition-all shadow-md active:scale-95"
              >
                <Bot className="w-4 h-4 text-cyan-400" />
                <span>Agente IA</span>
              </button>

              <button
                onClick={() => {
                  playClickSound(soundEnabled);
                  setAppMode('device-data');
                }}
                className="px-3.5 py-2 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 rounded-2xl text-xs font-bold text-white flex items-center gap-1.5 transition-all shadow-md active:scale-95"
              >
                <Database className="w-4 h-4 text-cyan-200" />
                <span>Leer Datos Dispositivo</span>
              </button>

              <button
                onClick={() => {
                  playClickSound(soundEnabled);
                  setIsPhoneConnectOpen(true);
                }}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 rounded-2xl text-xs font-semibold text-white flex items-center gap-1.5 transition-all shadow-md active:scale-95"
              >
                <Cable className="w-4 h-4 text-cyan-400" />
                <span>Vincular USB</span>
              </button>
            </div>

            {/* Helper tip */}
            <div className="mt-2 text-center max-w-sm">
              <p className="text-[11px] text-slate-400">
                Patrón maestro predeterminado configurado en forma de <span className="font-bold text-cyan-400">"Z"</span> (0 ➔ 1 ➔ 2 ➔ 4 ➔ 6 ➔ 7 ➔ 8).
              </p>
            </div>
          </div>
        )}

        {/* MODE 2: Real-time Phone Screen Mirror over USB */}
        {appMode === 'mirror' && (
          <div className="w-full py-2">
            <PhoneScreenMirror
              masterPattern={masterPattern}
              theme={activeTheme}
              customStyle={customStyle}
              soundEnabled={soundEnabled}
              onUnlockSuccess={handleUnlockSuccess}
              onRecordAttempt={handleRecordAttempt}
              pairedDeviceName={pairedDevice}
              onOpenDeviceData={() => setAppMode('device-data')}
              onClose={() => setAppMode('lockscreen')}
            />
          </div>
        )}

        {/* MODE: Device Full Data Reader & Forensic Dump */}
        {appMode === 'device-data' && (
          <div className="w-full py-2">
            <DeviceDataViewer
              pairedDevice={pairedDevice}
              masterPattern={masterPattern}
              theme={activeTheme}
              customStyle={customStyle}
              soundEnabled={soundEnabled}
              sessionId={sessionId}
              onPairDevice={(dev) => setPairedDevice(dev)}
              onOpenMirror={() => setAppMode('mirror')}
              onUnlockSuccess={handleUnlockSuccess}
              onClose={() => setAppMode('lockscreen')}
            />
          </div>
        )}

        {/* MODE 3: Protected Vault */}
        {appMode === 'vault' && (
          <VaultView
            theme={activeTheme}
            masterPattern={masterPattern}
            gridSize={gridSize}
            soundEnabled={soundEnabled}
            hapticsEnabled={hapticsEnabled}
            customStyle={customStyle}
            unlockAttempts={unlockAttempts}
            onLockDevice={handleLockDevice}
            onClearAttempts={handleClearAttempts}
          />
        )}

        {/* MODE 4: Pattern Analyzer & Security Lab */}
        {appMode === 'analyzer' && (
          <PatternAnalyzer
            currentMasterPattern={masterPattern}
            gridSize={gridSize}
            theme={activeTheme}
            soundEnabled={soundEnabled}
            hapticsEnabled={hapticsEnabled}
            showNumbers={showNumbers}
            customStyle={customStyle}
            onSaveMasterPattern={handleSaveMasterPattern}
            unlockAttempts={unlockAttempts}
            onRecordAttempt={handleRecordAttempt}
            onClearAttempts={handleClearAttempts}
          />
        )}

        {/* MODE 5: Memory Training Challenge Game */}
        {appMode === 'game' && (
          <MemoryGame
            theme={activeTheme}
            gridSize={gridSize}
            soundEnabled={soundEnabled}
            hapticsEnabled={hapticsEnabled}
            showNumbers={showNumbers}
            customStyle={customStyle}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (§3 Pattern 1) */}
      <div className="md:hidden sticky bottom-0 z-40 bg-slate-950/90 backdrop-blur-md border-t border-slate-800 grid grid-cols-6 items-center h-16 px-1">
        <button
          onClick={() => {
            playClickSound(soundEnabled);
            setAppMode('lockscreen');
          }}
          className={`flex flex-col items-center justify-center py-1 transition-colors ${
            appMode === 'lockscreen' ? 'text-cyan-400' : 'text-slate-400'
          }`}
        >
          <Lock className="w-5 h-5" />
          <span className="text-[10px] font-medium tracking-tight mt-1">Bloqueo</span>
        </button>

        <button
          onClick={() => {
            playClickSound(soundEnabled);
            setAppMode('mirror');
          }}
          className={`flex flex-col items-center justify-center py-1 transition-colors ${
            appMode === 'mirror' ? 'text-emerald-400' : 'text-slate-400'
          }`}
        >
          <Smartphone className="w-5 h-5 text-emerald-400" />
          <span className="text-[10px] font-medium tracking-tight mt-1">Espejo</span>
        </button>

        <button
          onClick={() => {
            playClickSound(soundEnabled);
            setAppMode('device-data');
          }}
          className={`flex flex-col items-center justify-center py-1 transition-colors ${
            appMode === 'device-data' ? 'text-cyan-400 font-bold' : 'text-slate-400'
          }`}
        >
          <Database className="w-5 h-5 text-cyan-400" />
          <span className="text-[10px] font-medium tracking-tight mt-1">Datos</span>
        </button>

        <button
          onClick={() => {
            playClickSound(soundEnabled);
            setAppMode('vault');
          }}
          className={`flex flex-col items-center justify-center py-1 transition-colors ${
            appMode === 'vault' ? 'text-cyan-400' : 'text-slate-400'
          }`}
        >
          <ShieldCheck className="w-5 h-5" />
          <span className="text-[10px] font-medium tracking-tight mt-1">Bóveda</span>
        </button>

        <button
          onClick={() => {
            playClickSound(soundEnabled);
            setAppMode('analyzer');
          }}
          className={`flex flex-col items-center justify-center py-1 transition-colors ${
            appMode === 'analyzer' ? 'text-cyan-400' : 'text-slate-400'
          }`}
        >
          <Sparkles className="w-5 h-5" />
          <span className="text-[10px] font-medium tracking-tight mt-1">Claves</span>
        </button>

        <button
          onClick={() => {
            playClickSound(soundEnabled);
            setIsPhoneConnectOpen(true);
          }}
          className="flex flex-col items-center justify-center py-1 transition-colors text-slate-400 hover:text-cyan-400"
        >
          <Usb className="w-5 h-5 text-cyan-400" />
          <span className="text-[10px] font-medium tracking-tight mt-1">Conectar</span>
        </button>
      </div>

      {/* Settings & Customization Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        gridSize={gridSize}
        onChangeGridSize={(s) => setGridSize(s)}
        currentThemeId={themeId}
        onChangeTheme={(t) => setThemeId(t)}
        soundEnabled={soundEnabled}
        onToggleSound={(en) => setSoundEnabled(en)}
        hapticsEnabled={hapticsEnabled}
        onToggleHaptics={(en) => setHapticsEnabled(en)}
        hideTrail={hideTrail}
        onToggleHideTrail={(ht) => setHideTrail(ht)}
        showNumbers={showNumbers}
        onToggleShowNumbers={(sn) => setShowNumbers(sn)}
        customStyle={customStyle}
        onChangeCustomStyle={(st) => setCustomStyle(st)}
        onResetToDefaultPattern={handleResetToDefaultPattern}
        theme={activeTheme}
      />

      {/* Phone Connection Modal */}
      <PhoneConnectModal
        isOpen={isPhoneConnectOpen}
        onClose={() => setIsPhoneConnectOpen(false)}
        soundEnabled={soundEnabled}
        pairedDevice={pairedDevice}
        onPairDevice={(dev) => setPairedDevice(dev)}
        onDisconnectDevice={() => setPairedDevice(null)}
        sessionId={sessionId}
        onUnlockByRemote={handleUnlockSuccess}
        onLockByRemote={handleLockDevice}
        onOpenMirror={() => setAppMode('mirror')}
        onOpenDeviceData={() => setAppMode('device-data')}
      />

      {/* Unlock Agent AI Assistant Modal */}
      <UnlockAgentModal
        isOpen={isAgentOpen}
        onClose={() => setIsAgentOpen(false)}
        masterPattern={masterPattern}
        isLocked={!isUnlocked}
        failedAttempts={unlockAttempts.filter((a) => !a.success).length}
        pairedDevice={pairedDevice}
        onExecuteUnlock={handleAgentUnlock}
        soundEnabled={soundEnabled}
      />
    </div>
  );
}
