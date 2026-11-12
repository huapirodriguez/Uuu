import React, { useState, useEffect, useMemo } from 'react';
import {
  Cable,
  Usb,
  Smartphone,
  Cpu,
  Layers,
  ShieldCheck,
  HardDrive,
  BatteryCharging,
  Terminal,
  Download,
  Copy,
  Check,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Lock,
  Unlock,
  Radio,
  FileText,
  SlidersHorizontal,
  Zap,
  ArrowRight,
  Database,
  Activity,
  Boxes,
  Sparkles,
  Edit3,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  FileCode,
  X,
} from 'lucide-react';
import { CustomGridStyle, ThemeConfig } from '../types.ts';
import {
  ConnectedUsbDevice,
  UsbPhoneModel,
  MOTOROLA_PHONE_MODELS,
  ALL_USB_PHONE_PRESETS,
  requestUsbSmartphone,
  isWebUsbSupported,
} from '../utils/usbManager.ts';
import {
  DeviceFullData,
  executeDeviceDataExtraction,
  generateDeviceDataset,
  formatDeviceDataJson,
  formatDeviceDataCsv,
  downloadFile,
} from '../utils/deviceDataManager.ts';
import { playClickSound, playSuccessSound, playLockSound } from '../utils/sound.ts';
import { sendSyncMessage } from '../utils/syncChannel.ts';

interface DeviceDataViewerProps {
  pairedDevice: string | null;
  masterPattern: number[];
  theme: ThemeConfig;
  customStyle: CustomGridStyle;
  soundEnabled: boolean;
  sessionId?: string;
  onPairDevice: (deviceName: string) => void;
  onOpenMirror?: () => void;
  onUnlockSuccess?: () => void;
  onClose?: () => void;
}

