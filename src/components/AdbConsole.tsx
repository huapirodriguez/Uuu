import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  Play,
  RotateCcw,
  Copy,
  Check,
  Download,
  Trash2,
  Zap,
  Usb,
  Cable,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Shield,
  Smartphone,
  ExternalLink,
  ChevronRight,
  Maximize2,
  Minimize2,
  Power,
  Layers,
  Sparkles,
} from 'lucide-react';
import { playClickSound, playSuccessSound, playErrorSound, playLockSound } from '../utils/sound.ts';
import { ConnectedUsbDevice, MOTOROLA_PHONE_MODELS } from '../utils/usbManager.ts';

interface AdbConsoleProps {
  soundEnabled: boolean;
  pairedDevice: string | null;
  masterPattern: number[];
  isBootableUsbDebugActive: boolean;
  onToggleBootableUsbDebug: (active: boolean) => void;
  onUnlockSuccess?: () => void;
  onLockDevice?: () => void;
  onOpenMirror?: () => void;
  onOpenDeviceData?: () => void;
}

interface LogEntry {
  id: string;
  type: 'cmd' | 'output' | 'success' | 'warn' | 'error' | 'system';
  text: string;
  timestamp: string;
}

export const AdbConsole: React.FC<AdbConsoleProps> = ({
  soundEnabled,
  pairedDevice,
  masterPattern,
  isBootableUsbDebugActive,
  onToggleBootableUsbDebug,
  onUnlockSuccess,
  onLockDevice,
  onOpenMirror,
  onOpenDeviceData,
}) => {
  const [inputCommand, setInputCommand] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [isCopied, setIsCopied] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isExecuting, setIsExecuting] = useState(false);
  const [inAdbShell, setInAdbShell] = useState(false);
  const [currentMode, setCurrentMode] = useState<'adb' | 'fastboot' | 'shell'>('adb');

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const getTimestamp = () => {
    const now = new Date();
    return now.toTimeString().split(' ')[0];
  };

  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: 'log-1',
      type: 'system',
      text: '========================================================================\n PatternLock Android Debug Bridge (ADB) & Fastboot Engine v1.0.41\n Dispositivo conectado: ' + (pairedDevice || 'Motorola Edge 50 Ultra (USB-C 480 Mbps)') + '\n========================================================================',
      timestamp: getTimestamp(),
    },
    {
      id: 'log-2',
      type: 'output',
      text: '* daemon not running; starting now at tcp:5037\n* daemon started successfully\nList of devices attached:\nMOTO-USB-772910\tdevice (authorizing via USB RSA token)',
      timestamp: getTimestamp(),
    },
    {
      id: 'log-3',
      type: isBootableUsbDebugActive ? 'success' : 'warn',
      text: isBootableUsbDebugActive
        ? '[BOOTABLE DEBUG: ACTIVO] El descriptor USB está configurado con ro.boot.usbconfig=adb,fastboot. Daemon ADB booteable habilitado en kernel init.'
        : '[INFO] Depuración USB estándar activa. Puedes ejecutar "fastboot oem enable-boot-debug" para activar Depuración USB Booteable.',
      timestamp: getTimestamp(),
    },
  ]);

  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const addLog = (text: string, type: LogEntry['type'] = 'output') => {
    setLogs((prev) => [
      ...prev,
      {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        type,
        text,
        timestamp: getTimestamp(),
      },
    ]);
  };

  const handleExecute = (customCmd?: string) => {
    const raw = (customCmd !== undefined ? customCmd : inputCommand).trim();
    if (!raw) return;

    playClickSound(soundEnabled);
    addLog(raw, 'cmd');
    setHistory((prev) => [raw, ...prev.slice(0, 49)]);
    setHistoryIndex(-1);
    setInputCommand('');

    const cmd = raw.toLowerCase();

    // 1. Clear terminal
    if (cmd === 'clear' || cmd === 'cls') {
      setLogs([]);
      return;
    }

    // 2. Help
    if (cmd === 'help' || cmd === '?') {
      addLog(
        `Comandos Disponibles de ADB & Fastboot:
------------------------------------------------------------------------
adb devices                       - Lista dispositivos USB y estado de autorización
adb shell                         - Ingresa a la consola interactiva Android
adb shell input keyevent 82       - Desbloquea la pantalla de bloqueo
adb reboot bootloader             - Reinicia el dispositivo en modo Fastboot
adb reboot recovery               - Reinicia en consola de recuperación Android
adb reboot                        - Reinicia normalmente en sistema Android
adb shell getprop                 - Muestra propiedades del sistema y build
adb shell dumpsys battery         - Muestra nivel, temperatura y estado de batería
fastboot devices                  - Lista dispositivos en modo AP Fastboot
fastboot oem enable-boot-debug    - Activa Depuración USB Booteable en arranque
fastboot oem config boot_debug 1  - Configura persistencia de depuración en bootloader
exit                              - Sale de adb shell o vuelve a modo ADB
clear                             - Limpia la pantalla de la consola`,
        'system'
      );
      return;
    }

    // 3. Activar depuración USB booteable
    if (
      cmd === 'fastboot oem enable-boot-debug' ||
      cmd === 'fastboot oem config boot_debug 1' ||
      cmd === 'adb bootable-debug' ||
      cmd.includes('bootable') ||
      cmd.includes('booteable')
    ) {
      setIsExecuting(true);
      addLog('[CONFIGURACIÓN] Estableciendo directivas de arranque booteable...', 'system');
      setTimeout(() => {
        addLog('$ fastboot oem config boot_debug 1', 'cmd');
        addLog('$ fastboot oem enable-boot-debug', 'cmd');
        addLog('$ adb shell setprop persist.service.adb.enable 1', 'cmd');
        addLog('$ adb shell setprop persist.service.debuggable 1', 'cmd');
        addLog('$ adb shell setprop ro.boot.usbconfig adb,fastboot', 'cmd');
        addLog(
          `[ÉXITO] Depuración USB booteable ACTIVADA.
✓ Kernel Cmdline: androidboot.debuggable=1
✓ USB Endpoint: BOOTABLE_FASTBOOT_ADB_INTERFACE
✓ Daemon ADB: Inicialización garantizada en stage 1 de kernel bootloader.
✓ Estado: PERSISTENTE EN ARRANQUE.`,
          'success'
        );
        onToggleBootableUsbDebug(true);
        playSuccessSound(soundEnabled);
        setIsExecuting(false);
      }, 700);
      return;
    }

    // 4. adb devices
    if (cmd === 'adb devices' || cmd === 'fastboot devices') {
      const devName = pairedDevice || 'MOTO-USB-772910';
      if (cmd.includes('fastboot') || currentMode === 'fastboot') {
        addLog(`List of devices attached in fastboot:\n${devName.split(' ')[0]}\tfastboot (Motorola AP Fastboot Flash Mode)`, 'success');
      } else {
        addLog(
          `List of devices attached:\n${devName.split(' ')[0]}\tdevice (product:${pairedDevice || 'Motorola_Edge_50'} model:${pairedDevice || 'Edge_50'} device:edge50 transport_id:1)`,
          'success'
        );
      }
      return;
    }

    // 5. adb shell
    if (cmd === 'adb shell') {
      setInAdbShell(true);
      setCurrentMode('shell');
      addLog('Ingresando al shell interactivo de Android.\nMotorola Mobility LLC (Linux kernel 6.1.45-android14-perf)\nmotorola:/ $ whoami\nshell (uid=2000, gid=2000, groups=2000,1004,1007,1011,1015,1028,3001,3002,3003,3006)', 'system');
      return;
    }

    if (cmd === 'exit') {
      if (inAdbShell || currentMode === 'shell') {
        setInAdbShell(false);
        setCurrentMode('adb');
        addLog('Saliendo de adb shell. Regresando a host prompt.', 'output');
      } else {
        addLog('Consola en nivel raíz de host.', 'output');
      }
      return;
    }

    // 6. adb shell input keyevent 82 (Desbloquear)
    if (cmd.includes('keyevent 82') || cmd.includes('dismiss-keyguard') || cmd.includes('unlock')) {
      addLog('$ adb shell input keyevent 82', 'cmd');
      addLog('$ adb shell wm dismiss-keyguard', 'cmd');
      addLog('[OK] Pantalla de bloqueo superada mediante inyección de evento ADB Keyguard.', 'success');
      playSuccessSound(soundEnabled);
      if (onUnlockSuccess) {
        onUnlockSuccess();
      }
      return;
    }

    // 7. adb reboot bootloader
    if (cmd.includes('reboot bootloader') || cmd === 'adb reboot-bootloader') {
      setCurrentMode('fastboot');
      addLog('$ adb reboot bootloader', 'cmd');
      addLog('[FASTBOOT] Reiniciando en Motorola AP Fastboot Flash Mode...\nProtocolo de flasheo y depuración USB de bajo nivel listo.', 'warn');
      return;
    }

    // 8. adb reboot recovery
    if (cmd.includes('reboot recovery')) {
      addLog('$ adb reboot recovery', 'cmd');
      addLog('[RECOVERY] Iniciando consola de recuperación Android Recovery...\nMontando particiones /system, /vendor y /metadata...', 'warn');
      return;
    }

    // 9. adb reboot
    if (cmd === 'adb reboot' || cmd === 'fastboot reboot') {
      setCurrentMode('adb');
      setInAdbShell(false);
      addLog('$ fastboot reboot', 'cmd');
      addLog('[REBOOT] Dispositivo reiniciando sistema operativo Android...\n[OK] Enlace USB reestablecido.', 'success');
      return;
    }

    // 10. adb shell getprop
    if (cmd.startsWith('getprop') || cmd.startsWith('adb shell getprop')) {
      const parts = raw.split(/\s+/);
      // specific key: getprop ro.product.model
      const targetKey = parts.length > 1 && !parts[1].startsWith('-') ? parts[parts.length - 1] : null;
      if (targetKey && targetKey !== 'getprop') {
        addLog(`[${targetKey}]: [${isBootableUsbDebugActive && targetKey === 'ro.boot.usbconfig' ? 'adb,fastboot' : 'config_ok'}]`, 'output');
      } else {
        addLog(
          `[ro.build.version.release]: [14]
[ro.build.version.sdk]: [34]
[ro.product.manufacturer]: [Motorola]
[ro.product.model]: [Motorola Edge 50 Ultra]
[ro.product.brand]: [motorola]
[ro.product.device]: [edge50]
[ro.boot.hardware]: [qcom]
[ro.debuggable]: [1]
[ro.boot.flash.locked]: [0]
[ro.boot.verifiedbootstate]: [orange]
[ro.boot.usbconfig]: [${isBootableUsbDebugActive ? 'adb,fastboot' : 'mtp,adb'}]
[persist.sys.usb.config]: [${isBootableUsbDebugActive ? 'adb,bootable_debug' : 'adb'}]
[persist.service.adb.enable]: [${isBootableUsbDebugActive ? '1' : '1'}]
[sys.usb.state]: [adb]
(Ejecuta 'adb shell setprop <key> <val>' o usa el Editor Visual para modificar propiedades)`,
          'output'
        );
      }
      return;
    }

    // 10.1. adb shell setprop <key> <val>
    if (cmd.startsWith('setprop') || cmd.startsWith('adb shell setprop')) {
      const parts = raw.trim().split(/\s+/);
      const isAdbPrefix = parts[0] === 'adb' && parts[1] === 'shell';
      const keyIdx = isAdbPrefix ? 3 : 1;
      const valIdx = isAdbPrefix ? 4 : 2;

      const propKey = parts[keyIdx];
      const propVal = parts.slice(valIdx).join(' ') || '1';

      if (!propKey) {
        addLog('Uso: adb shell setprop <clave> <valor>', 'warn');
        return;
      }

      if (propKey === 'ro.boot.usbconfig' && propVal.includes('bootable') || propKey === 'persist.service.adb.enable') {
        onToggleBootableUsbDebug(true);
      }

      addLog(`[setprop] Propiedad [${propKey}] configurada a: [${propVal}]\n[OK] Propiedad persistida en entorno de inicialización Android.`, 'success');
      playSuccessSound(soundEnabled);
      return;
    }

    // 11. adb shell dumpsys battery
    if (cmd.includes('dumpsys battery')) {
      addLog(
        `Current Battery Service state:
  AC powered: false
  USB powered: true (5V, 2000mA - TurboPower Active)
  Wireless powered: false
  Max charging current: 2000000
  Max charging voltage: 5000000
  Charge counter: 4850000
  status: 2 (Charging)
  health: 2 (Good)
  present: true
  level: 88%
  scale: 100
  voltage: 4210 mV
  temperature: 302 (30.2 C)
  technology: Li-poly`,
        'output'
      );
      return;
    }

    // 12. adb shell dmesg
    if (cmd.includes('dmesg')) {
      addLog(
        `[    0.000000] Linux version 6.1.45-android14-perf (android-build@google)
[    0.142010] Kernel command line: androidboot.debuggable=${isBootableUsbDebugActive ? '1' : '0'} ro.boot.usbconfig=${isBootableUsbDebugActive ? 'adb,fastboot' : 'mtp,adb'}
[    1.294101] usb 1-1: new high-speed USB device number 2 using dwc3
[    1.412093] android_usb: already in state: ADB_CONFIGURED
[    1.450192] adb_bind_config: ep0 initialized, endpoints IN/OUT active`,
        'output'
      );
      return;
    }

    // Generic fallback for other commands
    addLog(`Ejecutando: ${raw} en dispositivo...\n[OK] Código de salida: 0 (Operación completada con éxito)`, 'output');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleExecute();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const nextIdx = Math.min(historyIndex + 1, history.length - 1);
        setHistoryIndex(nextIdx);
        setInputCommand(history[nextIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIdx = historyIndex - 1;
        setHistoryIndex(nextIdx);
        setInputCommand(history[nextIdx]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInputCommand('');
      }
    }
  };

  const handleCopyLogs = () => {
    playClickSound(soundEnabled);
    const fullText = logs.map((l) => `[${l.timestamp}] ${l.text}`).join('\n');
    navigator.clipboard.writeText(fullText).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const handleDownloadLog = () => {
    playClickSound(soundEnabled);
    const fullText = logs.map((l) => `[${l.timestamp}] ${l.text}`).join('\n');
    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `adb-console-log-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const promptPrefix = inAdbShell
    ? 'motorola:/ $'
    : currentMode === 'fastboot'
    ? 'fastboot >'
    : 'C:\\platform-tools> adb';

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col gap-4 py-2">
      {/* Top Banner Contract with ADB status */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-5 shadow-2xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center shrink-0 shadow-lg shadow-cyan-950/40">
            <Terminal className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-extrabold text-white tracking-tight">
                Consola ADB & Fastboot
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 font-semibold">
                DAEMON TCP:5037
              </span>
              {isBootableUsbDebugActive ? (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/50 font-bold flex items-center gap-1 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  DEPURACIÓN USB BOOTEABLE: ACTIVA
                </span>
              ) : (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                  DEPURACIÓN BOOTEABLE: DISPONIBLE
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Terminal de comandos directos para control de bajo nivel, arranque booteable, inyección de eventos y telemetría de hardware.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Activar Depuración USB Booteable Toggle Button */}
          <button
            onClick={() => {
              if (isBootableUsbDebugActive) {
                onToggleBootableUsbDebug(false);
                addLog('[CONFIG] Depuración USB booteable desactivada. Modo normal restaurado.', 'warn');
              } else {
                handleExecute('fastboot oem enable-boot-debug');
              }
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 ${
              isBootableUsbDebugActive
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/50'
                : 'bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 shadow-amber-950/40'
            }`}
            title="Activar o desactivar persistencia de depuración en bootloader"
          >
            <Zap className={`w-3.5 h-3.5 ${isBootableUsbDebugActive ? 'text-white' : 'text-slate-950'}`} />
            <span>{isBootableUsbDebugActive ? 'Booteable: ACTIVO (Desactivar)' : 'Activar Depuración USB Booteable'}</span>
          </button>

          {onOpenMirror && (
            <button
              onClick={() => {
                playClickSound(soundEnabled);
                onOpenMirror();
              }}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
              <span>Pantalla USB</span>
            </button>
          )}

          {onOpenDeviceData && (
            <button
              onClick={() => {
                playClickSound(soundEnabled);
                onOpenDeviceData();
              }}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Abrir editor visual de propiedades getprop / setprop"
            >
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
              <span>Editor Visual getprop</span>
            </button>
          )}

          {onOpenDeviceData && (
            <button
              onClick={() => {
                playClickSound(soundEnabled);
                onOpenDeviceData();
              }}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span>Leer Datos</span>
            </button>
          )}
        </div>
      </div>

      {/* Quick Action Chips Bar */}
      <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 mr-1">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Comandos Rápidos:
        </span>

        <button
          onClick={() => handleExecute('fastboot oem enable-boot-debug')}
          className="px-2.5 py-1 rounded-xl bg-amber-950/80 border border-amber-500/50 text-amber-200 font-bold hover:bg-amber-900 transition-colors flex items-center gap-1"
        >
          <Zap className="w-3 h-3 text-amber-400" />
          <span>Activar USB Booteable</span>
        </button>

        <button
          onClick={() => handleExecute('adb devices')}
          className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 font-mono hover:border-cyan-500 hover:text-white transition-colors"
        >
          adb devices
        </button>

        <button
          onClick={() => handleExecute('adb shell getprop')}
          className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-700 text-cyan-300 font-mono hover:border-cyan-400 transition-colors"
        >
          adb shell getprop
        </button>

        <button
          onClick={() => handleExecute('adb shell setprop ro.boot.usbconfig adb,fastboot')}
          className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-700 text-amber-300 font-mono hover:border-amber-400 transition-colors"
          title="Modificar propiedad ro.boot.usbconfig"
        >
          setprop ro.boot.usbconfig
        </button>

        <button
          onClick={() => handleExecute('adb shell input keyevent 82')}
          className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-700 text-emerald-300 font-mono hover:border-emerald-500 transition-colors"
        >
          adb shell input keyevent 82
        </button>

        <button
          onClick={() => handleExecute('adb shell dumpsys battery')}
          className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 font-mono hover:border-cyan-500 hover:text-white transition-colors"
        >
          adb shell dumpsys battery
        </button>

        <button
          onClick={() => handleExecute('adb reboot bootloader')}
          className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-700 text-cyan-300 font-mono hover:border-cyan-500 transition-colors"
        >
          adb reboot bootloader
        </button>

        <button
          onClick={() => handleExecute('adb shell dmesg')}
          className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 font-mono hover:border-cyan-500 hover:text-white transition-colors"
        >
          adb shell dmesg
        </button>

        <button
          onClick={() => handleExecute('help')}
          className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-700 text-slate-400 font-mono hover:text-white transition-colors"
        >
          help
        </button>
      </div>

      {/* Terminal Main Window */}
      <div className="bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col font-mono text-xs">
        {/* Window Title Bar */}
        <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between gap-3 text-slate-400">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-rose-500/80" />
              <div className="w-3 h-3 rounded-full bg-amber-500/80" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
            </div>
            <span className="text-[11px] font-bold text-slate-300 ml-2 font-sans">
              terminal_adb_shell@{pairedDevice ? pairedDevice.split(' ')[0] : 'motorola'} ~ bash
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLogs}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors flex items-center gap-1 text-[11px] font-sans"
              title="Copiar contenido de la terminal"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isCopied ? 'Copiado' : 'Copiar'}</span>
            </button>

            <button
              onClick={handleDownloadLog}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors flex items-center gap-1 text-[11px] font-sans"
              title="Descargar registro como archivo de texto"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Descargar</span>
            </button>

            <button
              onClick={() => setLogs([])}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors flex items-center gap-1 text-[11px] font-sans"
              title="Limpiar pantalla"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Limpiar</span>
            </button>
          </div>
        </div>

        {/* Scrollable Log Stream */}
        <div className="p-4 sm:p-5 h-[460px] overflow-y-auto space-y-2 select-text custom-scrollbar bg-black/90">
          {logs.map((log) => {
            if (log.type === 'cmd') {
              return (
                <div key={log.id} className="flex items-start gap-2 text-cyan-300">
                  <span className="text-slate-500 select-none text-[10px] shrink-0 mt-0.5">
                    [{log.timestamp}]
                  </span>
                  <span className="text-emerald-400 font-bold select-none shrink-0">$</span>
                  <span className="font-bold text-white break-all">{log.text}</span>
                </div>
              );
            }

            if (log.type === 'system') {
              return (
                <div key={log.id} className="text-cyan-400/90 whitespace-pre-wrap leading-relaxed py-1">
                  {log.text}
                </div>
              );
            }

            if (log.type === 'success') {
              return (
                <div key={log.id} className="text-emerald-400 whitespace-pre-wrap leading-relaxed flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-400" />
                  <span>{log.text}</span>
                </div>
              );
            }

            if (log.type === 'warn') {
              return (
                <div key={log.id} className="text-amber-400 whitespace-pre-wrap leading-relaxed flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-400" />
                  <span>{log.text}</span>
                </div>
              );
            }

            if (log.type === 'error') {
              return (
                <div key={log.id} className="text-rose-400 whitespace-pre-wrap leading-relaxed">
                  {log.text}
                </div>
              );
            }

            return (
              <div key={log.id} className="text-slate-300 whitespace-pre-wrap leading-relaxed">
                {log.text}
              </div>
            );
          })}
          <div ref={terminalEndRef} />
        </div>

        {/* Command Input Field */}
        <div className="bg-slate-900 border-t border-slate-800 p-3 flex items-center gap-2">
          <span className="text-emerald-400 font-bold shrink-0 text-xs">
            {promptPrefix}
          </span>
          <input
            ref={inputRef}
            type="text"
            value={inputCommand}
            onChange={(e) => setInputCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un comando ADB / Fastboot (ej: fastboot oem enable-boot-debug, adb shell, help)..."
            className="flex-1 bg-transparent text-white placeholder-slate-500 focus:outline-none font-mono text-xs caret-cyan-400"
            autoFocus
          />
          <button
            onClick={() => handleExecute()}
            disabled={!inputCommand.trim() || isExecuting}
            className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-bold font-sans text-xs flex items-center gap-1 transition-all shadow-sm active:scale-95 shrink-0"
          >
            <Play className="w-3 h-3 fill-slate-950" />
            <span>Ejecutar</span>
          </button>
        </div>
      </div>
    </div>
  );
};
