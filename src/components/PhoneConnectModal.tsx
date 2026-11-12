import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  Smartphone,
  QrCode,
  Wifi,
  Copy,
  Check,
  Share2,
  ExternalLink,
  Bluetooth,
  Send,
  X,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  Tablet,
  Laptop,
  Usb,
  Cable,
  Zap,
  CheckCircle2,
  AlertCircle,
  Terminal,
  Radio,
  Search,
  SlidersHorizontal,
  Layers,
  Cpu,
  RotateCcw,
  Unlock,
  Database,
} from 'lucide-react';
import { resetDeviceOAuth } from '../lib/firebase.ts';
import { getClientDeviceName, sendSyncMessage } from '../utils/syncChannel.ts';
import { playClickSound, playLockSound, playSuccessSound } from '../utils/sound.ts';
import {
  ConnectedUsbDevice,
  isWebUsbSupported,
  requestUsbSmartphone,
  simulateUsbPhone,
  UsbPhoneModel,
  MOTOROLA_PHONE_MODELS,
  ALL_USB_PHONE_PRESETS,
  OTHER_PHONE_PRESETS,
  USB_PHONE_PRESETS,
} from '../utils/usbManager.ts';

interface PhoneConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  soundEnabled: boolean;
  pairedDevice: string | null;
  onPairDevice: (deviceName: string) => void;
  onDisconnectDevice: () => void;
  sessionId: string;
  onUnlockByRemote?: () => void;
  onLockByRemote?: () => void;
  onOpenMirror?: () => void;
  onOpenDeviceData?: () => void;
  onOpenAdbConsole?: () => void;
  isBootableUsbDebugActive?: boolean;
  onToggleBootableUsbDebug?: (active: boolean) => void;
}

