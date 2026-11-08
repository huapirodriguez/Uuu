import React, { useState, useEffect, useRef } from 'react';
import {
  Cable,
  Usb,
  Bot,
  Play,
  RotateCw,
  Camera,
  Maximize2,
  Minimize2,
  CheckCircle2,
  AlertCircle,
  Wifi,
  Sparkles,
  Smartphone,
  ChevronDown,
  Layers,
  Cpu,
  Lock,
  Unlock,
  Volume2,
  VolumeX,
  Terminal,
  RefreshCw,
  Zap,
  Key,
  ShieldCheck,
  Send,
  Radio,
  Share2,
  Check,
  Power,
  RotateCcw,
  Database,
} from 'lucide-react';
import { CustomGridStyle, ThemeConfig } from '../types.ts';
import { ALL_USB_PHONE_PRESETS, MOTOROLA_PHONE_MODELS, UsbPhoneModel } from '../utils/usbManager.ts';
import { playClickSound, playSuccessSound, playErrorSound, playLockSound } from '../utils/sound.ts';
import { resetDeviceOAuth } from '../lib/firebase.ts';
import { subscribeToSyncMessages } from '../utils/syncChannel.ts';

interface PhoneScreenMirrorProps {
  masterPattern: number[];
  theme: ThemeConfig;
  customStyle: CustomGridStyle;
  soundEnabled: boolean;
  onUnlockSuccess: () => void;
  onRecordAttempt: (data: {
    success: boolean;
    length: number;
    patternMasked: string;
    deviceInfo: string;
  }) => void;
  pairedDeviceName?: string | null;
  onOpenDeviceData?: () => void;
  onClose?: () => void;
}

interface TerminalLog {
  id: string;
  text: string;
  type: 'cmd' | 'output' | 'success' | 'warn' | 'error';
  timestamp: string;
}