export const DeviceDataViewer: React.FC<DeviceDataViewerProps> = ({
  pairedDevice,
  masterPattern,
  theme,
  customStyle,
  soundEnabled,
  sessionId,
  onPairDevice,
  onOpenMirror,
  onUnlockSuccess,
  onClose,
}) => {
  // Device Selection
  const [selectedDeviceName, setSelectedDeviceName] = useState<string>(
    pairedDevice || 'Motorola Edge 50 Ultra'
  );

  // Extraction State
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState(100);
  const [currentStageName, setCurrentStageName] = useState('Lectura Completa');
  const [currentStageDetail, setCurrentStageDetail] = useState(
    'Todos los registros, particiones, paquetes y datos leídos con éxito.'
  );

  // Device Data
  const [deviceData, setDeviceData] = useState<DeviceFullData>(() =>
    generateDeviceDataset(pairedDevice || 'Motorola Edge 50 Ultra', masterPattern)
  );

  // Active Tab
  const [activeTab, setActiveTab] = useState<
    'overview' | 'getprop' | 'storage' | 'security' | 'apps' | 'battery' | 'logcat' | 'export'
  >('overview');

  // Filters & Search
  const [propSearch, setPropSearch] = useState('');
  const [propCategory, setPropCategory] = useState<string>('all');
  const [appSearch, setAppSearch] = useState('');
  const [appCategory, setAppCategory] = useState<string>('all');
  const [logFilter, setLogFilter] = useState<'all' | 'I' | 'W' | 'E'>('all');

  // Copy feedback
  const [hasCopied, setHasCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Property Editing States (getprop / setprop)
  const [editingProp, setEditingProp] = useState<{
    originalKey: string;
    key: string;
    value: string;
    category: 'build' | 'hardware' | 'security' | 'network' | 'display';
    description: string;
  } | null>(null);
  const [isAddPropModalOpen, setIsAddPropModalOpen] = useState(false);
  const [newPropKey, setNewPropKey] = useState('');
  const [newPropValue, setNewPropValue] = useState('');
  const [newPropCategory, setNewPropCategory] = useState<'build' | 'hardware' | 'security' | 'network' | 'display'>('build');
  const [newPropDescription, setNewPropDescription] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 3500);
  };

  // Save modified property (setprop)
  const handleSaveEditedProperty = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingProp) return;
    if (!editingProp.value.trim()) {
      showToast('El valor de la propiedad no puede estar vacío');
      return;
    }

    playSuccessSound(soundEnabled);
    setDeviceData((prev) => ({
      ...prev,
      properties: prev.properties.map((p) => {
        if (p.key === editingProp.originalKey) {
          return {
            ...p,
            key: editingProp.key.trim(),
            value: editingProp.value.trim(),
            category: editingProp.category,
            description: editingProp.description.trim(),
            isModified: true,
          };
        }
        return p;
      }),
    }));

    showToast(`[setprop] Propiedad ${editingProp.key} modificada a "${editingProp.value}"`);
    setEditingProp(null);
  };

  // Add new custom property (setprop)
  const handleAddCustomProperty = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newPropKey.trim() || !newPropValue.trim()) {
      showToast('Clave y valor son requeridos para setprop');
      return;
    }

    playSuccessSound(soundEnabled);
    const key = newPropKey.trim();
    const value = newPropValue.trim();

    setDeviceData((prev) => {
      const existing = prev.properties.find((p) => p.key === key);
      if (existing) {
        return {
          ...prev,
          properties: prev.properties.map((p) =>
            p.key === key
              ? {
                  ...p,
                  value,
                  category: newPropCategory,
                  description: newPropDescription.trim() || 'Propiedad modificada por el usuario',
                  isModified: true,
                }
              : p
          ),
        };
      }
      return {
        ...prev,
        properties: [
          {
            key,
            value,
            category: newPropCategory,
            description: newPropDescription.trim() || 'Propiedad personalizada añadida mediante setprop',
            isModified: true,
          },
          ...prev.properties,
        ],
      };
    });

    showToast(`[setprop] Propiedad ${key} registrada con éxito`);
    setNewPropKey('');
    setNewPropValue('');
    setNewPropDescription('');
    setIsAddPropModalOpen(false);
  };

  // Quick preset: Activar Depuración USB Booteable
  const handleApplyBootableDebugPreset = () => {
    playSuccessSound(soundEnabled);
    const updates: Record<string, string> = {
      'ro.boot.usbconfig': 'adb,fastboot',
      'persist.service.adb.enable': '1',
      'persist.sys.usb.config': 'adb',
      'ro.debuggable': '1',
      'sys.usb.state': 'adb',
      'ro.boot.flash.locked': '0',
    };

    setDeviceData((prev) => ({
      ...prev,
      properties: prev.properties.map((p) => {
        if (updates[p.key] !== undefined) {
          return {
            ...p,
            value: updates[p.key],
            isModified: true,
          };
        }
        return p;
      }),
    }));

    showToast('⚡ Depuración USB Booteable activada en todas las propiedades del sistema (getprop/setprop)');
  };

  // Quick preset: Device Spoofing
  const handleApplyDeviceSpoof = (newModel: string, newBrand: string) => {
    playSuccessSound(soundEnabled);
    setDeviceData((prev) => ({
      ...prev,
      properties: prev.properties.map((p) => {
        if (p.key === 'ro.product.model') return { ...p, value: newModel, isModified: true };
        if (p.key === 'ro.product.manufacturer') return { ...p, value: newBrand, isModified: true };
        if (p.key === 'ro.product.brand') return { ...p, value: newBrand.toLowerCase(), isModified: true };
        return p;
      }),
    }));
    showToast(`Identidad de hardware modificada a: ${newModel}`);
  };

  // Reset properties to factory defaults
  const handleResetPropertiesToDefault = () => {
    playClickSound(soundEnabled);
    const fresh = generateDeviceDataset(selectedDeviceName, masterPattern);
    setDeviceData((prev) => ({
      ...prev,
      properties: fresh.properties,
    }));
    showToast('Propiedades restauradas a los valores originales de fábrica (getprop)');
  };

  // Export build.prop
  const handleDownloadBuildProp = () => {
    playClickSound(soundEnabled);
    const lines = [
      '# Android System Properties Registry (getprop dump)',
      `# Device: ${deviceData.brand} ${deviceData.model} (${deviceData.deviceName})`,
      `# Generated: ${new Date().toISOString()}`,
      '# -------------------------------------------------------------',
      '',
      ...deviceData.properties.map((p) => `${p.key}=${p.value}`),
    ];
    downloadFile(lines.join('\n'), 'build.prop', 'text/plain');
    showToast('Archivo build.prop descargado con éxito.');
  };

  // Perform full data extraction on demand
  const handleStartExtraction = async (targetDevice = selectedDeviceName) => {
    playClickSound(soundEnabled);
    setIsExtracting(true);
    setExtractionProgress(5);
    setCurrentStageName('Iniciando Handshake USB...');
    setCurrentStageDetail('Verificando canal de comunicación con el dispositivo...');

    try {
      const result = await executeDeviceDataExtraction(
        targetDevice,
        masterPattern,
        (step) => {
          setExtractionProgress(step.progress);
          setCurrentStageName(step.stageName);
          setCurrentStageDetail(step.detail);
        }
      );
      setDeviceData(result);
      onPairDevice(result.deviceName);
      playSuccessSound(soundEnabled);
      showToast(`¡Lectura de todos los datos completada con éxito para ${result.deviceName}!`);

      sendSyncMessage({
        type: 'DEVICE_CONNECTED',
        sessionId: sessionId || (typeof window !== 'undefined' ? localStorage.getItem('patternlock_session_id') || 'PAIR-7720' : 'PAIR-7720'),
        deviceInfo: `${result.deviceName} (Datos Extraídos 100%)`,
      });
    } catch (err: any) {
      showToast('Error durante la lectura de datos');
    } finally {
      setIsExtracting(false);
    }
  };

  // Connect via real WebUSB
  const handleConnectRealWebUsb = async () => {
    playClickSound(soundEnabled);
    if (!isWebUsbSupported()) {
      showToast('WebUSB no soportado en este navegador. Usa Google Chrome o Edge.');
      return;
    }
    try {
      const usbDev = await requestUsbSmartphone();
      setSelectedDeviceName(usbDev.productName);
      onPairDevice(usbDev.productName);
      await handleStartExtraction(usbDev.productName);
    } catch (err: any) {
      if (err?.code === 'PERMISSIONS_POLICY_IFRAME_BLOCKED') {
        showToast('Navegador bloquea USB en marco embebido. Abre en pestaña nueva o usa presets.');
      } else {
        showToast(err.message || 'No se pudo vincular por WebUSB');
      }
    }
  };

  // Copy JSON to clipboard
  const handleCopyDump = () => {
    playClickSound(soundEnabled);
    const jsonStr = formatDeviceDataJson(deviceData);
    navigator.clipboard.writeText(jsonStr).then(() => {
      setHasCopied(true);
      showToast('¡Volcado completo copiado al portapapeles!');
      setTimeout(() => setHasCopied(false), 2500);
    });
  };

  // Download JSON
  const handleDownloadJson = () => {
    playClickSound(soundEnabled);
    const jsonStr = formatDeviceDataJson(deviceData);
    const fileName = `${deviceData.brand.toLowerCase()}_${deviceData.model
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')}_full_dump.json`;
    downloadFile(jsonStr, fileName, 'application/json');
    showToast(`Archivo ${fileName} descargado con éxito.`);
  };

  // Download CSV
  const handleDownloadCsv = () => {
    playClickSound(soundEnabled);
    const csvStr = formatDeviceDataCsv(deviceData);
    const fileName = `${deviceData.brand.toLowerCase()}_${deviceData.model
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')}_telemetry.csv`;
    downloadFile(csvStr, fileName, 'text/csv');
    showToast(`Archivo CSV ${fileName} descargado.`);
  };

  // Filtered properties
  const filteredProps = useMemo(() => {
    return deviceData.properties.filter((p) => {
      const matchesCat = propCategory === 'all' || p.category === propCategory;
      const matchesSearch =
        !propSearch ||
        p.key.toLowerCase().includes(propSearch.toLowerCase()) ||
        p.value.toLowerCase().includes(propSearch.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(propSearch.toLowerCase()));
      return matchesCat && matchesSearch;
    });
  }, [deviceData.properties, propCategory, propSearch]);

  // Filtered apps
  const filteredApps = useMemo(() => {
    return deviceData.apps.filter((a) => {
      const matchesCat = appCategory === 'all' || a.category === appCategory;
      const matchesSearch =
        !appSearch ||
        a.appName.toLowerCase().includes(appSearch.toLowerCase()) ||
        a.packageName.toLowerCase().includes(appSearch.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [deviceData.apps, appCategory, appSearch]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return deviceData.systemLogs.filter((l) => {
      if (logFilter === 'all') return true;
      return l.level === logFilter;
    });
  }, [deviceData.systemLogs, logFilter]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 animate-fade-in">
      {/* Toast banner */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border border-cyan-500/60 shadow-2xl shadow-cyan-950/60 rounded-2xl px-5 py-2.5 flex items-center gap-2 text-xs font-bold text-white animate-bounce">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Hero Header & Device Connect Action */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-cyan-950/40 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          {/* Title & Status */}
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/40 shadow-lg shadow-cyan-950/40 shrink-0">
              <Database className="w-7 h-7" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Lector Completo de Datos del Dispositivo
                </h2>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/60 flex items-center gap-1.5 font-mono">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  CONECTADO · DUMP 100%
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/60">
                  {deviceData.usbSpeedMbps} Mbps
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
                Extracción forense y telemetría de hardware, propiedades de sistema <code className="text-cyan-300 bg-slate-900 px-1 py-0.5 rounded">getprop</code>, particiones de almacenamiento, base de datos de pantalla de bloqueo <code className="text-cyan-300 bg-slate-900 px-1 py-0.5 rounded">locksettings.db</code>, lista de paquetes y registros en tiempo real.
              </p>
            </div>
          </div>

          {/* Quick Actions Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Model Selector Dropdown */}
            <select
              value={selectedDeviceName}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedDeviceName(val);
                handleStartExtraction(val);
              }}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-semibold focus:outline-none focus:border-cyan-500 shadow-sm"
            >
              <optgroup label="Modelos Motorola (Recomendados)">
                {MOTOROLA_PHONE_MODELS.map((m) => (
                  <option key={m.id} value={m.model}>
                    {m.model} ({m.series})
                  </option>
                ))}
              </optgroup>
              <optgroup label="Otras Marcas Populares">
                {ALL_USB_PHONE_PRESETS.filter((p) => p.brand !== 'Motorola').map((m) => (
                  <option key={m.id} value={m.model}>
                    {m.model} ({m.brand})
                  </option>
                ))}
              </optgroup>
            </select>

            {/* Main Action Button: Connect & Read All Data */}
            <button
              onClick={() => handleStartExtraction(selectedDeviceName)}
              disabled={isExtracting}
              className="px-4 py-2 bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 disabled:opacity-50 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-cyan-950/40 transition-all active:scale-95"
            >
              <RefreshCw className={`w-4 h-4 ${isExtracting ? 'animate-spin' : ''}`} />
              <span>{isExtracting ? 'Leyendo Todos los Datos...' : 'Conectar y Leer Todos los Datos'}</span>
            </button>

            {/* Real WebUSB Detect Button */}
            <button
              onClick={handleConnectRealWebUsb}
              disabled={isExtracting}
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Solicitar conexión con teléfono físico por cable USB WebUSB"
            >
              <Cable className="w-3.5 h-3.5 text-cyan-400" />
              <span>Escanear USB Físico</span>
            </button>

            {onOpenMirror && (
              <button
                onClick={onOpenMirror}
                className="px-3 py-2 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-600/60 text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                title="Abrir pantalla en vivo del teléfono con control táctil"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Ver Pantalla USB</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Extraction Progress Indicator */}
        {isExtracting ? (
          <div className="mt-5 p-4 bg-slate-950/90 border border-cyan-500/40 rounded-2xl space-y-2.5 animate-pulse">
            <div className="flex items-center justify-between text-xs font-bold text-white">
              <span className="flex items-center gap-2 text-cyan-400">
                <Activity className="w-4 h-4 animate-spin" />
                <span>{currentStageName}</span>
              </span>
              <span className="font-mono text-cyan-400">{extractionProgress}%</span>
            </div>
            {/* Progress Track */}
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 rounded-full transition-all duration-300"
                style={{ width: `${extractionProgress}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400 font-mono">{currentStageDetail}</p>
          </div>
        ) : (
          /* Active Extracted Summary Bar */
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 text-xs font-mono">
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5">
              <span className="text-[10px] text-slate-400 uppercase font-sans block">Dispositivo</span>
              <span className="font-bold text-white text-xs truncate block">{deviceData.deviceName}</span>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5">
              <span className="text-[10px] text-slate-400 uppercase font-sans block">Sistema Operativo</span>
              <span className="font-bold text-cyan-400 text-xs block">{deviceData.androidVersion.split(' ')[0]} {deviceData.androidVersion.split(' ')[1]}</span>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5">
              <span className="text-[10px] text-slate-400 uppercase font-sans block">Procesador SoC</span>
              <span className="font-bold text-emerald-400 text-xs truncate block">{deviceData.socProcessor.split(' ')[1] || 'Snapdragon'}</span>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5">
              <span className="text-[10px] text-slate-400 uppercase font-sans block">RAM / UFS</span>
              <span className="font-bold text-white text-xs block">{deviceData.ramGb}GB / {deviceData.storageTotalGb}GB</span>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5">
              <span className="text-[10px] text-slate-400 uppercase font-sans block">Pantalla Bloqueo</span>
              <span className="font-bold text-cyan-300 text-xs truncate block">Patrón {deviceData.lockscreenPatternSequence.length} Nodos</span>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5">
              <span className="text-[10px] text-slate-400 uppercase font-sans block">Batería</span>
              <span className="font-bold text-emerald-400 text-xs block">{deviceData.battery.percentage}% TurboPower</span>
            </div>
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto p-1.5 bg-slate-900 border border-slate-800 rounded-2xl text-xs">
        {[
          { id: 'overview', label: 'Resumen Ejecutivo', icon: Smartphone, count: null },
          { id: 'getprop', label: 'Propiedades getprop', icon: Terminal, count: deviceData.properties.length },
          { id: 'storage', label: 'Particiones & Disco', icon: HardDrive, count: deviceData.partitions.length },
          { id: 'security', label: 'Seguridad & Patrón', icon: ShieldCheck, count: null },
          { id: 'apps', label: 'Apps Instaladas', icon: Boxes, count: deviceData.apps.length },
          { id: 'battery', label: 'Batería & Sensores', icon: BatteryCharging, count: null },
          { id: 'logcat', label: 'Registros Logcat', icon: FileText, count: deviceData.systemLogs.length },
          { id: 'export', label: 'Exportar Volcado', icon: Download, count: null },
        ].map((tabItem) => {
          const Icon = tabItem.icon;
          const isActive = activeTab === tabItem.id;
          return (
            <button
              key={tabItem.id}
              onClick={() => {
                playClickSound(soundEnabled);
                setActiveTab(tabItem.id as any);
              }}
              className={`py-2 px-3.5 font-bold rounded-xl whitespace-nowrap transition-all flex items-center gap-2 ${
                isActive
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-950/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tabItem.label}</span>
              {tabItem.count !== null && (
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    isActive ? 'bg-slate-950/20 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {tabItem.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT 1: OVERVIEW DASHBOARD */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* 3-Column Highlights Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Identity & Hardware Card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
              <div className="flex items-center gap-2.5 text-white font-bold text-sm border-b border-slate-800 pb-2.5">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <span>Identidad de Hardware</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Modelo:</span>
                  <span className="font-bold text-white">{deviceData.deviceName}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Fabricante:</span>
                  <span className="text-slate-200">{deviceData.brand}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Procesador SoC:</span>
                  <span className="text-emerald-400 font-mono text-[11px] truncate max-w-[200px]" title={deviceData.socProcessor}>
                    {deviceData.socProcessor}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">GPU Aceleradora:</span>
                  <span className="text-slate-300 font-mono text-[11px]">{deviceData.gpuRenderer}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Memoria RAM:</span>
                  <span className="text-white font-bold">{deviceData.ramGb} GB LPDDR5X</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-400">Número de Serie:</span>
                  <span className="text-cyan-400 font-mono text-[11px]">{deviceData.serialNumber}</span>
                </div>
              </div>
            </div>

            {/* Operating System & Firmware Card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
              <div className="flex items-center gap-2.5 text-white font-bold text-sm border-b border-slate-800 pb-2.5">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span>Firmware & Android OS</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Versión Android:</span>
                  <span className="font-bold text-white">{deviceData.androidVersion}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Compilación Build:</span>
                  <span className="text-slate-300 font-mono text-[11px] truncate max-w-[190px]" title={deviceData.buildNumber}>
                    {deviceData.buildNumber}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Parche de Seguridad:</span>
                  <span className="text-emerald-400 font-semibold">{deviceData.securityPatch}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Kernel Linux:</span>
                  <span className="text-slate-300 font-mono text-[11px] truncate max-w-[190px]" title={deviceData.kernelVersion}>
                    {deviceData.kernelVersion}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">SELinux Mode:</span>
                  <span className="text-emerald-400 font-bold">{deviceData.selinuxStatus}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-400">ThinkShield Security:</span>
                  <span className="text-cyan-400 font-bold">{deviceData.thinkShieldVersion}</span>
                </div>
              </div>
            </div>

            {/* Lockscreen & Security Audit Card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
              <div className="flex items-center gap-2.5 text-white font-bold text-sm border-b border-slate-800 pb-2.5">
                <Lock className="w-4 h-4 text-cyan-400" />
                <span>Auditoría de Pantalla de Bloqueo</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Tipo de Bloqueo:</span>
                  <span className="font-bold text-white">{deviceData.lockscreenType}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Secuencia Patrón:</span>
                  <span className="text-cyan-400 font-mono font-bold">
                    [ {deviceData.lockscreenPatternSequence.join(' ➔ ')} ]
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Gatekeeper HMAC Hash:</span>
                  <span className="text-slate-300 font-mono text-[10px] truncate max-w-[180px]" title={deviceData.lockscreenPatternHash}>
                    {deviceData.lockscreenPatternHash}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Almacén de Clave:</span>
                  <span className="text-emerald-400 font-mono text-[11px]">/data/system/locksettings.db</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Biometría Registrada:</span>
                  <span className="text-slate-300 truncate max-w-[180px]">{deviceData.biometricType}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-400">Estado de Bloqueo:</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Protección Activa
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Access Forensic Bar */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Volcado Forense Completo del Dispositivo</h4>
                <p className="text-[11px] text-slate-400">
                  Exporta todos los datos leídos en JSON o CSV para auditoría, análisis de seguridad y respaldo.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyDump}
                className="py-1.5 px-3 bg-slate-900 hover:bg-slate-850 border border-slate-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                {hasCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-cyan-400" />}
                <span>{hasCopied ? 'Copiado' : 'Copiar JSON'}</span>
              </button>
              <button
                onClick={handleDownloadJson}
                className="py-1.5 px-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar Volcado JSON</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: SYSTEM PROPERTIES GETPROP & SETPROP EDITOR */}
      {activeTab === 'getprop' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
          {/* Header & Main Controls */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  <span>Registro de Propiedades del Sistema (getprop / setprop)</span>
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 font-semibold">
                  EDICIÓN HABILITADA
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {filteredProps.length} de {deviceData.properties.length} propiedades leídas. Haz clic en "Editar" en cualquier propiedad o añade nuevas directivas mediante setprop.
              </p>
            </div>

            {/* Top Action Presets Bar */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleApplyBootableDebugPreset}
                className="py-1.5 px-3 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                title="Configura ro.boot.usbconfig=adb,fastboot y persist.service.adb.enable=1"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Activar USB Booteable</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  playClickSound(soundEnabled);
                  setIsAddPropModalOpen(true);
                }}
                className="py-1.5 px-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>Añadir Propiedad (setprop)</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadBuildProp}
                className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="Descargar archivo build.prop con todas las modificaciones"
              >
                <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                <span>Descargar build.prop</span>
              </button>

              <button
                type="button"
                onClick={handleResetPropertiesToDefault}
                className="py-1.5 px-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors"
                title="Restaurar a los valores originales de fábrica"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restaurar Fábrica</span>
              </button>
            </div>
          </div>

          {/* Filter Bar: Category & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80">
            <div className="flex items-center gap-1.5 flex-wrap text-xs">
              <span className="text-[11px] font-semibold text-slate-400 mr-1">Categoría:</span>
              {['all', 'build', 'hardware', 'security', 'network', 'display'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    playClickSound(soundEnabled);
                    setPropCategory(cat);
                  }}
                  className={`px-2.5 py-1 rounded-xl font-medium capitalize transition-all ${
                    propCategory === cat
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {cat === 'all' ? 'Todas' : cat}
                </button>
              ))}
            </div>

            {/* Search box */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={propSearch}
                onChange={(e) => setPropSearch(e.target.value)}
                placeholder="Filtrar por clave o valor (ej: debug, usbconfig, model)..."
                className="bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none w-full sm:w-64 transition-colors font-mono"
              />
            </div>
          </div>

          {/* Properties Table with Edit Action */}
          <div className="overflow-x-auto max-h-[520px] overflow-y-auto pr-1 border border-slate-800 rounded-2xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-950/90 sticky top-0 z-10 backdrop-blur-sm">
                  <th className="py-2.5 px-3">Clave de Propiedad</th>
                  <th className="py-2.5 px-3">Valor de Sistema</th>
                  <th className="py-2.5 px-3">Categoría</th>
                  <th className="py-2.5 px-3">Descripción Técnica</th>
                  <th className="py-2.5 px-3 text-right">Modificar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filteredProps.map((p, idx) => (
                  <tr
                    key={idx}
                    className={`transition-colors group ${
                      p.isModified ? 'bg-emerald-950/20 hover:bg-emerald-950/30' : 'hover:bg-slate-800/40'
                    }`}
                  >
                    <td className="py-2.5 px-3 text-cyan-300 font-semibold select-all">
                      <div className="flex items-center gap-1.5">
                        <span>{p.key}</span>
                        {p.isModified && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/50 font-sans font-bold">
                            MODIFICADO
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 select-all">
                      <span className={`font-bold ${p.isModified ? 'text-emerald-300' : 'text-white'}`}>
                        {p.value}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-sans">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-950 text-slate-400 border border-slate-800 capitalize font-medium">
                        {p.category}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 font-sans text-[11px] max-w-xs truncate">
                      {p.description || 'Propiedad de configuración del entorno'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-sans">
                      <button
                        type="button"
                        onClick={() => {
                          playClickSound(soundEnabled);
                          setEditingProp({
                            originalKey: p.key,
                            key: p.key,
                            value: p.value,
                            category: p.category,
                            description: p.description || '',
                          });
                        }}
                        className="py-1 px-2.5 rounded-lg bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-200 border border-slate-700 transition-all font-semibold text-[11px] inline-flex items-center gap-1 active:scale-95"
                        title={`Editar y modificar valor de ${p.key}`}
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Editar</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Modal: Editar y Modificar Propiedad (setprop) */}
          {editingProp && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
              <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/40">
                      <Edit3 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Editar Propiedad del Sistema</h4>
                      <p className="text-[11px] text-slate-400 font-mono">adb shell setprop</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingProp(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleSaveEditedProperty} className="space-y-3.5 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Clave de la Propiedad (Key)
                    </label>
                    <input
                      type="text"
                      value={editingProp.key}
                      onChange={(e) => setEditingProp({ ...editingProp, key: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Valor del Sistema (Value)
                    </label>
                    <input
                      type="text"
                      value={editingProp.value}
                      onChange={(e) => setEditingProp({ ...editingProp, value: e.target.value })}
                      autoFocus
                      className="w-full bg-slate-950 border border-cyan-500/80 rounded-xl px-3 py-2 text-cyan-300 font-mono text-xs font-bold focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>

                  {/* Quick value suggestions chips */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="text-[10px] text-slate-400">Valores comunes:</span>
                    {['1', '0', 'adb,fastboot', 'mtp,adb', 'orange', 'green', 'true', 'false'].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => {
                          playClickSound(soundEnabled);
                          setEditingProp({ ...editingProp, value: val });
                        }}
                        className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 font-mono"
                      >
                        {val}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">Categoría</label>
                      <select
                        value={editingProp.category}
                        onChange={(e) => setEditingProp({ ...editingProp, category: e.target.value as any })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500 capitalize"
                      >
                        <option value="build">Build</option>
                        <option value="hardware">Hardware</option>
                        <option value="security">Seguridad</option>
                        <option value="network">Red</option>
                        <option value="display">Pantalla</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">Descripción</label>
                      <input
                        type="text"
                        value={editingProp.description}
                        onChange={(e) => setEditingProp({ ...editingProp, description: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-300 text-xs focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setEditingProp(null)}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                    >
                      Cancelar
                    </button>

                    <button
                      type="submit"
                      className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Guardar y Aplicar (setprop)</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal: Añadir Nueva Propiedad (setprop) */}
          {isAddPropModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
              <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/40">
                      <Plus className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Añadir Nueva Propiedad al Sistema</h4>
                      <p className="text-[11px] text-slate-400 font-mono">setprop &lt;key&gt; &lt;value&gt;</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddPropModalOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleAddCustomProperty} className="space-y-3.5 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Clave de la Propiedad (ej: ro.custom.security, persist.sys.debug)
                    </label>
                    <input
                      type="text"
                      value={newPropKey}
                      onChange={(e) => setNewPropKey(e.target.value)}
                      placeholder="ro.custom.feature..."
                      autoFocus
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Valor Asignado
                    </label>
                    <input
                      type="text"
                      value={newPropValue}
                      onChange={(e) => setNewPropValue(e.target.value)}
                      placeholder="1, true, adb..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-cyan-300 font-mono text-xs focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">Categoría</label>
                      <select
                        value={newPropCategory}
                        onChange={(e) => setNewPropCategory(e.target.value as any)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500 capitalize"
                      >
                        <option value="build">Build</option>
                        <option value="hardware">Hardware</option>
                        <option value="security">Seguridad</option>
                        <option value="network">Red</option>
                        <option value="display">Pantalla</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">Descripción</label>
                      <input
                        type="text"
                        value={newPropDescription}
                        onChange={(e) => setNewPropDescription(e.target.value)}
                        placeholder="Propósito técnico..."
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-300 text-xs focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setIsAddPropModalOpen(false)}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                    >
                      Cancelar
                    </button>

                    <button
                      type="submit"
                      className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Registrar Propiedad</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 3: STORAGE & PARTITIONS */}
      {activeTab === 'storage' && (
        <div className="space-y-4">
          {/* Storage Capacity Visual Bar */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-emerald-400" />
                  <span>Capacidad de Almacenamiento UFS / eMMC</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  {deviceData.storageUsedGb} GB usados de {deviceData.storageTotalGb} GB en memoria ultrarrápida UFS 4.0
                </p>
              </div>
              <div className="text-right">
                <span className="text-base font-extrabold text-white font-mono">
                  {deviceData.storageTotalGb - deviceData.storageUsedGb} GB Disponibles
                </span>
                <span className="text-[11px] text-emerald-400 block font-semibold">
                  {Math.round(((deviceData.storageTotalGb - deviceData.storageUsedGb) / deviceData.storageTotalGb) * 100)}% Libre
                </span>
              </div>
            </div>

            {/* Visual Storage Bar */}
            <div className="w-full h-4 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800 flex">
              <div style={{ width: '12%' }} className="h-full bg-cyan-500 rounded-l-full" title="Sistema Android (12%)" />
              <div style={{ width: '8%' }} className="h-full bg-teal-400" title="Motorola Hello UI (8%)" />
              <div style={{ width: '14%' }} className="h-full bg-amber-400" title="Aplicaciones de Usuario (14%)" />
              <div style={{ width: '6%' }} className="h-full bg-indigo-500" title="Bóveda Cifrada (6%)" />
              <div style={{ width: '60%' }} className="h-full bg-slate-800 rounded-r-full" title="Espacio Libre (60%)" />
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-300 pt-1 font-medium">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-cyan-500" /> Sistema Android OS</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-teal-400" /> Hello UI & Drivers</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Apps de Usuario</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> Bóveda Cifrada</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-700" /> Espacio Libre</span>
            </div>
          </div>

          {/* Partition Mount Table */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider text-slate-400">
              Tabla de Particiones de Bloques Montadas (df -h / mount)
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-950/70">
                    <th className="py-2 px-3">Punto de Montaje</th>
                    <th className="py-2 px-3">Dispositivo de Bloque</th>
                    <th className="py-2 px-3">Tamaño Total</th>
                    <th className="py-2 px-3">Espacio Usado</th>
                    <th className="py-2 px-3">Espacio Libre</th>
                    <th className="py-2 px-3">Sistema de Archivos</th>
                    <th className="py-2 px-3">Función</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {deviceData.partitions.map((part, idx) => (
                    <tr key={idx} className="hover:bg-slate-850/50">
                      <td className="py-2 px-3 text-cyan-300 font-bold">{part.mountPoint}</td>
                      <td className="py-2 px-3 text-slate-400 text-[11px] truncate max-w-[180px]">{part.filesystem}</td>
                      <td className="py-2 px-3 text-white font-bold">{part.sizeGb} GB</td>
                      <td className="py-2 px-3 text-amber-300">{part.usedGb} GB</td>
                      <td className="py-2 px-3 text-emerald-400">{part.freeGb} GB</td>
                      <td className="py-2 px-3 text-slate-300">{part.type}</td>
                      <td className="py-2 px-3 font-sans text-slate-400 text-[11px]">{part.label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 4: SECURITY & LOCKSCREEN AUDIT */}
      {activeTab === 'security' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Gatekeeper & Pattern Analysis */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
              <div className="flex items-center gap-2.5 text-white font-bold text-sm border-b border-slate-800 pb-3">
                <Lock className="w-4 h-4 text-cyan-400" />
                <span>Base de Datos de Credenciales (locksettings.db)</span>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2.5 font-mono text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-sans">Mecanismo Activo</span>
                  <span className="text-cyan-400 font-bold text-sm">{deviceData.lockscreenType}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-sans">Secuencia del Patrón Maestro</span>
                  <span className="text-white text-sm font-bold tracking-wider">
                    {deviceData.lockscreenPatternSequence.join(' ➔ ')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-sans">Gatekeeper HMAC-SHA-512 Hash</span>
                  <span className="text-emerald-400 text-[11px] break-all">
                    {deviceData.lockscreenPatternHash}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-sans">Ubicación del Archivo en Disco</span>
                  <span className="text-slate-300 text-[11px]">/data/system_de/0/gatekeeper.pattern.key</span>
                </div>
              </div>

              <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  El hash criptográfico coincide exactamente con el patrón maestro configurado. Claves seguras.
                </span>
              </div>
            </div>

            {/* Hardware Security & Boot State */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
              <div className="flex items-center gap-2.5 text-white font-bold text-sm border-b border-slate-800 pb-3">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>ThinkShield & Android Verified Boot (AVB)</span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-400">Estado del Bootloader:</span>
                  <span className="font-bold text-emerald-400 font-mono uppercase bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                    {deviceData.bootloaderStatus}
                  </span>
                </div>
                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-400">Android Verified Boot (AVB 2.0):</span>
                  <span className="font-bold text-emerald-400 font-mono uppercase flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    Verified State GREEN
                  </span>
                </div>
                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-400">SELinux Enforcing:</span>
                  <span className="font-bold text-white font-mono">{deviceData.selinuxStatus}</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-400">ThinkShield Hardware Vault:</span>
                  <span className="font-bold text-cyan-400">{deviceData.thinkShieldVersion}</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-400">Cifrado de Disco (FBE v2):</span>
                  <span className="font-bold text-emerald-400">AES-256-XTS Hardware-Bound</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 5: INSTALLED PACKAGES */}
      {activeTab === 'apps' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
          {/* Header & App Category Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Boxes className="w-4 h-4 text-cyan-400" />
                <span>Aplicaciones y Paquetes de Sistema (pm list packages -f)</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {filteredApps.length} de {deviceData.apps.length} paquetes instalados detectados
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                {['all', 'motorola', 'google', 'system', 'user'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setAppCategory(cat)}
                    className={`px-2.5 py-1 rounded-lg font-medium capitalize transition-colors ${
                      appCategory === cat
                        ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {cat === 'all' ? 'Todas' : cat}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={appSearch}
                  onChange={(e) => setAppSearch(e.target.value)}
                  placeholder="Buscar paquete o app..."
                  className="bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none w-52 transition-colors font-mono"
                />
              </div>
            </div>
          </div>

          {/* Apps Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto pr-1">
            {filteredApps.map((app, idx) => (
              <div
                key={idx}
                className="bg-slate-950/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-3.5 space-y-2 transition-all shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-bold text-white text-xs truncate">{app.appName}</div>
                  <span
                    className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full uppercase ${
                      app.category === 'motorola'
                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/60'
                        : app.category === 'google'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                        : app.category === 'user'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800/60'
                        : 'bg-slate-900 text-slate-400 border border-slate-800'
                    }`}
                  >
                    {app.category}
                  </span>
                </div>
                <div className="text-[10px] font-mono text-slate-400 truncate" title={app.packageName}>
                  {app.packageName}
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1.5 border-t border-slate-800/60 font-mono">
                  <span>v{app.version}</span>
                  <span>{app.sizeMb} MB</span>
                  <span className="text-cyan-400 font-sans">{app.permissionsCount} Permisos</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT 6: BATTERY & SENSORS TELEMETRY */}
      {activeTab === 'battery' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Battery Telemetry Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
            <div className="flex items-center gap-2.5 text-white font-bold text-sm border-b border-slate-800 pb-3">
              <BatteryCharging className="w-4 h-4 text-emerald-400" />
              <span>Telemetría de Energía & TurboPower</span>
            </div>

            <div className="flex items-center gap-4 bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <div className="text-4xl font-extrabold text-emerald-400 font-mono">
                {deviceData.battery.percentage}%
              </div>
              <div>
                <span className="text-xs font-bold text-white block">
                  Carga Rápida TurboPower {deviceData.battery.chargingSpeedWatts}W Activa
                </span>
                <span className="text-[11px] text-slate-400">
                  {deviceData.battery.capacityMah} mAh · Química {deviceData.battery.tech}
                </span>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Condición de Salud:</span>
                <span className="text-emerald-400 font-bold">{deviceData.battery.health}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Temperatura Térmica:</span>
                <span className="text-white font-mono">{deviceData.battery.temperatureC} °C (Óptima)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Voltaje de Celdas:</span>
                <span className="text-white font-mono">{deviceData.battery.voltageV} V</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Ciclos de Carga Registrados:</span>
                <span className="text-cyan-400 font-bold font-mono">{deviceData.battery.chargeCycles} ciclos</span>
              </div>
            </div>
          </div>

          {/* Sensors & Real-time Hardware Bus Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
            <div className="flex items-center gap-2.5 text-white font-bold text-sm border-b border-slate-800 pb-3">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>Sensores de Hardware en Vivo</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-sans">Acelerómetro 3D</span>
                <div className="font-mono text-emerald-400 font-bold">X: 0.02 | Y: 9.81 | Z: 0.14</div>
                <div className="text-[10px] text-slate-500">Bosch BMI323 6-Ejes</div>
              </div>

              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-sans">Giroscopio</span>
                <div className="font-mono text-cyan-400 font-bold">ω: 0.001 rad/s</div>
                <div className="text-[10px] text-slate-500">Estabilización OIS Cámara</div>
              </div>

              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-sans">Sensor de Proximidad</span>
                <div className="font-mono text-white font-bold">5.0 cm (Lejos)</div>
                <div className="text-[10px] text-slate-500">Infrarrojo frontal</div>
              </div>

              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-sans">Barómetro</span>
                <div className="font-mono text-amber-300 font-bold">1013.25 hPa</div>
                <div className="text-[10px] text-slate-500">Presión Atmosférica</div>
              </div>
            </div>

            <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex justify-between items-center text-xs">
              <span className="text-slate-400">Sensor Táctil Digitizer:</span>
              <span className="text-cyan-400 font-mono font-bold">360Hz Touch Sampling Rate</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 7: LOGCAT REAL-TIME SYSTEM LOGS */}
      {activeTab === 'logcat' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                <span>Búfer de Eventos del Sistema (logcat -d -v time)</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Eventos del kernel, daemon USB, inyecciones de desbloqueo y auditoría de seguridad
              </p>
            </div>

            <div className="flex items-center gap-1.5 text-xs bg-slate-950 p-1 rounded-xl border border-slate-800">
              {['all', 'I', 'W', 'E'].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setLogFilter(lvl as any)}
                  className={`px-2.5 py-1 rounded-lg font-mono font-bold transition-colors ${
                    logFilter === lvl
                      ? 'bg-cyan-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {lvl === 'all' ? 'Todos' : lvl === 'I' ? 'INFO' : lvl === 'W' ? 'WARN' : 'ERROR'}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-black/95 rounded-2xl p-4 border border-slate-800 font-mono text-[11px] space-y-1.5 h-80 overflow-y-auto select-text">
            {filteredLogs.map((log, i) => (
              <div key={i} className="leading-relaxed flex items-start gap-2">
                <span className="text-slate-600 shrink-0 text-[10px]">{log.timestamp}</span>
                <span
                  className={`font-bold px-1 rounded text-[9px] shrink-0 ${
                    log.level === 'I'
                      ? 'bg-cyan-950 text-cyan-300'
                      : log.level === 'W'
                      ? 'bg-amber-950 text-amber-300'
                      : 'bg-rose-950 text-rose-300'
                  }`}
                >
                  {log.level}
                </span>
                <span className="text-emerald-400 shrink-0 font-semibold">{log.tag}:</span>
                <span className="text-slate-300">{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT 8: EXPORT & FORENSIC DUMP */}
      {activeTab === 'export' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Download className="w-5 h-5 text-cyan-400" />
              <span>Exportar Informe Forense y Volcado Completo</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Guarda en tu almacenamiento local una copia completa con firma de tiempo de todos los datos leídos del dispositivo ({deviceData.deviceName}).
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold font-mono text-sm mb-2">
                  JSON
                </div>
                <h4 className="text-sm font-bold text-white">Volcado Estructurado JSON</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Estructura completa de objetos con todas las claves de getprop, particiones, hash de pantalla y apps.
                </p>
              </div>
              <button
                onClick={handleDownloadJson}
                className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-md"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar .json</span>
              </button>
            </div>

            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold font-mono text-sm mb-2">
                  CSV
                </div>
                <h4 className="text-sm font-bold text-white">Telemetría en Tabla CSV</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Formato de hoja de cálculo compatible con Excel, Google Sheets y software de análisis forense.
                </p>
              </div>
              <button
                onClick={handleDownloadCsv}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-md"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar .csv</span>
              </button>
            </div>

            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold font-mono text-sm mb-2">
                  CLIP
                </div>
                <h4 className="text-sm font-bold text-white">Portapapeles Rápido</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Copia el volcado JSON directamente en la memoria para pegarlo en tu editor o terminal.
                </p>
              </div>
              <button
                onClick={handleCopyDump}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                {hasCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-cyan-400" />}
                <span>{hasCopied ? '¡Copiado con Éxito!' : 'Copiar al Portapapeles'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