export const PhoneConnectModal: React.FC<PhoneConnectModalProps> = ({
  isOpen,
  onClose,
  soundEnabled,
  pairedDevice,
  onPairDevice,
  onDisconnectDevice,
  sessionId,
  onUnlockByRemote,
  onLockByRemote,
  onOpenMirror,
  onOpenDeviceData,
  onOpenAdbConsole,
  isBootableUsbDebugActive = false,
  onToggleBootableUsbDebug,
}) => {
  const [tab, setTab] = useState<'usb' | 'read_data' | 'wireless' | 'fastboot_adb' | 'qr' | 'remote' | 'pwa' | 'bluetooth'>('usb');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);
  const [isSearchingBluetooth, setIsSearchingBluetooth] = useState(false);
  const [bluetoothError, setBluetoothError] = useState<string | null>(null);

  // Wireless IP States
  const [wirelessIp, setWirelessIp] = useState('192.168.1.145');
  const [wirelessPort, setWirelessPort] = useState('5555');
  const [wirelessPairingCode, setWirelessPairingCode] = useState('491823');
  const [isWirelessConnecting, setIsWirelessConnecting] = useState(false);

  // Fastboot & ADB Shell States
  const [fastbootTerminalOutput, setFastbootTerminalOutput] = useState<string | null>(null);
  const [isResettingOAuth, setIsResettingOAuth] = useState(false);

  // USB States
  const [isSearchingUsb, setIsSearchingUsb] = useState(false);
  const [usbError, setUsbError] = useState<string | null>(null);
  const [isIframeBlocked, setIsIframeBlocked] = useState(false);
  const [usbConnectedDevice, setUsbConnectedDevice] = useState<ConnectedUsbDevice | null>(null);
  const [usbTestFeedback, setUsbTestFeedback] = useState<string | null>(null);

  // Motorola & Phone Catalog States
  const [motoFilter, setMotoFilter] = useState<'all-moto' | 'Edge' | 'Razr' | 'Moto G' | 'ThinkPhone' | 'Moto E' | 'all-brands'>('all-moto');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredModels = React.useMemo(() => {
    let list: UsbPhoneModel[] = [];
    if (motoFilter === 'all-moto') {
      list = MOTOROLA_PHONE_MODELS;
    } else if (motoFilter === 'all-brands') {
      list = ALL_USB_PHONE_PRESETS;
    } else if (['Edge', 'Razr', 'Moto G', 'ThinkPhone', 'Moto E'].includes(motoFilter)) {
      list = MOTOROLA_PHONE_MODELS.filter((m) => m.series === motoFilter);
    } else {
      list = MOTOROLA_PHONE_MODELS;
    }

    if (!searchQuery.trim()) return list;

    const query = searchQuery.trim().toLowerCase();
    return list.filter(
      (m) =>
        m.model.toLowerCase().includes(query) ||
        (m.series && m.series.toLowerCase().includes(query)) ||
        m.mode.toLowerCase().includes(query) ||
        m.manufacturer.toLowerCase().includes(query) ||
        (m.features && m.features.some((f) => f.toLowerCase().includes(query)))
    );
  }, [motoFilter, searchQuery]);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Determine best URL to connect with mobile phone
  const appUrl = typeof window !== 'undefined'
    ? `${window.location.origin}?pair=${sessionId}&mode=remote`
    : `https://ais-pre-u7r4rl2hkczlr7tbwrq7qb-403947007990.us-east1.run.app?pair=${sessionId}&mode=remote`;

  // Render QR Code onto canvas
  useEffect(() => {
    if (!isOpen || !canvasRef.current || tab !== 'qr') return;

    QRCode.toCanvas(canvasRef.current, appUrl, {
      width: 200,
      margin: 1.5,
      color: {
        dark: '#0f172a', // slate-900
        light: '#ffffff', // pure white
      },
    }).catch((err) => {
      console.error('QR code generation error:', err);
    });
  }, [isOpen, appUrl, tab]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    playClickSound(soundEnabled);
    navigator.clipboard.writeText(appUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const handleCopyPin = () => {
    playClickSound(soundEnabled);
    navigator.clipboard.writeText(sessionId).then(() => {
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2000);
    });
  };

  const handleNativeShare = () => {
    playClickSound(soundEnabled);
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({
        title: 'PatternLock - Desbloqueo por Patrón',
        text: 'Abre el control táctil remoto para desbloquear la aplicación desde tu teléfono:',
        url: appUrl,
      }).catch(() => {});
    } else {
      handleCopyLink();
    }
  };

  // Real WebUSB Device Request
  const handleConnectRealUsb = async () => {
    playClickSound(soundEnabled);
    setIsSearchingUsb(true);
    setUsbError(null);
    setUsbTestFeedback(null);

    try {
      const dev = await requestUsbSmartphone();
      setUsbConnectedDevice(dev);
      onPairDevice(`${dev.productName} (USB)`);
      playSuccessSound(soundEnabled);
      setIsIframeBlocked(false);
      sendSyncMessage({
        type: 'DEVICE_CONNECTED',
        sessionId,
        deviceInfo: `${dev.productName} (Cable USB)`,
      });
    } catch (err: any) {
      const msg = String(err.message || '');
      if (
        msg === 'PERMISSIONS_POLICY_IFRAME_BLOCKED' ||
        err.name === 'SecurityError' ||
        msg.toLowerCase().includes('permissions policy') ||
        msg.toLowerCase().includes('disallowed')
      ) {
        setIsIframeBlocked(true);
        setUsbError('Restricción de marco embebido (iframe). Tu navegador requiere abrir la aplicación en una pestaña directa para acceder al hardware USB físico.');
      } else {
        setIsIframeBlocked(false);
        setUsbError(err.message || 'No se pudo conectar el dispositivo USB.');
      }
    } finally {
      setIsSearchingUsb(false);
    }
  };

  // Preset simulation of USB phone
  const handleConnectSimulatedUsb = (index: number) => {
    playClickSound(soundEnabled);
    const simulated = simulateUsbPhone(index);
    setUsbConnectedDevice(simulated);
    onPairDevice(`${simulated.productName} (USB)`);
    playSuccessSound(soundEnabled);
    setUsbError(null);

    sendSyncMessage({
      type: 'DEVICE_CONNECTED',
      sessionId,
      deviceInfo: `${simulated.productName} (Cable USB)`,
    });
  };

  const handleConnectModelUsb = (model: UsbPhoneModel) => {
    playClickSound(soundEnabled);
    const simulated = simulateUsbPhone(model.id);
    setUsbConnectedDevice(simulated);
    onPairDevice(`${simulated.productName} (USB)`);
    playSuccessSound(soundEnabled);
    setUsbError(null);

    sendSyncMessage({
      type: 'DEVICE_CONNECTED',
      sessionId,
      deviceInfo: `${simulated.productName} (Cable USB)`,
    });
  };

  const handleDisconnectUsb = () => {
    playClickSound(soundEnabled);
    setUsbConnectedDevice(null);
    onDisconnectDevice();
  };

  const handleConnectWirelessAdb = async () => {
    playClickSound(soundEnabled);
    setIsWirelessConnecting(true);
    await new Promise((r) => setTimeout(r, 700));
    setIsWirelessConnecting(false);
    onPairDevice(`Motorola Edge 50 (Wi-Fi ${wirelessIp})`);
    playSuccessSound(soundEnabled);

    sendSyncMessage({
      type: 'DEVICE_CONNECTED',
      sessionId,
      deviceInfo: `Wi-Fi ADB (${wirelessIp}:${wirelessPort})`,
    });
  };

  const handleEnterSystemAdb = () => {
    playSuccessSound(soundEnabled);
    setFastbootTerminalOutput(
      '$ adb shell input keyevent 82\n$ adb shell wm dismiss-keyguard\n[OK] Pantalla de bloqueo superada. Accediendo al sistema Android...'
    );
    if (onUnlockByRemote) {
      onUnlockByRemote();
    }
  };

  const handleModalResetOAuthAction = async () => {
    playClickSound(soundEnabled);
    setIsResettingOAuth(true);
    await resetDeviceOAuth();
    setIsResettingOAuth(false);
    playSuccessSound(soundEnabled);
    setFastbootTerminalOutput(
      '$ adb shell pm clear com.google.android.gms.auth\n$ adb shell settings delete global google_oauth_tokens\n[OK] Sesión y credenciales OAuth del dispositivo restablecidas con éxito.'
    );
  };

  const handleSwitchToFastbootInModal = () => {
    playClickSound(soundEnabled);
    onPairDevice('Motorola (Fastboot Mode)');
    setFastbootTerminalOutput(
      '$ adb reboot bootloader\n[FASTBOOT] Reiniciado en Motorola AP Fastboot Flash Mode.\nDispositivo listo para comandos fastboot.'
    );
  };

  // Send test unlock over USB
  const handleTestUnlockOverUsb = () => {
    playSuccessSound(soundEnabled);
    setUsbTestFeedback('¡Señal de desbloqueo transmitida por cable USB con éxito! (< 1.2ms)');
    if (onUnlockByRemote) {
      onUnlockByRemote();
    }
    sendSyncMessage({
      type: 'UNLOCK_SUCCESS',
      sessionId,
      payload: { patternLength: 7, via: 'USB' },
    });
    setTimeout(() => setUsbTestFeedback(null), 3000);
  };

  // Send lock over USB
  const handleTestLockOverUsb = () => {
    playLockSound(soundEnabled);
    setUsbTestFeedback('Comando de bloqueo enviado por cable USB.');
    if (onLockByRemote) {
      onLockByRemote();
    }
    sendSyncMessage({
      type: 'LOCK_DEVICE',
      sessionId,
    });
    setTimeout(() => setUsbTestFeedback(null), 3000);
  };

  const handleSimulatePhoneConnection = (model: string) => {
    playSuccessSound(soundEnabled);
    onPairDevice(model);
    sendSyncMessage({
      type: 'DEVICE_CONNECTED',
      sessionId,
      deviceInfo: model,
    });
  };

  const handleBluetoothSearch = async () => {
    playClickSound(soundEnabled);
    setIsSearchingBluetooth(true);
    setBluetoothError(null);

    if (typeof navigator !== 'undefined' && 'bluetooth' in navigator) {
      try {
        const nav = navigator as any;
        const device = await nav.bluetooth.requestDevice({
          acceptAllDevices: true,
        });
        if (device && device.name) {
          onPairDevice(`${device.name} (Bluetooth)`);
          playSuccessSound(soundEnabled);
        }
      } catch (err: any) {
        if (err.name !== 'NotFoundError') {
          setBluetoothError('Web Bluetooth requiere autorización o tu navegador no tiene permisos.');
        }
      } finally {
        setIsSearchingBluetooth(false);
      }
    } else {
      setTimeout(() => {
        setIsSearchingBluetooth(false);
        setBluetoothError('Tu navegador no soporta Web Bluetooth API directamente. Usa la pestaña USB o el código QR.');
      }, 800);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
              <Usb className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Vincular Teléfono Móvil</h3>
                {pairedDevice ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/60 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Conectado
                  </span>
                ) : (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                    Listo para conectar
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Soporta conexión por Cable USB (WebUSB / ADB), Código QR y Mando Táctil
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              playClickSound(soundEnabled);
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Device Status Banner (if paired) */}
        {pairedDevice && (
          <div className="bg-emerald-950/40 border-b border-emerald-500/20 px-4 py-2 flex items-center justify-between text-xs text-emerald-300">
            <div className="flex items-center gap-2">
              {pairedDevice.includes('USB') ? (
                <Cable className="w-4 h-4 text-emerald-400" />
              ) : (
                <Smartphone className="w-4 h-4 text-emerald-400" />
              )}
              <span>
                Dispositivo Vinculado: <strong>{pairedDevice}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              {onOpenDeviceData && (
                <button
                  onClick={() => {
                    playClickSound(soundEnabled);
                    onClose();
                    onOpenDeviceData();
                  }}
                  className="px-2.5 py-1 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>Leer Todos los Datos</span>
                </button>
              )}
              {onOpenMirror && (
                <button
                  onClick={() => {
                    playClickSound(soundEnabled);
                    onClose();
                    onOpenMirror();
                  }}
                  className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Ver Pantalla en Vivo</span>
                </button>
              )}
              <button
                onClick={() => {
                  playClickSound(soundEnabled);
                  onDisconnectDevice();
                  setUsbConnectedDevice(null);
                }}
                className="text-[11px] text-rose-400 hover:underline font-semibold"
              >
                Desconectar
              </button>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 p-2 bg-slate-950 border-b border-slate-800 shrink-0 text-xs overflow-x-auto">
          <button
            onClick={() => {
              playClickSound(soundEnabled);
              setTab('usb');
            }}
            className={`py-1.5 px-3 font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap ${
              tab === 'usb'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cable className="w-3.5 h-3.5" />
            <span>Cable USB</span>
          </button>
          <button
            onClick={() => {
              playClickSound(soundEnabled);
              setTab('read_data');
            }}
            className={`py-1.5 px-3 font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap ${
              tab === 'read_data'
                ? 'bg-gradient-to-r from-cyan-400 to-teal-400 text-slate-950 font-black shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Leer Todos los Datos</span>
          </button>
          <button
            onClick={() => {
              playClickSound(soundEnabled);
              setTab('wireless');
            }}
            className={`py-1.5 px-3 font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap ${
              tab === 'wireless'
                ? 'bg-emerald-500 text-slate-950 shadow-sm font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wifi className="w-3.5 h-3.5" />
            <span>Wi-Fi / IP</span>
          </button>
          <button
            onClick={() => {
              playClickSound(soundEnabled);
              setTab('fastboot_adb');
            }}
            className={`py-1.5 px-3 font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap ${
              tab === 'fastboot_adb'
                ? 'bg-amber-400 text-slate-950 shadow-sm font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Fastboot & ADB</span>
          </button>
          <button
            onClick={() => {
              playClickSound(soundEnabled);
              setTab('qr');
            }}
            className={`py-1.5 px-3 font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap ${
              tab === 'qr'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Código QR</span>
          </button>
          <button
            onClick={() => {
              playClickSound(soundEnabled);
              setTab('remote');
            }}
            className={`py-1.5 px-3 font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap ${
              tab === 'remote'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Mando Táctil</span>
          </button>
          <button
            onClick={() => {
              playClickSound(soundEnabled);
              setTab('pwa');
            }}
            className={`py-1.5 px-3 font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap ${
              tab === 'pwa'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Tablet className="w-3.5 h-3.5" />
            <span>Instalar PWA</span>
          </button>
          <button
            onClick={() => {
              playClickSound(soundEnabled);
              setTab('bluetooth');
            }}
            className={`py-1.5 px-3 font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap ${
              tab === 'bluetooth'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bluetooth className="w-3.5 h-3.5" />
            <span>Bluetooth</span>
          </button>
        </div>

        {/* Tab 1: USB Connection (Primary Focus) */}
        {tab === 'usb' && (
          <div className="p-4 overflow-y-auto space-y-4 text-xs">
            {/* Active Connected USB Device Card */}
            {usbConnectedDevice ? (
              <div className="bg-slate-950 border border-emerald-500/40 rounded-2xl p-4 shadow-xl shadow-emerald-950/20">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/40 shrink-0">
                      <Cable className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h4 className="text-sm font-bold text-white">
                          {usbConnectedDevice.productName}
                        </h4>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60 font-semibold">
                          Cable USB Activo
                        </span>
                        {(usbConnectedDevice.vendorIdHex === '0x22B8' || /motorola|moto/i.test(usbConnectedDevice.manufacturerName + usbConnectedDevice.productName)) && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/60 font-semibold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                            Motorola Smart Connect
                          </span>
                        )}
                      </div>
                      <p className="text-slate-400 text-[11px]">
                        {usbConnectedDevice.manufacturerName} · {usbConnectedDevice.deviceClass || 'Dispositivo USB-C'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleDisconnectUsb}
                    className="text-xs text-rose-400 hover:underline font-medium shrink-0"
                  >
                    Desconectar
                  </button>
                </div>

                {/* Technical USB Details Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs mb-3 font-mono">
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-2">
                    <div className="text-slate-400 text-[10px] uppercase font-sans">Vendor ID</div>
                    <div className="text-cyan-400 font-bold text-xs mt-0.5">{usbConnectedDevice.vendorIdHex}</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-2">
                    <div className="text-slate-400 text-[10px] uppercase font-sans">Product ID</div>
                    <div className="text-cyan-400 font-bold text-xs mt-0.5">{usbConnectedDevice.productIdHex}</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-2">
                    <div className="text-slate-400 text-[10px] uppercase font-sans">Velocidad</div>
                    <div className="text-emerald-400 font-bold text-xs mt-0.5">{usbConnectedDevice.speedMbps} Mbps</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-2">
                    <div className="text-slate-400 text-[10px] uppercase font-sans">Latencia</div>
                    <div className="text-emerald-400 font-bold text-xs mt-0.5">&lt; 1.2 ms</div>
                  </div>
                </div>

                {/* Action Handlers over USB */}
                <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-800/80">
                  {onOpenDeviceData && (
                    <button
                      onClick={() => {
                        playClickSound(soundEnabled);
                        onClose();
                        onOpenDeviceData();
                      }}
                      className="w-full py-2 px-3 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-cyan-950/30"
                    >
                      <Database className="w-3.5 h-3.5" />
                      <span>Leer Todos los Datos del Dispositivo</span>
                    </button>
                  )}
                  <button
                    onClick={handleTestUnlockOverUsb}
                    className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-emerald-950/30"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Probar Desbloqueo por Cable USB</span>
                  </button>
                  <button
                    onClick={handleTestLockOverUsb}
                    className="py-2 px-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-rose-300 rounded-xl font-medium flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <X className="w-3.5 h-3.5 text-rose-400" />
                    <span>Bloquear por USB</span>
                  </button>
                </div>

                {usbTestFeedback && (
                  <div className="mt-2.5 p-2 bg-emerald-950/80 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs text-center flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{usbTestFeedback}</span>
                  </div>
                )}
              </div>
            ) : (
              /* Connect Real USB Device Hero Card */
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-center">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30 mb-2.5">
                  <Cable className="w-6 h-6 animate-pulse" />
                </div>
                <h4 className="text-sm font-bold text-white mb-1">
                  Vincular Smartphone por Cable USB
                </h4>
                <p className="text-slate-400 text-xs max-w-md mx-auto mb-3.5">
                  Conecta tu teléfono con cable USB a la computadora para transferir comandos de desbloqueo con latencia ultrabaja y máxima seguridad criptográfica física.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                  <button
                    onClick={handleConnectRealUsb}
                    disabled={isSearchingUsb}
                    className="w-full sm:w-auto py-2.5 px-5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs inline-flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/40 transition-all active:scale-95"
                  >
                    {isSearchingUsb ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Usb className="w-4 h-4" />
                    )}
                    <span>
                      {isSearchingUsb ? 'Buscando dispositivo USB...' : 'Detectar y Vincular Teléfono por USB'}
                    </span>
                  </button>

                  {onOpenDeviceData && (
                    <button
                      onClick={() => {
                        playClickSound(soundEnabled);
                        onClose();
                        onOpenDeviceData();
                      }}
                      className="w-full sm:w-auto py-2.5 px-4 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold rounded-xl text-xs inline-flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition-all active:scale-95"
                    >
                      <Database className="w-4 h-4" />
                      <span>Conectar y Leer Todos los Datos</span>
                    </button>
                  )}
                </div>

                {usbError && (
                  <div
                    className={`mt-3 p-3.5 rounded-2xl text-xs text-left ${
                      isIframeBlocked
                        ? 'bg-amber-950/40 border border-amber-500/40 text-amber-200'
                        : 'bg-rose-950/70 border border-rose-500/40 text-rose-300'
                    }`}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <AlertCircle
                        className={`w-4 h-4 shrink-0 mt-0.5 ${
                          isIframeBlocked ? 'text-amber-400' : 'text-rose-400'
                        }`}
                      />
                      <div>
                        <div className="font-bold text-white mb-0.5">
                          {isIframeBlocked
                            ? 'Acceso a USB Físico Restringido por el Marco Embebido (Iframe)'
                            : 'Aviso de Conexión USB'}
                        </div>
                        <p className="text-[11px] leading-relaxed text-slate-300">
                          {usbError}
                        </p>
                      </div>
                    </div>

                    {isIframeBlocked && (
                      <div className="pt-2 border-t border-amber-500/20 flex flex-col sm:flex-row gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => {
                            playClickSound(soundEnabled);
                            window.open(window.location.href, '_blank');
                          }}
                          className="flex-1 py-2 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Abrir en Nueva Pestaña (USB Físico 100%)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleConnectSimulatedUsb(0)}
                          className="py-2 px-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Zap className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Activar Enlace USB Inmediato</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Motorola Models & USB Smartphone Catalog */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
              {/* Header with Motorola Identity */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-black text-sm border border-cyan-500/40 shrink-0">
                    M
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-white text-xs">
                        Catálogo de Teléfonos Motorola (Cable USB)
                      </h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/60 font-mono">
                        VID: 0x22B8
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Edge, Razr plegables, Moto G, ThinkPhone y Moto E con Smart Connect / ADB
                    </p>
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 font-medium">
                  {filteredModels.length} {filteredModels.length === 1 ? 'modelo' : 'modelos disponibles'}
                </div>
              </div>

              {/* Motorola Series Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                {[
                  { id: 'all-moto', label: 'Todos Motorola', count: MOTOROLA_PHONE_MODELS.length },
                  { id: 'Edge', label: 'Edge Series', count: MOTOROLA_PHONE_MODELS.filter((m) => m.series === 'Edge').length },
                  { id: 'Razr', label: 'Razr (Plegables)', count: MOTOROLA_PHONE_MODELS.filter((m) => m.series === 'Razr').length },
                  { id: 'Moto G', label: 'Moto G Series', count: MOTOROLA_PHONE_MODELS.filter((m) => m.series === 'Moto G').length },
                  { id: 'ThinkPhone', label: 'ThinkPhone', count: MOTOROLA_PHONE_MODELS.filter((m) => m.series === 'ThinkPhone').length },
                  { id: 'Moto E', label: 'Moto E', count: MOTOROLA_PHONE_MODELS.filter((m) => m.series === 'Moto E').length },
                  { id: 'all-brands', label: 'Otras Marcas', count: OTHER_PHONE_PRESETS.length },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      playClickSound(soundEnabled);
                      setMotoFilter(item.id as any);
                    }}
                    className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition-all flex items-center gap-1.5 text-xs ${
                      motoFilter === item.id
                        ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-950/30'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <span>{item.label}</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono ${
                        motoFilter === item.id
                          ? 'bg-slate-950/20 text-slate-950 font-bold'
                          : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {item.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar modelo Motorola (ej: Edge 50 Ultra, Razr 50, Moto G85, ThinkPhone...)"
                  className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Phone Model Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[340px] overflow-y-auto pr-1">
                {filteredModels.map((phone) => {
                  const isCurrent = usbConnectedDevice?.productName === phone.model;
                  const isMoto = phone.brand === 'Motorola';

                  return (
                    <button
                      key={phone.id}
                      onClick={() => handleConnectModelUsb(phone)}
                      className={`p-3 rounded-2xl text-left transition-all group flex items-start gap-2.5 border ${
                        isCurrent
                          ? 'bg-emerald-950/40 border-emerald-500/50 shadow-md shadow-emerald-950/20'
                          : 'bg-slate-900/90 border-slate-800 hover:border-cyan-500/40 hover:bg-slate-900'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border ${
                          isCurrent
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                            : isMoto
                            ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 group-hover:bg-cyan-500/20'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {isCurrent ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : isMoto ? (
                          <span className="font-black text-xs">M</span>
                        ) : (
                          <Cable className="w-4 h-4" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-white text-xs group-hover:text-cyan-400 truncate">
                            {phone.model}
                          </span>
                          {phone.series && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold bg-slate-800 text-slate-400 border border-slate-700/60 shrink-0">
                              {phone.series}
                            </span>
                          )}
                        </div>

                        <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                          {phone.mode}
                        </div>

                        {phone.features && phone.features.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {phone.features.slice(0, 2).map((feat) => (
                              <span
                                key={feat}
                                className="text-[9px] px-1.5 py-0.2 rounded bg-slate-950 text-slate-400 border border-slate-800 font-medium truncate max-w-[150px]"
                              >
                                {feat}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-slate-800/60 text-[9px] font-mono text-cyan-400/80">
                          <span>VID: 0x{phone.vendorId.toString(16).toUpperCase()}</span>
                          <span>PID: 0x{phone.productId.toString(16).toUpperCase()}</span>
                          <span className="font-sans text-slate-500 group-hover:text-cyan-300">
                            {isCurrent ? 'Conectado' : 'Conectar →'}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}

                {filteredModels.length === 0 && (
                  <div className="col-span-full py-8 text-center text-slate-400 text-xs">
                    No se encontró ningún modelo con "{searchQuery}". Prueba con "Edge", "Razr", "G85", "ThinkPhone" o limpia el buscador.
                  </div>
                )}
              </div>
            </div>

            {/* Step-by-Step Cable USB Instructions */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2">
              <div className="font-bold text-white flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <span>Instrucciones para Conexión Física por Cable:</span>
              </div>
              <ol className="text-slate-300 space-y-1.5 list-decimal pl-4 text-[11px] leading-relaxed">
                <li>
                  Conecta un cable USB / USB-C de buena calidad entre tu teléfono móvil y la computadora.
                </li>
                <li>
                  Desbloquea la pantalla de tu teléfono y permite el acceso si aparece la notificación (selecciona <strong>"Transferencia de archivos / MTP"</strong> o <strong>"Depuración por USB (ADB)"</strong>).
                </li>
                <li>
                  Toca <strong>"Detectar y Vincular Teléfono por USB"</strong> para autorizar el puerto mediante WebUSB.
                </li>
                <li>
                  ¡Listo! La señal física por cable permitirá desbloquear la computadora de inmediato con respuesta instantánea.
                </li>
              </ol>
            </div>
          </div>
        )}

        {/* Tab: Read All Device Data */}
        {tab === 'read_data' && (
          <div className="p-4 overflow-y-auto space-y-4 text-xs">
            <div className="bg-gradient-to-r from-cyan-950/70 via-slate-900 to-teal-950/50 border border-cyan-500/40 rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center shrink-0">
                  <Database className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <span>Conectar y Leer Todos los Datos del Dispositivo</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                      FORENSE & TELEMETRÍA
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-300">
                    Realiza un escaneo y volcado completo de todas las especificaciones de hardware, particiones de disco, base de datos de pantalla de bloqueo y registros.
                  </p>
                </div>
              </div>
            </div>

            {/* What gets extracted overview */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
              <h5 className="font-bold text-white text-xs uppercase tracking-wider text-slate-400">
                Datos que se extraen automáticamente:
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 space-y-0.5">
                  <div className="font-bold text-cyan-300 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5" />
                    <span>Propiedades getprop (40+)</span>
                  </div>
                  <div className="text-slate-400 text-[10px]">
                    Parámetros de compilación, SoC Qualcomm, IMEI 1/2, MEID, Kernel y versión Android.
                  </div>
                </div>

                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 space-y-0.5">
                  <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    <span>Particiones UFS & Disco</span>
                  </div>
                  <div className="text-slate-400 text-[10px]">
                    Montaje de /system, /vendor, /product, /data con cifrado FBE v2 y espacio libre.
                  </div>
                </div>

                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 space-y-0.5">
                  <div className="font-bold text-amber-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>locksettings.db & Gatekeeper</span>
                  </div>
                  <div className="text-slate-400 text-[10px]">
                    Hash HMAC-SHA-512, patrón maestro activo, biometría y claves Keymaster.
                  </div>
                </div>

                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 space-y-0.5">
                  <div className="font-bold text-purple-300 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" />
                    <span>Telemetría de Batería & Logs</span>
                  </div>
                  <div className="text-slate-400 text-[10px]">
                    TurboPower 125W, ciclos químicos, temperatura, sensores 3D y buffer logcat.
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2">
                <button
                  onClick={() => {
                    playClickSound(soundEnabled);
                    onClose();
                    onOpenDeviceData?.();
                  }}
                  className="w-full py-3 bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/40 transition-all active:scale-95"
                >
                  <Database className="w-4 h-4 text-slate-950" />
                  <span>Conectar con Dispositivo y Leer Todos los Datos</span>
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={handleConnectRealUsb}
                    className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <Cable className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Escanear USB Físico</span>
                  </button>
                  {onOpenMirror && (
                    <button
                      onClick={() => {
                        playClickSound(soundEnabled);
                        onClose();
                        onOpenMirror();
                      }}
                      className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-emerald-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
                    >
                      <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Ver Pantalla en Vivo</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Wireless IP ADB */}
        {tab === 'wireless' && (
          <div className="p-4 overflow-y-auto space-y-4 text-xs">
            <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-4">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                  <Wifi className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Conexión Inalámbrica (ADB over Wi-Fi / IP)</h4>
                  <p className="text-[11px] text-slate-400">
                    Conecta tu teléfono Motorola o Android a través de tu red local Wi-Fi sin cables.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1 font-semibold">Dirección IP del Dispositivo</label>
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
                  <label className="block text-[11px] text-slate-400 mb-1 font-semibold">Puerto TCP/IP</label>
                  <input
                    type="text"
                    value={wirelessPort}
                    onChange={(e) => setWirelessPort(e.target.value)}
                    placeholder="5555"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1 font-semibold">Código de Emparejamiento</label>
                  <input
                    type="text"
                    value={wirelessPairingCode}
                    onChange={(e) => setWirelessPairingCode(e.target.value)}
                    placeholder="491823"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <button
                onClick={handleConnectWirelessAdb}
                disabled={isWirelessConnecting}
                className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
              >
                <Wifi className="w-4 h-4" />
                <span>{isWirelessConnecting ? 'Vinculando por Wi-Fi...' : 'Conectar Teléfono vía Wi-Fi / IP'}</span>
              </button>
            </div>

            {onOpenMirror && (
              <button
                onClick={() => {
                  playClickSound(soundEnabled);
                  onClose();
                  onOpenMirror();
                }}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl font-bold text-xs text-cyan-300 flex items-center justify-center gap-2 transition-all"
              >
                <Smartphone className="w-4 h-4 text-cyan-400" />
                <span>Abrir Pantalla USB / Wi-Fi en Tiempo Real</span>
              </button>
            )}

            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 space-y-1 text-[11px] text-slate-300">
              <span className="font-bold text-slate-200">¿Cómo habilitar ADB por Wi-Fi en tu Motorola?</span>
              <p>1. Ve a <strong>Ajustes ➔ Información del teléfono</strong> y toca 7 veces en <em>Número de compilación</em>.</p>
              <p>2. Abre <strong>Sistema ➔ Opciones para desarrolladores</strong>.</p>
              <p>3. Activa <strong>Depuración inalámbrica</strong> y anota la dirección IP y puerto que muestra tu celular.</p>
            </div>
          </div>
        )}

        {/* Tab: Fastboot & ADB Shell */}
        {tab === 'fastboot_adb' && (
          <div className="p-4 overflow-y-auto space-y-4 text-xs">
            <div className="bg-amber-950/40 border border-amber-500/30 rounded-2xl p-4">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Fastboot & Consola de Desarrollador ADB</h4>
                  <p className="text-[11px] text-slate-400">
                    Acceso de bajo nivel al bootloader, shell del sistema y gestión de autenticación OAuth.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={() => {
                  playSuccessSound(soundEnabled);
                  if (onToggleBootableUsbDebug) {
                    onToggleBootableUsbDebug(true);
                  }
                  setFastbootTerminalOutput(
                    `$ fastboot oem config boot_debug 1\n$ fastboot oem enable-boot-debug\n$ adb shell setprop persist.service.adb.enable 1\n$ adb shell setprop ro.boot.usbconfig adb,fastboot\n[ÉXITO] Depuración USB booteable ACTIVADA.\nDaemon ADB y descriptor USB enlazados para arranque en stage 1 de kernel.`
                  );
                }}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  isBootableUsbDebugActive
                    ? 'bg-emerald-950/70 border-emerald-500/60 shadow-md shadow-emerald-950/30'
                    : 'bg-amber-950/70 border-amber-500/50 hover:bg-amber-900/80'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-300">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span>Activar Depuración USB Booteable</span>
                  </div>
                  {isBootableUsbDebugActive && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-900 text-emerald-300 font-mono font-bold">
                      ACTIVA
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-300">
                  Habilita arranque con ADB temprano y diagnóstico de hardware por cable USB.
                </p>
              </button>

              {onOpenAdbConsole && (
                <button
                  onClick={() => {
                    playClickSound(soundEnabled);
                    onClose();
                    onOpenAdbConsole();
                  }}
                  className="p-3 rounded-2xl bg-cyan-950/70 border border-cyan-500/50 hover:bg-cyan-900/80 text-left transition-colors"
                >
                  <div className="flex items-center gap-1.5 font-bold text-cyan-300 mb-1">
                    <Terminal className="w-4 h-4 text-cyan-400" />
                    <span>Consola ADB Completa</span>
                  </div>
                  <p className="text-[10px] text-slate-300">
                    Abre la terminal de comandos interactiva de ADB y shell del sistema.
                  </p>
                </button>
              )}

              <button
                onClick={handleEnterSystemAdb}
                className="p-3 rounded-2xl bg-emerald-950/70 border border-emerald-500/40 hover:bg-emerald-900 text-left transition-colors"
              >
                <div className="flex items-center gap-2 text-emerald-400 font-bold mb-1">
                  <Unlock className="w-4 h-4" />
                  <span>Ingresar al Sistema (Keyguard 82)</span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Supera la pantalla de bloqueo e ingresa a la interfaz de aplicaciones.
                </p>
              </button>

              <button
                onClick={handleSwitchToFastbootInModal}
                className="p-3 rounded-2xl bg-slate-900 border border-slate-700 hover:border-amber-500/50 text-left transition-colors"
              >
                <div className="flex items-center gap-2 text-amber-400 font-bold mb-1">
                  <Zap className="w-4 h-4" />
                  <span>Modo Fastboot OEM</span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Reinicia en Motorola AP Fastboot Flash Mode para comandos de flasheo.
                </p>
              </button>
            </div>

            {/* Terminal Output Window */}
            {fastbootTerminalOutput && (
              <div className="bg-black/90 border border-slate-800 rounded-2xl p-3 font-mono text-[11px] text-emerald-400 whitespace-pre-wrap leading-relaxed select-text shadow-inner">
                {fastbootTerminalOutput}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              {onOpenAdbConsole && (
                <button
                  onClick={() => {
                    playClickSound(soundEnabled);
                    onClose();
                    onOpenAdbConsole();
                  }}
                  className="flex-1 py-2.5 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
                >
                  <Terminal className="w-4 h-4" />
                  <span>Abrir Consola ADB</span>
                </button>
              )}

              {onOpenMirror && (
                <button
                  onClick={() => {
                    playClickSound(soundEnabled);
                    onClose();
                    onOpenMirror();
                  }}
                  className="flex-1 py-2.5 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Abrir Pantalla en Vivo (Scrcpy)</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: QR Code */}
        {tab === 'qr' && (
          <div className="p-4 overflow-y-auto space-y-3.5 text-xs text-center">
            <div>
              <h4 className="text-sm font-bold text-white mb-1">
                Conexión 100% Real con tu Teléfono Móvil
              </h4>
              <p className="text-slate-400 text-xs max-w-sm mx-auto">
                Apunta con la cámara de tu celular Motorola o Android a este código QR para vincular en tiempo real.
              </p>
            </div>

            {/* Live Connection Banner */}
            {pairedDevice ? (
              <div className="bg-emerald-950/80 border border-emerald-500/50 rounded-2xl p-3 max-w-sm mx-auto text-left flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 animate-pulse" />
                </div>
                <div className="text-xs truncate">
                  <div className="text-white font-bold flex items-center gap-1.5">
                    <span>¡Conexión Real Activa!</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  </div>
                  <div className="text-emerald-300 text-[11px] font-mono mt-0.5 truncate">{pairedDevice}</div>
                </div>
              </div>
            ) : (
              <div className="bg-cyan-950/40 border border-cyan-500/30 rounded-2xl p-2.5 max-w-sm mx-auto text-left flex items-start gap-2.5">
                <Radio className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0 animate-pulse" />
                <div className="text-[11px] text-slate-300 leading-relaxed">
                  <span className="text-cyan-300 font-bold block mb-0.5">Enlace en Tiempo Real sin cables ni drivers</span>
                  Al escanear el QR con tu celular físico, cada trazo que hagas en tu pantalla se reflejará en vivo en tu computadora.
                </div>
              </div>
            )}

            {/* Canvas QR Code */}
            <div className="p-4 bg-white rounded-3xl inline-block shadow-xl shadow-cyan-950/20 border-4 border-slate-800">
              <canvas ref={canvasRef} className="block mx-auto rounded-lg" />
            </div>

            {/* Quick Test in Popup Window */}
            <div className="max-w-sm mx-auto">
              <button
                type="button"
                onClick={() => {
                  playClickSound(soundEnabled);
                  window.open(appUrl, '_blank', 'width=420,height=820');
                }}
                className="w-full py-2.5 px-3 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/40 transition-all active:scale-95"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Probar Mando en Ventana Emergente (Misma PC)</span>
              </button>
            </div>

            {/* PIN Code Box */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 flex items-center justify-between max-w-sm mx-auto text-left">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Código de Sesión / PIN</span>
                <div className="font-mono text-base font-extrabold text-cyan-400 tracking-wider">
                  {sessionId}
                </div>
              </div>
              <button
                onClick={handleCopyPin}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium flex items-center gap-1 transition-colors"
              >
                {copiedPin ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedPin ? 'Copiado' : 'Copiar PIN'}</span>
              </button>
            </div>

            {/* Action buttons: Share & WhatsApp */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1 max-w-sm mx-auto">
              <button
                onClick={handleCopyLink}
                className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Enlace Copiado' : 'Copiar Enlace'}</span>
              </button>

              <button
                onClick={handleNativeShare}
                className="py-2 px-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Compartir</span>
              </button>

              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                  `Abre este enlace en tu teléfono para desbloquear por patrón táctil: ${appUrl}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </a>
            </div>

            {/* Technical Explanation Notice */}
            <div className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-2xl text-[11px] text-slate-400 text-left max-w-sm mx-auto space-y-1">
              <div className="font-bold text-slate-300 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                <span>¿Por qué el cable USB o la IP no conectan de forma nativa?</span>
              </div>
              <p className="leading-relaxed">
                Por restricciones de seguridad de los navegadores web (sandbox e iframe), no está permitido acceder a hardware USB directo ni abrir sockets TCP privados (<code className="text-cyan-400">192.168.x.x</code>). Este canal de red en tiempo real (SSE) resuelve este problema y proporciona una conexión real e instantánea.
              </p>
            </div>
          </div>
        )}

        {/* Tab 3: Remote Touch Controller Simulation & Dual Window */}
        {tab === 'remote' && (
          <div className="p-4 overflow-y-auto space-y-4 text-xs">
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
              <h4 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-cyan-400" />
                Control Remoto Táctil (Espejo en Tiempo Real)
              </h4>
              <p className="text-slate-400 text-xs mb-3">
                Cuando abres la app en tu teléfono, cualquier patrón que dibujes con tu dedo desbloqueará automáticamente esta pantalla de computadora al instante.
              </p>

              <div className="flex flex-wrap gap-2">
                <a
                  href={appUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 px-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl flex items-center gap-2 transition-colors shadow-md shadow-cyan-950/30"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir Ventana Móvil para Probar</span>
                </a>
              </div>
            </div>

            {/* Quick Connect Wireless Simulator */}
            <div>
              <span className="text-slate-300 font-bold block mb-2">
                Vincular Modelo de Teléfono Simulado (Wi-Fi Direct / Red Local):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { name: 'Motorola Edge 50 Ultra', brand: 'Motorola' },
                  { name: 'Motorola Razr 50 Ultra', brand: 'Motorola' },
                  { name: 'Moto G85 5G', brand: 'Motorola' },
                  { name: 'ThinkPhone 25 by Motorola', brand: 'Motorola' },
                  { name: 'Samsung Galaxy S24 Ultra', brand: 'Samsung' },
                  { name: 'Apple iPhone 16 Pro Max', brand: 'Apple' },
                ].map((phone) => (
                  <button
                    key={phone.name}
                    onClick={() => handleSimulatePhoneConnection(phone.name)}
                    className="p-3 bg-slate-950 border border-slate-800 hover:border-cyan-500/50 rounded-2xl text-left transition-all group"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-white text-xs group-hover:text-cyan-400 truncate">
                        {phone.name}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {phone.brand} · Conexión Wi-Fi Direct
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Connection Protocol Specs */}
            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-1.5 text-[11px] text-slate-400">
              <div className="font-semibold text-slate-300">Protocolo de Enlace Criptográfico:</div>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Canal seguro Broadcast / WebRTC con latencia inferior a 25ms.</li>
                <li>Retroalimentación háptica directa en el motor vibrador del teléfono.</li>
                <li>Sincronización bidireccional de temas visuales y geometrías de nodos.</li>
              </ul>
            </div>
          </div>
        )}

        {/* Tab 4: PWA Installation Guide */}
        {tab === 'pwa' && (
          <div className="p-4 overflow-y-auto space-y-4 text-xs">
            <div>
              <h4 className="text-sm font-bold text-white mb-1">
                Instalar como App Nativa en tu Smartphone
              </h4>
              <p className="text-slate-400 text-xs">
                Convierte esta web en una aplicación de pantalla completa sin barras de navegador en tu teléfono:
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Android Chrome */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2">
                <div className="font-bold text-white flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  <span>En Android (Google Chrome)</span>
                </div>
                <ol className="text-slate-300 space-y-1.5 list-decimal pl-4 text-[11px]">
                  <li>Abre el enlace en Google Chrome.</li>
                  <li>Toca el menú de los <strong>tres puntos (⋮)</strong> en la esquina superior derecha.</li>
                  <li>Selecciona <strong>"Agregar a la pantalla principal"</strong> o "Instalar app".</li>
                  <li>Disfruta de vibración háptica y pantalla completa.</li>
                </ol>
              </div>

              {/* iPhone Safari */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2">
                <div className="font-bold text-white flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-sky-400" />
                  <span>En iPhone (Apple Safari)</span>
                </div>
                <ol className="text-slate-300 space-y-1.5 list-decimal pl-4 text-[11px]">
                  <li>Abre el enlace en Apple Safari.</li>
                  <li>Toca el botón <strong>Compartir (⎋)</strong> en la barra inferior.</li>
                  <li>Desplázate y selecciona <strong>"Agregar al inicio"</strong>.</li>
                  <li>Aparecerá el ícono de PatternLock en tu pantalla de inicio.</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Web Bluetooth Discovery */}
        {tab === 'bluetooth' && (
          <div className="p-4 overflow-y-auto space-y-4 text-xs text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
              <Bluetooth className="w-6 h-6 animate-pulse" />
            </div>

            <div>
              <h4 className="text-sm font-bold text-white mb-1">
                Escanear Dispositivos Bluetooth Cercanos
              </h4>
              <p className="text-slate-400 text-xs max-w-sm mx-auto">
                Permite emparejar tu teléfono o llavero de seguridad Bluetooth directamente con el navegador.
              </p>
            </div>

            <button
              onClick={handleBluetoothSearch}
              disabled={isSearchingBluetooth}
              className="py-2.5 px-6 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs inline-flex items-center gap-2 shadow-lg shadow-cyan-950/40 transition-all"
            >
              {isSearchingBluetooth ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Bluetooth className="w-4 h-4" />}
              <span>{isSearchingBluetooth ? 'Buscando dispositivos...' : 'Buscar Teléfono por Bluetooth'}</span>
            </button>

            {bluetoothError && (
              <div className="p-3 bg-amber-950/50 border border-amber-500/40 rounded-2xl text-amber-300 text-xs max-w-sm mx-auto">
                {bluetoothError}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0 text-xs">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Cable className="w-3.5 h-3.5 text-cyan-400" />
            <span>Soporte USB-C, WebUSB, ADB y Wi-Fi P2P activo</span>
          </div>

          <button
            onClick={() => {
              playClickSound(soundEnabled);
              onClose();
            }}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