export function PhoneScreenMirror({
  masterPattern,
  customStyle,
  soundEnabled,
  onUnlockSuccess,
  onRecordAttempt,
  pairedDeviceName,
  onOpenDeviceData,
  onClose,
}: PhoneScreenMirrorProps) {
  // Select active phone model
  const [selectedModel, setSelectedModel] = useState<UsbPhoneModel>(() => {
    if (pairedDeviceName) {
      const found = ALL_USB_PHONE_PRESETS.find((m) =>
        pairedDeviceName.toLowerCase().includes(m.model.toLowerCase())
      );
      if (found) return found;
    }
    return MOTOROLA_PHONE_MODELS[0]; // Motorola Edge 50 Ultra by default
  });

  // Connection & Transport Mode: USB Cable, Wireless IP, or Fastboot
  const [connectionMode, setConnectionMode] = useState<'usb' | 'wireless' | 'fastboot'>('usb');
  const [deviceBootMode, setDeviceBootMode] = useState<'android' | 'fastboot' | 'recovery'>('android');
  
  // Wireless / IP ADB Configuration
  const [wirelessIp, setWirelessIp] = useState('192.168.1.145');
  const [wirelessPort, setWirelessPort] = useState('5555');
  const [wirelessPairingCode, setWirelessPairingCode] = useState('389421');
  const [isWirelessConnected, setIsWirelessConnected] = useState(false);
  const [isWirelessConnecting, setIsWirelessConnecting] = useState(false);

  // Streaming Telemetry
  const [isUsbStreaming, setIsUsbStreaming] = useState(true);
  const [fps, setFps] = useState(60);
  const [bitrateMbps, setBitrateMbps] = useState(480);
  const [isPhoneUnlocked, setIsPhoneUnlocked] = useState(false);
  const [isAiUnlocking, setIsAiUnlocking] = useState(false);
  const [aiStatusMessage, setAiStatusMessage] = useState<string | null>(null);
  const [aiTouchPosition, setAiTouchPosition] = useState<{ x: number; y: number } | null>(null);
  const [currentStrokePattern, setCurrentStrokePattern] = useState<number[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRotated, setIsRotated] = useState(false);
  const [screenshotFlash, setScreenshotFlash] = useState(false);
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [soundMuted, setSoundMuted] = useState(!soundEnabled);

  // Right Side Console Tabs: AI vs Terminal ADB/Fastboot vs Wireless IP
  const [activeSideTab, setActiveSideTab] = useState<'ai' | 'terminal' | 'wireless'>('ai');

  // Interactive Terminal
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalLogs, setTerminalLogs] = useState<TerminalLog[]>([
    {
      id: 'init-1',
      text: '* daemon not running; starting now at tcp:5037',
      type: 'output',
      timestamp: '16:45:01',
    },
    {
      id: 'init-2',
      text: '* daemon started successfully',
      type: 'success',
      timestamp: '16:45:02',
    },
    {
      id: 'init-3',
      text: 'Dispositivo Motorola conectado en modo ADB Depuración USB (480 Mbps).',
      type: 'output',
      timestamp: '16:45:02',
    },
  ]);

  // Toast Banner for OAuth & System Actions
  const [toastBanner, setToastBanner] = useState<string | null>(null);

  // Time & Battery Simulator
  const [currentTime, setCurrentTime] = useState('');
  const [currentSeconds, setCurrentSeconds] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [batteryLevel] = useState(88);

  const screenContainerRef = useRef<HTMLDivElement>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Real Hardware Device Live Connection over SSE
  const [realHardwareConnected, setRealHardwareConnected] = useState<string | null>(pairedDeviceName || null);
  const [realTouchPos, setRealTouchPos] = useState<{ x: number; y: number } | null>(null);

  // Subscribe to real hardware phone touches and events
  useEffect(() => {
    const unsub = subscribeToSyncMessages((msg) => {
      if (msg.type === 'DEVICE_CONNECTED') {
        const name = msg.deviceInfo || 'Teléfono Móvil Físico';
        setRealHardwareConnected(name);
        addTerminalLog(`[HARDWARE REAL] Dispositivo móvil físico enlazado: ${name}`, 'success');
        showToast(`🟢 ${name} conectado en tiempo real`);
      } else if (msg.type === 'REAL_TOUCH_MOVE') {
        if (msg.touchData) {
          setRealTouchPos({
            x: msg.touchData.xRatio * 100,
            y: msg.touchData.yRatio * 100,
          });
          if (msg.touchData.activeTrail && msg.touchData.activeTrail.length > 0) {
            setCurrentStrokePattern(msg.touchData.activeTrail);
          }
        }
      } else if (msg.type === 'UNLOCK_SUCCESS') {
        setIsPhoneUnlocked(true);
        setCurrentStrokePattern([]);
        setRealTouchPos(null);
        addTerminalLog('[HARDWARE] Desbloqueo remoto confirmado desde tu celular físico.', 'success');
        showToast('🔓 ¡Desbloqueado exitosamente desde tu teléfono real!');
        onUnlockSuccess();
      } else if (msg.type === 'LOCK_DEVICE') {
        setIsPhoneUnlocked(false);
        setCurrentStrokePattern([]);
        setRealTouchPos(null);
        addTerminalLog('[HARDWARE] Dispositivo bloqueado desde el celular físico.', 'warn');
        showToast('🔒 Teléfono bloqueado desde el celular');
      }
    });

    return () => unsub();
  }, [onUnlockSuccess]);

  // Clock tick
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false })
      );
      setCurrentSeconds(now.getSeconds().toString().padStart(2, '0'));
      setCurrentDate(
        now.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Telemetry jitter simulation
  useEffect(() => {
    if (!isUsbStreaming) return;
    const interval = setInterval(() => {
      setFps(59 + Math.floor(Math.random() * 3));
      if (connectionMode === 'wireless') {
        setBitrateMbps(840 + Math.floor(Math.random() * 30));
      } else {
        setBitrateMbps(475 + Math.floor(Math.random() * 12));
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [isUsbStreaming, connectionMode]);

  // Scroll terminal to bottom
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalLogs]);

  const showToast = (msg: string) => {
    setToastBanner(msg);
    setTimeout(() => {
      setToastBanner((curr) => (curr === msg ? null : curr));
    }, 3800);
  };

  const addTerminalLog = (text: string, type: TerminalLog['type'] = 'output') => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setTerminalLogs((prev) => [
      ...prev,
      {
        id: `term-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        text,
        type,
        timestamp: timeStr,
      },
    ]);
  };

  // Node coordinates calculation
  const getNodeCoordinates = (index: number) => {
    const row = Math.floor(index / 3);
    const col = index % 3;
    const startX = 22;
    const stepX = 28;
    const startY = 48;
    const stepY = 14;
    return {
      x: startX + col * stepX,
      y: startY + row * stepY,
    };
  };

  // 1. AI Automatic Unlock Flow
  const handleTriggerAiUnlock = async () => {
    if (isAiUnlocking || isPhoneUnlocked || deviceBootMode !== 'android') return;
    setIsAiUnlocking(true);
    setCurrentStrokePattern([]);
    setAiTouchPosition(null);

    setAiStatusMessage('CipherAgent: Analizando cuadro de video en tiempo real...');
    playClickSound(!soundMuted);
    await new Promise((r) => setTimeout(r, 650));

    setAiStatusMessage(`CipherAgent: Secuencia resuelta [${masterPattern.join(' ➔ ')}]`);
    await new Promise((r) => setTimeout(r, 600));

    setAiStatusMessage('Inyectando eventos táctiles HID a través del enlace de comunicación...');

    const pathSequence = [...masterPattern];
    const animatedPath: number[] = [];

    for (let i = 0; i < pathSequence.length; i++) {
      const nodeIndex = pathSequence[i];
      const coords = getNodeCoordinates(nodeIndex);

      setAiTouchPosition(coords);
      animatedPath.push(nodeIndex);
      setCurrentStrokePattern([...animatedPath]);

      playClickSound(!soundMuted);
      await new Promise((r) => setTimeout(r, 380));
    }

    setAiStatusMessage('Validando firma criptográfica en el sistema Android...');
    await new Promise((r) => setTimeout(r, 450));

    setIsPhoneUnlocked(true);
    setAiTouchPosition(null);
    setCurrentStrokePattern([]);
    setIsAiUnlocking(false);
    setAiStatusMessage('¡Dispositivo Motorola desbloqueado con éxito por la IA!');
    playSuccessSound(!soundMuted);

    onRecordAttempt({
      success: true,
      length: masterPattern.length,
      patternMasked: masterPattern.map(() => '●').join(''),
      deviceInfo: `${connectionMode === 'wireless' ? 'Wi-Fi ADB' : 'USB Mirror'} (${selectedModel.model}) · CipherAgent`,
    });

    onUnlockSuccess();
  };

  // 2. Ingresar al Sistema Directamente (Bypass / Auth de Desarrollador ADB)
  const handleDirectSystemEnter = () => {
    playSuccessSound(!soundMuted);
    addTerminalLog('$ adb shell input keyevent 82', 'cmd');
    addTerminalLog('$ adb shell wm dismiss-keyguard', 'cmd');
    addTerminalLog('[ADB] Evento KEYEVENT_MENU / DISMISS_KEYGUARD inyectado en el servidor de ventanas.', 'success');
    addTerminalLog('[SISTEMA] Pantalla de bloqueo superada. Accediendo al sistema Android...', 'success');

    setIsPhoneUnlocked(true);
    setDeviceBootMode('android');
    showToast('🔓 ¡Acceso concedido al sistema vía ADB Shell!');

    onRecordAttempt({
      success: true,
      length: masterPattern.length,
      patternMasked: '••••••',
      deviceInfo: `ADB Shell (${selectedModel.model}) · Bypass Sistema`,
    });

    onUnlockSuccess();
  };

  // 3. Reset OAuth del Dispositivo
  const handleResetDeviceOAuth = async () => {
    playClickSound(!soundMuted);
    addTerminalLog('$ adb shell pm clear com.google.android.gms.auth', 'cmd');
    addTerminalLog('$ adb shell settings delete global google_oauth_tokens', 'cmd');
    addTerminalLog('[OAUTH] Revocando credenciales y tokens OAuth en el dispositivo...', 'warn');

    try {
      await resetDeviceOAuth();
      addTerminalLog('[OAUTH] Sesión OAuth y tokens de Google restablecidos a estado de fábrica con éxito.', 'success');
      showToast('🔄 Sesión OAuth del dispositivo restablecida con éxito');
      playSuccessSound(!soundMuted);
    } catch (err: any) {
      addTerminalLog(`[ERROR] Fallo al restablecer OAuth: ${err?.message || err}`, 'error');
      showToast('Error al restablecer OAuth');
    }
  };

  // 4. Switch Bootloader / Fastboot Mode
  const handleSwitchBootMode = (mode: 'android' | 'fastboot' | 'recovery') => {
    playClickSound(!soundMuted);
    setDeviceBootMode(mode);

    if (mode === 'fastboot') {
      setConnectionMode('fastboot');
      addTerminalLog('$ adb reboot bootloader', 'cmd');
      addTerminalLog('[FASTBOOT] Reiniciando en modo AP Fastboot Flash Mode...', 'warn');
      addTerminalLog('Dispositivo reiniciado en Fastboot (Protocolo de Flasheo Motorola).', 'success');
      showToast('⚡ Dispositivo reiniciado en Modo Fastboot');
    } else if (mode === 'recovery') {
      addTerminalLog('$ adb reboot recovery', 'cmd');
      addTerminalLog('[RECOVERY] Iniciando consola de recuperación Android Recovery...', 'warn');
      showToast('🛠️ Dispositivo reiniciado en Modo Recovery');
    } else {
      setConnectionMode('usb');
      addTerminalLog('$ fastboot reboot', 'cmd');
      addTerminalLog('[BOOT] Reiniciando sistema operativo Android normal...', 'success');
      showToast('📱 Reiniciando en sistema Android');
    }
  };

  // 5. Connect via Wireless / IP ADB
  const handleConnectWirelessIp = async () => {
    playClickSound(!soundMuted);
    setIsWirelessConnecting(true);
    addTerminalLog(`$ adb tcpip ${wirelessPort}`, 'cmd');
    addTerminalLog(`$ adb connect ${wirelessIp}:${wirelessPort}`, 'cmd');

    await new Promise((r) => setTimeout(r, 900));

    setIsWirelessConnecting(false);
    setIsWirelessConnected(true);
    setConnectionMode('wireless');
    playSuccessSound(!soundMuted);
    addTerminalLog(`connected to ${wirelessIp}:${wirelessPort} over TCP/IP Wi-Fi (866 Mbps)`, 'success');
    showToast(`📶 Conectado por Wi-Fi a ${wirelessIp}:${wirelessPort}`);
  };

  // Lock phone again
  const handleLockPhone = () => {
    setIsPhoneUnlocked(false);
    setCurrentStrokePattern([]);
    setAiTouchPosition(null);
    setAiStatusMessage('Pantalla del dispositivo bloqueada.');
    playLockSound(!soundMuted);
  };

  // Manual pattern input by clicking nodes on mirror screen
  const handleManualNodeClick = (index: number) => {
    if (isPhoneUnlocked || isAiUnlocking || deviceBootMode !== 'android') return;
    playClickSound(!soundMuted);

    if (currentStrokePattern.includes(index)) return;
    const next = [...currentStrokePattern, index];
    setCurrentStrokePattern(next);

    if (next.length === masterPattern.length) {
      const match = next.every((val, i) => val === masterPattern[i]);
      if (match) {
        setIsPhoneUnlocked(true);
        playSuccessSound(!soundMuted);
        setAiStatusMessage('¡Patrón correcto! Teléfono desbloqueado.');
        onRecordAttempt({
          success: true,
          length: next.length,
          patternMasked: next.map(() => '●').join(''),
          deviceInfo: `${connectionMode === 'wireless' ? 'Wi-Fi ADB' : 'USB Mirror'} (${selectedModel.model}) · Manual`,
        });
        onUnlockSuccess();
      } else {
        playErrorSound(!soundMuted);
        setAiStatusMessage('Patrón incorrecto. Inténtalo de nuevo.');
        onRecordAttempt({
          success: false,
          length: next.length,
          patternMasked: next.map(() => '●').join(''),
          deviceInfo: `${connectionMode === 'wireless' ? 'Wi-Fi ADB' : 'USB Mirror'} (${selectedModel.model}) · Fallido`,
        });
      }
      setTimeout(() => setCurrentStrokePattern([]), 900);
    }
  };

  // Command execution in terminal
  const handleRunCommand = (e?: React.FormEvent, rawCmd?: string) => {
    if (e) e.preventDefault();
    const cmd = (rawCmd || terminalInput).trim();
    if (!cmd) return;

    addTerminalLog(`$ ${cmd}`, 'cmd');
    setTerminalInput('');

    const lower = cmd.toLowerCase();

    if (lower === 'clear' || lower === 'cls') {
      setTerminalLogs([]);
      return;
    }

    if (lower === 'help') {
      addTerminalLog('Comandos disponibles:\n' +
        '  adb devices                   - Lista dispositivos ADB conectados\n' +
        '  adb shell                     - Abre sesión de shell interactiva\n' +
        '  adb shell input keyevent 82   - Desbloquea e ingresa al sistema\n' +
        '  adb reboot bootloader         - Reinicia en modo Fastboot\n' +
        '  adb tcpip 5555                - Habilita ADB sobre Wi-Fi TCP/IP\n' +
        '  adb connect <ip>:<port>       - Conecta a teléfono por IP\n' +
        '  fastboot devices              - Lista dispositivos en modo Fastboot\n' +
        '  fastboot reboot               - Reinicia a Android normal\n' +
        '  reset-oauth                   - Restablece tokens y credenciales OAuth\n' +
        '  clear                         - Limpia la terminal', 'output');
      return;
    }

    if (lower.includes('reset-oauth') || lower.includes('google_oauth')) {
      handleResetDeviceOAuth();
      return;
    }

    if (lower.includes('keyevent 82') || lower.includes('dismiss-keyguard') || lower === 'unlock') {
      handleDirectSystemEnter();
      return;
    }

    if (lower.includes('reboot bootloader') || lower === 'fastboot') {
      handleSwitchBootMode('fastboot');
      return;
    }

    if (lower.includes('fastboot reboot') || lower === 'reboot') {
      handleSwitchBootMode('android');
      return;
    }

    if (lower.includes('devices')) {
      const pIdHex = `0x${selectedModel.productId.toString(16).padStart(4, '0').toUpperCase()}`;
      const vIdHex = `0x${selectedModel.vendorId.toString(16).padStart(4, '0').toUpperCase()}`;
      if (deviceBootMode === 'fastboot') {
        addTerminalLog(`MOTO-FASTBOOT-${pIdHex}    fastboot`, 'output');
      } else if (connectionMode === 'wireless') {
        addTerminalLog(`${wirelessIp}:${wirelessPort}    device (product:${selectedModel.id} model:${selectedModel.model})`, 'output');
      } else {
        addTerminalLog(`MOTO-USB-${vIdHex}    device (product:${selectedModel.id} model:${selectedModel.model})`, 'output');
      }
      return;
    }

    if (lower.includes('connect')) {
      handleConnectWirelessIp();
      return;
    }

    // Default simulated response
    addTerminalLog(`[OK] Comando ejecutado con código de salida 0 en ${selectedModel.model}.`, 'success');
  };

  // Screenshot flash effect
  const handleTakeScreenshot = () => {
    playClickSound(!soundMuted);
    setScreenshotFlash(true);
    setTimeout(() => setScreenshotFlash(false), 300);
  };

  return (
    <div
      className={`bg-slate-950 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl flex flex-col gap-5 ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none overflow-y-auto' : 'w-full max-w-6xl mx-auto'
      }`}
    >
      {/* Toast Notification Banner */}
      {toastBanner && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border border-cyan-500/50 shadow-2xl shadow-cyan-950/50 rounded-2xl px-4 py-2.5 flex items-center gap-2 text-xs font-semibold text-white animate-bounce">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span>{toastBanner}</span>
        </div>
      )}

      {/* Top Stream Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        {/* Device selector & live badge */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setModelSelectorOpen(!modelSelectorOpen)}
              className="flex items-center gap-2.5 px-3 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-700/80 rounded-2xl text-xs font-semibold text-white transition-all shadow-sm"
            >
              <Smartphone className="w-4 h-4 text-cyan-400" />
              <div className="text-left">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-white">{selectedModel.model}</span>
                  <span className="text-[10px] text-cyan-400 font-mono">
                    {connectionMode === 'wireless' ? 'Wi-Fi 6' : connectionMode === 'fastboot' ? 'FASTBOOT' : 'USB 3.2'}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-normal">
                  {connectionMode === 'wireless' ? `${wirelessIp}:${wirelessPort}` : selectedModel.mode}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
            </button>

            {/* Model Dropdown */}
            {modelSelectorOpen && (
              <div className="absolute left-0 top-full mt-2 w-72 max-h-80 overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl p-2 shadow-2xl z-50 space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-400 px-2 py-1">
                  Dispositivos Motorola Disponibles
                </div>
                {MOTOROLA_PHONE_MODELS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setSelectedModel(m);
                      setModelSelectorOpen(false);
                      playClickSound(!soundMuted);
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                      selectedModel.id === m.id
                        ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div>
                      <div className="font-semibold">{m.model}</div>
                      <div className="text-[10px] text-slate-400">{m.series}</div>
                    </div>
                    {m.popular && (
                      <span className="text-[9px] bg-cyan-950 text-cyan-400 border border-cyan-800 px-1.5 py-0.5 rounded-md font-mono">
                        TOP
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Connection Mode Pill */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-2xl p-1 text-xs">
            <button
              onClick={() => {
                setConnectionMode('usb');
                setDeviceBootMode('android');
                playClickSound(!soundMuted);
              }}
              className={`px-2.5 py-1 rounded-xl font-semibold flex items-center gap-1 transition-colors ${
                connectionMode === 'usb'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Cable className="w-3.5 h-3.5" />
              <span>USB</span>
            </button>

            <button
              onClick={() => {
                setConnectionMode('wireless');
                setDeviceBootMode('android');
                playClickSound(!soundMuted);
              }}
              className={`px-2.5 py-1 rounded-xl font-semibold flex items-center gap-1 transition-colors ${
                connectionMode === 'wireless'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Wifi className="w-3.5 h-3.5" />
              <span>Wi-Fi / IP</span>
            </button>

            <button
              onClick={() => {
                handleSwitchBootMode('fastboot');
              }}
              className={`px-2.5 py-1 rounded-xl font-semibold flex items-center gap-1 transition-colors ${
                deviceBootMode === 'fastboot'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Fastboot</span>
            </button>
          </div>

          {/* Status Badge */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-400 text-xs font-mono font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{connectionMode === 'wireless' ? 'ADB WI-FI ACTIVO' : deviceBootMode === 'fastboot' ? 'FASTBOOT PROTOCOL' : 'ADB USB EN VIVO'}</span>
            <span className="text-slate-400 font-normal">({fps} FPS · {bitrateMbps} Mbps)</span>
          </div>
        </div>

        {/* Action Controls Toolbar */}
        <div className="flex items-center gap-2">
          {/* Leer Todos los Datos */}
          {onOpenDeviceData && (
            <button
              onClick={() => {
                playClickSound(!soundMuted);
                onOpenDeviceData();
              }}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95"
              title="Leer todos los datos del dispositivo (getprop, particiones, apps, locksettings, logs)"
            >
              <Database className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Leer Todos los Datos</span>
              <span className="sm:hidden">Datos</span>
            </button>
          )}

          {/* Quick System Enter (Bypass ADB) */}
          <button
            onClick={handleDirectSystemEnter}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95"
            title="Ingresar directamente al sistema mediante inyección ADB"
          >
            <Unlock className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ingresar al Sistema</span>
            <span className="sm:hidden">Ingresar</span>
          </button>

          {/* Reset OAuth */}
          <button
            onClick={handleResetDeviceOAuth}
            className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-rose-950/60 border border-slate-800 hover:border-rose-500/50 text-slate-300 hover:text-rose-300 font-semibold text-xs flex items-center gap-1 transition-all active:scale-95"
            title="Restablecer tokens de autenticación OAuth del dispositivo"
          >
            <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">Reset OAuth</span>
          </button>

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundMuted(!soundMuted)}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors"
            title={soundMuted ? 'Activar Sonido' : 'Silenciar'}
          >
            {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
          </button>

          {/* Screenshot */}
          <button
            onClick={handleTakeScreenshot}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors"
            title="Capturar Cuadro USB"
          >
            <Camera className="w-4 h-4" />
          </button>

          {/* Rotate */}
          <button
            onClick={() => setIsRotated(!isRotated)}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors"
            title="Rotar Orientación"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* Fullscreen */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors"
            title={isFullscreen ? 'Salir de Pantalla Completa' : 'Pantalla Completa'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition-colors"
            >
              Cerrar
            </button>
          )}
        </div>
      </div>

      {/* Main Split Layout: Left Phone Mirror Canvas, Right Console & Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: The Mirrored Phone Screen (cols 6 or 7) */}
        <div className="lg:col-span-6 xl:col-span-7 flex flex-col items-center justify-center relative">
          {screenshotFlash && (
            <div className="absolute inset-0 bg-white z-50 rounded-[44px] pointer-events-none animate-ping opacity-75" />
          )}

          {/* Physical Phone Chassis & Display Container */}
          <div
            ref={screenContainerRef}
            className={`relative w-full max-w-[340px] aspect-[9/19] rounded-[44px] p-3.5 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border-[8px] border-slate-800 shadow-2xl select-none transition-transform duration-300 overflow-hidden ${
              isRotated ? 'rotate-90 scale-90' : ''
            }`}
            style={{
              boxShadow: deviceBootMode === 'fastboot'
                ? '0 0 40px rgba(245, 158, 11, 0.3)'
                : isPhoneUnlocked
                ? '0 0 40px rgba(16, 185, 129, 0.25)'
                : '0 0 35px rgba(6, 182, 212, 0.2)',
            }}
          >
            {/* Top Speaker & Front Camera Hole Punch */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center">
              <div className="w-3.5 h-3.5 rounded-full bg-black border border-slate-800 flex items-center justify-center shadow-inner">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-950" />
              </div>
            </div>

            {/* SCREEN VIEWPORT */}
            <div
              className={`w-full h-full rounded-[34px] overflow-hidden relative flex flex-col justify-between transition-all duration-500 ${
                deviceBootMode === 'fastboot'
                  ? 'bg-black text-green-400'
                  : isPhoneUnlocked
                  ? 'bg-gradient-to-b from-indigo-950 via-slate-900 to-cyan-950'
                  : 'bg-gradient-to-b from-slate-950 via-cyan-950/40 to-slate-950'
              }`}
            >
              {/* DISPLAY MODE 1: MOTOROLA AP FASTBOOT FLASH MODE */}
              {deviceBootMode === 'fastboot' ? (
                <div className="w-full h-full bg-black text-green-400 font-mono text-[10px] p-4 pt-8 flex flex-col justify-between select-text leading-tight overflow-hidden">
                  <div>
                    <div className="text-amber-400 font-extrabold text-xs mb-1">
                      AP Fastboot Flash Mode (Secure)
                    </div>
                    <div className="text-slate-400 text-[9px] mb-2 border-b border-slate-800 pb-1">
                      Motorola Mobility LLC · Bootloader MBM-3.4
                    </div>

                    <div className="space-y-1 text-[10px]">
                      <div>
                        <span className="text-slate-400">Product/Variant:</span>{' '}
                        <span className="text-white font-bold">{selectedModel.id}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Device State:</span>{' '}
                        <span className="text-emerald-400 font-bold">unlocked (Tamper: True)</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Baseband:</span>{' '}
                        <span className="text-slate-300">M8450_GEN_12_GLOBAL</span>
                      </div>
                      <div>
                        <span className="text-slate-400">eMMC / UFS:</span>{' '}
                        <span className="text-slate-300">512GB Micron UFS 4.0</span>
                      </div>
                      <div>
                        <span className="text-slate-400">DRAM:</span>{' '}
                        <span className="text-slate-300">16GB LPDDR5X Micron</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Battery Level:</span>{' '}
                        <span className="text-emerald-400">{batteryLevel}% OK (Charging)</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Transfer Mode:</span>{' '}
                        <span className="text-cyan-400">
                          {connectionMode === 'wireless' ? 'Wi-Fi TCP/IP (866 Mbps)' : 'USB 3.2 High-Speed'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Console:</span>{' '}
                        <span className="text-slate-300">ttyHSL0 / Virtual Bridge</span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-800/80 pt-2 space-y-1.5">
                    <div className="text-cyan-300 animate-pulse text-[9px]">
                      &gt; FASTBOOT: Esperando comandos flash/oem desde terminal...
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <button
                        onClick={() => handleSwitchBootMode('android')}
                        className="py-1.5 bg-slate-900 border border-slate-700 text-white rounded-lg text-[10px] font-bold hover:bg-slate-800 transition-colors"
                      >
                        fastboot reboot
                      </button>
                      <button
                        onClick={handleDirectSystemEnter}
                        className="py-1.5 bg-emerald-950/80 border border-emerald-700 text-emerald-300 rounded-lg text-[10px] font-bold hover:bg-emerald-900 transition-colors"
                      >
                        Boot Sistema
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* ANDROID NORMAL OS (LOCKED OR UNLOCKED) */
                <>
                  {/* Android Live Status Bar */}
                  <div className="px-5 pt-3 flex items-center justify-between text-[11px] font-semibold text-slate-200 z-20">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono">{currentTime}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {connectionMode === 'wireless' ? (
                        <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Usb className="w-3.5 h-3.5 text-cyan-400" />
                      )}
                      <div className="flex items-center gap-0.5 text-[10px]">
                        <span className="font-mono">{batteryLevel}%</span>
                        <div className="w-4 h-2 rounded-sm border border-slate-300 p-0.5 flex items-center">
                          <div className="w-full h-full bg-emerald-400 rounded-2xs" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SCREEN CONTENT: LOCKED OR UNLOCKED */}
                  {!isPhoneUnlocked ? (
                    /* LOCKED STATE */
                    <div className="flex-1 flex flex-col justify-between p-4 z-10">
                      {/* Top Lock Header & Clock */}
                      <div className="text-center mt-3">
                        <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-900/80 border border-cyan-500/30 text-cyan-400 mb-1">
                          <Lock className="w-4 h-4 animate-pulse" />
                        </div>
                        <div className="text-4xl font-extrabold tracking-tight text-white font-mono">
                          {currentTime}
                          <span className="text-sm font-mono text-cyan-400 ml-1">:{currentSeconds}</span>
                        </div>
                        <div className="text-xs text-slate-400 font-medium capitalize mt-0.5">
                          {currentDate}
                        </div>
                        <div className="text-[10px] text-cyan-400/90 font-mono mt-1 flex items-center justify-center gap-1">
                          {realHardwareConnected ? (
                            <>
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                              <span className="text-emerald-400 font-bold">{realHardwareConnected} · En Vivo</span>
                            </>
                          ) : connectionMode === 'wireless' ? (
                            <>
                              <Wifi className="w-3 h-3 text-emerald-400" />
                              <span>{wirelessIp}:{wirelessPort}</span>
                            </>
                          ) : (
                            <>
                              <Usb className="w-3 h-3 text-cyan-400" />
                              <span>{selectedModel.model} · USB</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* 3x3 Pattern Grid inside the mirrored phone */}
                      <div className="relative my-auto w-full max-w-[240px] mx-auto aspect-square flex items-center justify-center">
                        {/* SVG Connection Lines */}
                        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                          {currentStrokePattern.map((nodeIndex, i) => {
                            if (i === 0) return null;
                            const prev = getNodeCoordinates(currentStrokePattern[i - 1]);
                            const curr = getNodeCoordinates(nodeIndex);
                            return (
                              <line
                                key={`mirror-line-${i}`}
                                x1={`${prev.x}%`}
                                y1={`${prev.y}%`}
                                x2={`${curr.x}%`}
                                y2={`${curr.y}%`}
                                stroke={customStyle.connectionColor}
                                strokeWidth="4"
                                strokeLinecap="round"
                                className="animate-pulse drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]"
                              />
                            );
                          })}
                        </svg>

                        {/* Real-Time Hardware Phone Touch Cursor */}
                        {realTouchPos && !isPhoneUnlocked && (
                          <div
                            className="absolute z-30 -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-all duration-75 ease-out"
                            style={{
                              left: `${realTouchPos.x}%`,
                              top: `${realTouchPos.y}%`,
                            }}
                          >
                            <div className="relative flex items-center justify-center">
                              <div className="w-12 h-12 rounded-full animate-ping opacity-75 bg-emerald-400" />
                              <div className="absolute w-6 h-6 rounded-full border-2 border-white bg-emerald-500 shadow-xl flex items-center justify-center">
                                <div className="w-2 h-2 rounded-full bg-white" />
                              </div>
                              <span className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap bg-emerald-950 border border-emerald-500 text-emerald-300 text-[9px] font-mono font-bold px-2 py-0.5 rounded-full shadow-lg flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                Toque Móvil Físico
                              </span>
                            </div>
                          </div>
                        )}

                        {/* AI Touch Cursor */}
                        {aiTouchPosition && (
                          <div
                            className="absolute z-30 -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-all duration-300 ease-out"
                            style={{
                              left: `${aiTouchPosition.x}%`,
                              top: `${aiTouchPosition.y}%`,
                            }}
                          >
                            <div className="relative flex items-center justify-center">
                              <div
                                className="w-10 h-10 rounded-full animate-ping opacity-60"
                                style={{ backgroundColor: customStyle.connectionColor }}
                              />
                              <div
                                className="absolute w-5 h-5 rounded-full border-2 border-white shadow-lg flex items-center justify-center"
                                style={{ backgroundColor: customStyle.connectionColor }}
                              >
                                <div className="w-1.5 h-1.5 rounded-full bg-white" />
                              </div>
                              <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-cyan-950 border border-cyan-500/70 text-cyan-300 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md shadow-md">
                                AI Touch
                              </span>
                            </div>
                          </div>
                        )}

                        {/* 3x3 Nodes */}
                        <div className="w-full h-full grid grid-cols-3 gap-6 p-2 z-20">
                          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((index) => {
                            const isConnected = currentStrokePattern.includes(index);
                            return (
                              <button
                                key={index}
                                onClick={() => handleManualNodeClick(index)}
                                disabled={isAiUnlocking}
                                className={`relative w-full aspect-square rounded-full flex items-center justify-center transition-all ${
                                  isConnected
                                    ? 'scale-115'
                                    : 'hover:scale-105 active:scale-95'
                                }`}
                              >
                                <div
                                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                                    isConnected
                                      ? 'border-2 shadow-lg shadow-cyan-500/50'
                                      : 'border border-slate-700 bg-slate-900/60'
                                  }`}
                                  style={{
                                    borderColor: isConnected
                                      ? customStyle.connectionColor
                                      : undefined,
                                    backgroundColor: isConnected
                                      ? `${customStyle.connectionColor}25`
                                      : undefined,
                                  }}
                                >
                                  <div
                                    className={`w-3.5 h-3.5 rounded-full transition-all ${
                                      isConnected ? 'scale-125' : 'bg-slate-400'
                                    }`}
                                    style={{
                                      backgroundColor: isConnected
                                        ? customStyle.connectionColor
                                        : undefined,
                                    }}
                                  />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Bottom tip & Quick ADB Unlock Pill */}
                      <div className="text-center pb-2 space-y-1">
                        <button
                          onClick={handleDirectSystemEnter}
                          className="text-[10px] text-emerald-400 hover:text-emerald-300 underline font-mono flex items-center justify-center gap-1 mx-auto"
                        >
                          <Unlock className="w-3 h-3" />
                          <span>Ingresar al Sistema (Bypass ADB)</span>
                        </button>
                        <p className="text-[10px] text-slate-400 font-medium">
                          {isAiUnlocking
                            ? '⚡ Inyectando vector de desbloqueo...'
                            : 'Dibuja el patrón, usa Desbloqueo IA o consola ADB'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    /* UNLOCKED STATE - MOTOROLA HELLO UI HOMESCREEN */
                    <div className="flex-1 flex flex-col justify-between p-4 z-10 animate-fade-in">
                      {/* Unlocked banner */}
                      <div className="bg-emerald-950/80 border border-emerald-500/40 rounded-2xl p-2.5 text-center mt-2 shadow-lg">
                        <div className="flex items-center justify-center gap-1.5 text-emerald-400 text-xs font-bold">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>¡Sistema Android Desbloqueado!</span>
                        </div>
                        <div className="text-[10px] text-emerald-300/80 mt-0.5">
                          {connectionMode === 'wireless' ? `Túnel Wi-Fi activo (${wirelessIp})` : 'Túnel ADB USB activo'}
                        </div>
                      </div>

                      {/* Launcher App Grid (Motorola Style) */}
                      <div className="grid grid-cols-4 gap-3 my-auto py-2">
                        {[
                          { name: 'Cámara', icon: '📷', bg: 'bg-red-500/20 border-red-500/40 text-red-400' },
                          { name: 'Fotos', icon: '🖼️', bg: 'bg-amber-500/20 border-amber-500/40 text-amber-400' },
                          { name: 'Chrome', icon: '🌐', bg: 'bg-blue-500/20 border-blue-500/40 text-blue-400' },
                          { name: 'Ajustes', icon: '⚙️', bg: 'bg-slate-500/20 border-slate-500/40 text-slate-300' },
                          { name: 'Moto Hub', icon: 'Ⓜ️', bg: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' },
                          { name: 'ThinkShield', icon: '🛡️', bg: 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400' },
                          { name: 'OAuth Vault', icon: '🔐', bg: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' },
                          { name: 'Terminal', icon: '💻', bg: 'bg-purple-500/20 border-purple-500/40 text-purple-400' },
                        ].map((app, idx) => (
                          <div
                            key={idx}
                            onClick={() => {
                              playClickSound(!soundMuted);
                              if (app.name === 'Terminal') setActiveSideTab('terminal');
                              if (app.name === 'OAuth Vault') handleResetDeviceOAuth();
                            }}
                            className="flex flex-col items-center gap-1 group cursor-pointer"
                          >
                            <div
                              className={`w-12 h-12 rounded-2xl border flex items-center justify-center text-xl shadow-md transition-transform group-hover:scale-110 active:scale-95 ${app.bg}`}
                            >
                              {app.icon}
                            </div>
                            <span className="text-[10px] font-medium text-slate-200 truncate w-full text-center">
                              {app.name}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Re-lock Button */}
                      <div className="pt-2">
                        <button
                          onClick={handleLockPhone}
                          className="w-full py-2 bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 rounded-2xl text-xs font-bold text-white flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
                        >
                          <Lock className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Volver a Bloquear Pantalla</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Android Home Navigation Pill */}
                  <div className="pb-2 pt-1 flex items-center justify-center z-20">
                    <div className="w-24 h-1 bg-slate-500/70 rounded-full" />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Tabbed Developer & AI Console (cols 6 or 5) */}
        <div className="lg:col-span-6 xl:col-span-5 flex flex-col gap-4">
          {/* Console Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-2xl text-xs">
            <button
              onClick={() => {
                setActiveSideTab('ai');
                playClickSound(!soundMuted);
              }}
              className={`flex-1 py-1.5 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all ${
                activeSideTab === 'ai'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Desbloqueo IA</span>
            </button>

            <button
              onClick={() => {
                setActiveSideTab('terminal');
                playClickSound(!soundMuted);
              }}
              className={`flex-1 py-1.5 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all ${
                activeSideTab === 'terminal'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>ADB / Fastboot</span>
            </button>

            <button
              onClick={() => {
                setActiveSideTab('wireless');
                playClickSound(!soundMuted);
              }}
              className={`flex-1 py-1.5 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all ${
                activeSideTab === 'wireless'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Wifi className="w-3.5 h-3.5" />
              <span>Wi-Fi / IP</span>
            </button>
          </div>

          {/* TAB 1: AI AUTOMATION VIEW */}
          {activeSideTab === 'ai' && (
            <div className="bg-gradient-to-br from-cyan-950/70 via-slate-900 to-slate-950 border border-cyan-500/30 rounded-3xl p-5 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-md">
                  <Bot className="w-5 h-5 animate-bounce" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <span>Desbloqueo por Inteligencia Artificial</span>
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    CipherAgent calcula la trayectoria del patrón y emula toques táctiles.
                  </p>
                </div>
              </div>

              {/* AI Action Status */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 mb-4 font-mono text-xs text-slate-300 min-h-[58px] flex items-center gap-2.5">
                {isAiUnlocking ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin shrink-0" />
                    <span className="text-cyan-300 text-[11px]">{aiStatusMessage}</span>
                  </>
                ) : isPhoneUnlocked ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-emerald-300 text-[11px]">
                      Dispositivo desbloqueado correctamente.
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span className="text-[11px] text-slate-300">
                      {aiStatusMessage || 'Listo para ejecutar el desbloqueo automático en el teléfono.'}
                    </span>
                  </>
                )}
              </div>

              {/* Primary AI Unlock CTA */}
              {!isPhoneUnlocked ? (
                <div className="space-y-2">
                  <button
                    onClick={handleTriggerAiUnlock}
                    disabled={isAiUnlocking || deviceBootMode !== 'android'}
                    className={`w-full py-3 px-4 rounded-2xl text-xs font-bold text-slate-950 flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 ${
                      isAiUnlocking || deviceBootMode !== 'android'
                        ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 shadow-cyan-500/25'
                    }`}
                  >
                    <Play className="w-4 h-4 fill-slate-950" />
                    <span>{isAiUnlocking ? 'Desbloqueando Pantalla...' : 'Desbloquear Pantalla con IA'}</span>
                  </button>

                  <button
                    onClick={handleDirectSystemEnter}
                    className="w-full py-2.5 px-4 rounded-2xl text-xs font-bold text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-600/50 flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    <Unlock className="w-4 h-4" />
                    <span>Ingresar Directo al Sistema (Bypass ADB)</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleLockPhone}
                  className="w-full py-3 px-4 rounded-2xl text-xs font-bold text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <Lock className="w-4 h-4 text-cyan-400" />
                  <span>Bloquear y Probar de Nuevo</span>
                </button>
              )}
            </div>
          )}

          {/* TAB 2: INTERACTIVE ADB & FASTBOOT TERMINAL */}
          {activeSideTab === 'terminal' && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 shadow-xl flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  <span>Consola ADB & Fastboot</span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                    {deviceBootMode === 'fastboot' ? 'fastboot-mode' : 'adb-shell'}
                  </span>
                </div>

                <button
                  onClick={() => setTerminalLogs([])}
                  className="text-[10px] text-slate-400 hover:text-white"
                >
                  Limpiar
                </button>
              </div>

              {/* Quick ADB / Fastboot Trigger Actions */}
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                <button
                  onClick={handleDirectSystemEnter}
                  className="px-2.5 py-1 rounded-xl bg-emerald-950/70 border border-emerald-500/50 hover:bg-emerald-900 text-emerald-300 font-bold flex items-center gap-1 transition-colors"
                >
                  <Unlock className="w-3 h-3" />
                  <span>Ingresar al Sistema</span>
                </button>

                <button
                  onClick={handleResetDeviceOAuth}
                  className="px-2.5 py-1 rounded-xl bg-rose-950/70 border border-rose-500/50 hover:bg-rose-900 text-rose-300 font-bold flex items-center gap-1 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset OAuth</span>
                </button>

                <button
                  onClick={() => handleSwitchBootMode(deviceBootMode === 'fastboot' ? 'android' : 'fastboot')}
                  className="px-2.5 py-1 rounded-xl bg-amber-950/70 border border-amber-500/50 hover:bg-amber-900 text-amber-300 font-bold flex items-center gap-1 transition-colors"
                >
                  <Zap className="w-3 h-3" />
                  <span>{deviceBootMode === 'fastboot' ? 'fastboot reboot' : 'adb reboot bootloader'}</span>
                </button>

                <button
                  onClick={() => handleRunCommand(undefined, 'adb devices')}
                  className="px-2 py-1 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-white font-mono text-[10px]"
                >
                  adb devices
                </button>

                <button
                  onClick={() => handleRunCommand(undefined, 'fastboot getvar all')}
                  className="px-2 py-1 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-white font-mono text-[10px]"
                >
                  fastboot getvar
                </button>
              </div>

              {/* Terminal Logs Window */}
              <div className="bg-black/95 rounded-2xl p-3 border border-slate-800 font-mono text-[11px] h-52 overflow-y-auto space-y-1 select-text">
                {terminalLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`leading-relaxed whitespace-pre-wrap ${
                      log.type === 'cmd'
                        ? 'text-cyan-300 font-bold'
                        : log.type === 'success'
                        ? 'text-emerald-400'
                        : log.type === 'warn'
                        ? 'text-amber-400'
                        : log.type === 'error'
                        ? 'text-rose-400'
                        : 'text-slate-300'
                    }`}
                  >
                    <span className="text-slate-600 mr-2 text-[9px]">{log.timestamp}</span>
                    {log.text}
                  </div>
                ))}
                <div ref={terminalEndRef} />
              </div>

              {/* Terminal Command Input */}
              <form onSubmit={handleRunCommand} className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-slate-500">
                    $
                  </span>
                  <input
                    type="text"
                    value={terminalInput}
                    onChange={(e) => setTerminalInput(e.target.value)}
                    placeholder="Escribe comando ADB o Fastboot (ej: adb shell, reset-oauth)..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-7 pr-3 py-2 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <button
                  type="submit"
                  className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Ejecutar</span>
                </button>
              </form>
            </div>
          )}

          {/* TAB 3: WIRELESS IP CONFIGURATION */}
          {activeSideTab === 'wireless' && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                  <Wifi className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Conexión Inalámbrica (ADB over Wi-Fi / IP)</h3>
                  <p className="text-[11px] text-slate-400">
                    Controla y transmite la pantalla del teléfono sin cables en la red local.
                  </p>
                </div>
              </div>

              <div className="space-y-3 bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Dirección IP del Teléfono</label>
                  <input
                    type="text"
                    value={wirelessIp}
                    onChange={(e) => setWirelessIp(e.target.value)}
                    placeholder="192.168.1.145"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Puerto ADB</label>
                    <input
                      type="text"
                      value={wirelessPort}
                      onChange={(e) => setWirelessPort(e.target.value)}
                      placeholder="5555"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Código de Emparejamiento</label>
                    <input
                      type="text"
                      value={wirelessPairingCode}
                      onChange={(e) => setWirelessPairingCode(e.target.value)}
                      placeholder="389421"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <button
                  onClick={handleConnectWirelessIp}
                  disabled={isWirelessConnecting}
                  className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
                >
                  <Wifi className="w-4 h-4" />
                  <span>{isWirelessConnecting ? 'Conectando por Wi-Fi...' : 'Conectar por Wi-Fi / IP'}</span>
                </button>
              </div>

              <div className="text-[11px] text-slate-400 space-y-1">
                <div className="font-semibold text-slate-300">Instrucciones Android 11+:</div>
                <p>1. En tu teléfono Motorola, abre <strong>Ajustes ➔ Opciones de Desarrollador</strong>.</p>
                <p>2. Activa <strong>Depuración inalámbrica</strong> y presiona "Vincular dispositivo con código".</p>
                <p>3. Ingresa la IP y puerto generados arriba y pulsa Conectar.</p>
              </div>
            </div>
          )}

          {/* Real-time Diagnostics Telemetry */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-4 shadow-lg space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-white">
              <span className="flex items-center gap-1.5">
                {connectionMode === 'wireless' ? (
                  <Wifi className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Cable className="w-4 h-4 text-cyan-400" />
                )}
                <span>Telemetría de Conexión</span>
              </span>
              <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-800">
                {connectionMode === 'wireless' ? 'WI-FI 6' : connectionMode === 'fastboot' ? 'FASTBOOT' : 'USB 3.2'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Velocidad de Transferencia</span>
                <span className="font-mono font-bold text-cyan-400">{bitrateMbps} Mbps</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Cuadros por Segundo</span>
                <span className="font-mono font-bold text-emerald-400">{fps} FPS Sincronizados</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Latencia de Red / Bus</span>
                <span className="font-mono font-bold text-white">
                  {connectionMode === 'wireless' ? '~3 ms (LAN Wi-Fi)' : '~11 ms (USB HID)'}
                </span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Resolución de Cuadro</span>
                <span className="font-mono font-bold text-white">2400 x 1080 (FHD+ OLED)</span>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/80 flex items-center justify-between">
              <span>Modo: <strong className="text-slate-200">{deviceBootMode.toUpperCase()}</strong></span>
              <span>Motorola: <strong className="text-cyan-400">{selectedModel.series}</strong></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
