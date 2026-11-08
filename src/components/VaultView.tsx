import React, { useState } from 'react';
import { EncryptedNote, ProtectedAppItem, ThemeConfig, UnlockAttempt, GridSize, CustomGridStyle } from '../types.ts';
import { playClickSound, playLockSound, playSuccessSound, triggerHaptic } from '../utils/sound.ts';
import { PatternGrid } from './PatternGrid.tsx';
import { arePatternsEqual } from '../utils/patternLogic.ts';
import {
  Lock,
  Unlock,
  FileText,
  Smartphone,
  Shield,
  Plus,
  Trash2,
  Copy,
  Pin,
  Check,
  Search,
  Key,
  ShieldCheck,
  History,
  AlertCircle,
  ExternalLink,
  MessageCircle,
  CreditCard,
  Image,
  Wallet,
  Mail,
  Mic,
  Download,
  FileSpreadsheet,
  FileCode,
  Sparkles,
} from 'lucide-react';

interface VaultViewProps {
  theme: ThemeConfig;
  masterPattern: number[];
  gridSize: GridSize;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  customStyle?: Partial<CustomGridStyle>;
  unlockAttempts: UnlockAttempt[];
  onLockDevice: () => void;
  onClearAttempts: () => void;
}

const INITIAL_NOTES: EncryptedNote[] = [
  {
    id: 'note-1',
    title: 'Clave Maestra Wi-Fi de Casa y Oficina',
    content: 'SSID: CyberVault-5G\nPassword: *K9$mZ#89!AlphaVault2026*\nIP Gateway: 192.168.1.1\nDNS: 1.1.1.1 (Cloudflare DoH)',
    category: 'Contraseñas',
    createdAt: Date.now() - 86400000 * 3,
    updatedAt: Date.now() - 86400000,
    pinned: true,
  },
  {
    id: 'note-2',
    title: 'PIN de Emergencia Tarjeta Débito Banco',
    content: 'Tarjeta Débito Black: PIN 8934 (Solo usar en cajeros seguros red BanRed).\nToken de recuperación: 4492-8819.',
    category: 'Finanzas',
    createdAt: Date.now() - 86400000 * 7,
    updatedAt: Date.now() - 86400000 * 2,
    pinned: true,
  },
  {
    id: 'note-3',
    title: 'Semilla Frase Mnemónica Billetera Fría',
    content: '1. orbit  2. glacier  3. solar  4. timber  5. whisper  6. shield  7. canyon  8. echo  9. cobalt  10. beacon  11. quartz  12. apex',
    category: 'Contraseñas',
    createdAt: Date.now() - 86400000 * 12,
    updatedAt: Date.now() - 86400000 * 5,
    pinned: false,
  },
  {
    id: 'note-4',
    title: 'Ideas de Proyecto PatternLock Mobile',
    content: 'Implementar detector de huella por manchas de grasa, análisis de combinatoria estricta y modo camuflaje para conferencias públicas.',
    category: 'Personal',
    createdAt: Date.now() - 86400000 * 1,
    updatedAt: Date.now() - 86400000 * 1,
    pinned: false,
  },
];

const INITIAL_APPS: ProtectedAppItem[] = [
  {
    id: 'app-whatsapp',
    name: 'WhatsApp',
    category: 'Mensajería',
    icon: 'MessageCircle',
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    isLocked: true,
    mockData: '3 chats cifrados de extremo a extremo. Último mensaje de "Equipo de Seguridad": Código de verificación enviado.',
  },
  {
    id: 'app-bank',
    name: 'Banca Móvil BBVA',
    category: 'Finanzas',
    icon: 'CreditCard',
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    isLocked: true,
    mockData: 'Saldo disponible: $4,850.00 USD. Tarjeta de crédito con protección biométrica activa.',
  },
  {
    id: 'app-gallery',
    name: 'Galería Oculta',
    category: 'Multimedia',
    icon: 'Image',
    color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    isLocked: true,
    mockData: '42 fotografías y videos protegidos en la carpeta privada del sistema.',
  },
  {
    id: 'app-wallet',
    name: 'Cripto Wallet',
    category: 'Finanzas',
    icon: 'Wallet',
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    isLocked: true,
    mockData: 'Dirección pública: 0x71C...38a9. Fondos asegurados con multi-firma.',
  },
  {
    id: 'app-mail',
    name: 'ProtonMail',
    category: 'Productividad',
    icon: 'Mail',
    color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    isLocked: false,
    mockData: 'Bandeja de entrada: 5 correos con cifrado PGP verificado.',
  },
  {
    id: 'app-voice',
    name: 'Grabadora de Voz',
    category: 'Audio',
    icon: 'Mic',
    color: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    isLocked: false,
    mockData: '8 grabaciones de notas de voz confidenciales.',
  },
];

export const VaultView: React.FC<VaultViewProps> = ({
  theme,
  masterPattern,
  gridSize,
  soundEnabled,
  hapticsEnabled,
  customStyle,
  unlockAttempts,
  onLockDevice,
  onClearAttempts,
}) => {
  const [activeTab, setActiveTab] = useState<'notes' | 'apps' | 'history'>('notes');
  const [notes, setNotes] = useState<EncryptedNote[]>(INITIAL_NOTES);
  const [apps, setApps] = useState<ProtectedAppItem[]>(INITIAL_APPS);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null);
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null);

  // New Note Modal
  const [showAddNote, setShowAddNote] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<EncryptedNote['category']>('Personal');

  // App Lock Test Modal
  const [testingApp, setTestingApp] = useState<ProtectedAppItem | null>(null);
  const [appTestStatus, setAppTestStatus] = useState<'idle' | 'drawing' | 'success' | 'error'>('idle');
  const [appUnlockedContent, setAppUnlockedContent] = useState<string | null>(null);

  const toggleAppLock = (appId: string) => {
    playClickSound(soundEnabled);
    setApps((prev) =>
      prev.map((app) => (app.id === appId ? { ...app, isLocked: !app.isLocked } : app))
    );
  };

  const handleOpenApp = (app: ProtectedAppItem) => {
    if (app.isLocked) {
      setTestingApp(app);
      setAppTestStatus('idle');
      setAppUnlockedContent(null);
    } else {
      setTestingApp(app);
      setAppUnlockedContent(app.mockData);
    }
  };

  const handleAppPatternComplete = (pattern: number[]) => {
    if (arePatternsEqual(pattern, masterPattern)) {
      setAppTestStatus('success');
      playSuccessSound(soundEnabled);
      triggerHaptic('success', hapticsEnabled);
      setTimeout(() => {
        if (testingApp) {
          setAppUnlockedContent(testingApp.mockData);
        }
      }, 500);
    } else {
      setAppTestStatus('error');
      triggerHaptic('error', hapticsEnabled);
      setTimeout(() => setAppTestStatus('idle'), 1200);
    }
  };

  const handleCopyNote = (note: EncryptedNote) => {
    navigator.clipboard.writeText(note.content).then(() => {
      setCopiedNoteId(note.id);
      playClickSound(soundEnabled);
      setTimeout(() => setCopiedNoteId(null), 2000);
    });
  };

  const handleDeleteNote = (noteId: string) => {
    playClickSound(soundEnabled);
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
  };

  const handleTogglePin = (noteId: string) => {
    playClickSound(soundEnabled);
    setNotes((prev) =>
      prev.map((n) => (n.id === noteId ? { ...n, pinned: !n.pinned } : n))
    );
  };

  const handleCreateNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    const newNote: EncryptedNote = {
      id: `note-${Date.now()}`,
      title: newTitle.trim(),
      content: newContent.trim(),
      category: newCategory,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      pinned: false,
    };

    setNotes([newNote, ...notes]);
    setNewTitle('');
    setNewContent('');
    setShowAddNote(false);
    playSuccessSound(soundEnabled);
  };

  const exportAsJSON = () => {
    if (unlockAttempts.length === 0) return;
    playClickSound(soundEnabled);

    const successfulCount = unlockAttempts.filter((a) => a.success).length;
    const failedCount = unlockAttempts.length - successfulCount;
    const successRate = ((successfulCount / unlockAttempts.length) * 100).toFixed(1) + '%';

    const exportData = {
      exportMetadata: {
        generatedAt: new Date().toISOString(),
        appName: 'PatternLock Security',
        description: 'Auditoría Criptográfica de Intentos de Desbloqueo',
        totalRecords: unlockAttempts.length,
        successfulAttempts: successfulCount,
        failedAttempts: failedCount,
        successRate,
      },
      records: unlockAttempts.map((a, index) => ({
        index: index + 1,
        id: a.id,
        timestamp: a.timestamp,
        formattedDateTime: new Date(a.timestamp).toLocaleString('es-ES', {
          dateStyle: 'full',
          timeStyle: 'medium',
        }),
        result: a.success ? 'EXITOSO' : 'FALLIDO',
        success: a.success,
        patternLength: a.length,
        patternMasked: a.patternMasked || '●●●●',
        deviceInfo: a.deviceInfo,
      })),
    };

    const dataBlob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json;charset=utf-8;',
    });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    const dateSlug = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `registro-seguridad-patternlock-${dateSlug}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExportSuccessMessage('¡Historial exportado como archivo JSON!');
    playSuccessSound(soundEnabled);
    setTimeout(() => setExportSuccessMessage(null), 3500);
  };

  const exportAsCSV = () => {
    if (unlockAttempts.length === 0) return;
    playClickSound(soundEnabled);

    const headers = [
      'Nro',
      'ID_Registro',
      'Fecha',
      'Hora',
      'Resultado',
      'Exito_Booleano',
      'Longitud_Nodos',
      'Mascara_Patron',
      'Dispositivo_Origen',
      'Timestamp_Epoch',
    ];

    const rows = unlockAttempts.map((a, idx) => {
      const d = new Date(a.timestamp);
      const dateStr = d.toLocaleDateString('es-ES');
      const timeStr = d.toLocaleTimeString('es-ES');
      const statusStr = a.success ? 'Exitoso' : 'Fallido';
      const escapedDevice = `"${(a.deviceInfo || '').replace(/"/g, '""')}"`;
      const escapedMask = `"${(a.patternMasked || '').replace(/"/g, '""')}"`;

      return [
        idx + 1,
        `"${a.id}"`,
        `"${dateStr}"`,
        `"${timeStr}"`,
        `"${statusStr}"`,
        a.success ? 'TRUE' : 'FALSE',
        a.length,
        escapedMask,
        escapedDevice,
        a.timestamp,
      ].join(',');
    });

    // UTF-8 BOM \uFEFF to preserve UTF-8 accented characters and bullet points in Excel and LibreOffice
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateSlug = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `registro-seguridad-patternlock-${dateSlug}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExportSuccessMessage('¡Historial exportado como archivo CSV!');
    playSuccessSound(soundEnabled);
    setTimeout(() => setExportSuccessMessage(null), 3500);
  };

  const filteredNotes = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderAppIcon = (iconName: string) => {
    switch (iconName) {
      case 'MessageCircle':
        return <MessageCircle className="w-5 h-5" />;
      case 'CreditCard':
        return <CreditCard className="w-5 h-5" />;
      case 'Image':
        return <Image className="w-5 h-5" />;
      case 'Wallet':
        return <Wallet className="w-5 h-5" />;
      case 'Mail':
        return <Mail className="w-5 h-5" />;
      default:
        return <Mic className="w-5 h-5" />;
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-2 px-3">
      {/* Top Banner with Quick Lock */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Bóveda Protegida Desbloqueada
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="text-emerald-400 font-medium">● Sesión Activa</span>
              <span>·</span>
              <span>Cifrado AES-256 local</span>
            </div>
          </div>
        </div>

        {/* Action button: Instant Lock */}
        <button
          onClick={() => {
            playLockSound(soundEnabled);
            onLockDevice();
          }}
          className="w-full sm:w-auto px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors active:scale-95 shadow-md shadow-rose-950/40"
        >
          <Lock className="w-4 h-4" />
          <span>Bloquear Teléfono Ahora</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl">
          <button
            onClick={() => {
              setActiveTab('notes');
              playClickSound(soundEnabled);
            }}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'notes'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Notas Cifradas ({notes.length})</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('apps');
              playClickSound(soundEnabled);
            }}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'apps'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Bloqueo de Apps ({apps.filter((a) => a.isLocked).length})</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('history');
              playClickSound(soundEnabled);
            }}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Registro de Intentos ({unlockAttempts.length})</span>
          </button>
        </div>

        {activeTab === 'notes' && (
          <button
            onClick={() => {
              setShowAddNote(true);
              playClickSound(soundEnabled);
            }}
            className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Nota Secreta</span>
          </button>
        )}
      </div>

      {/* Tab 1: Encrypted Notes */}
      {activeTab === 'notes' && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar en notas cifradas por título, clave o categoría..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredNotes.map((note) => (
              <div
                key={note.id}
                className={`bg-slate-900/80 border rounded-3xl p-4 flex flex-col justify-between transition-colors ${
                  note.pinned ? 'border-cyan-500/40 bg-slate-900/95 shadow-md shadow-cyan-950/20' : 'border-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-cyan-400 px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/40">
                        {note.category}
                      </span>
                      {note.pinned && (
                        <span className="text-[10px] text-amber-400 flex items-center gap-1">
                          <Pin className="w-3 h-3 fill-amber-400" /> Fijada
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleTogglePin(note.id)}
                        title={note.pinned ? 'Desfijar' : 'Fijar nota'}
                        className={`p-1.5 rounded-lg transition-colors ${
                          note.pinned ? 'text-amber-400 bg-amber-950/30' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Pin className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleCopyNote(note)}
                        title="Copiar contenido"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition-colors"
                      >
                        {copiedNoteId === note.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        title="Eliminar"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-white mb-2">{note.title}</h3>
                  <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800/80 font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed select-text">
                    {note.content}
                  </div>
                </div>

                <div className="text-[10px] text-slate-500 mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between">
                  <span>Actualizado recientemente</span>
                  <span>Protegido con patrón maestro</span>
                </div>
              </div>
            ))}
          </div>

          {filteredNotes.length === 0 && (
            <div className="text-center py-12 bg-slate-900/50 border border-slate-800 rounded-3xl p-6">
              <FileText className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400">No se encontraron notas con ese criterio.</p>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: App Locker Simulator */}
      {activeTab === 'apps' && (
        <div className="space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-4">
            <h3 className="text-sm font-bold text-white mb-1">Protector de Aplicaciones del Dispositivo</h3>
            <p className="text-xs text-slate-400">
              Las aplicaciones bloqueadas requerirán dibujar tu patrón de seguridad antes de permitir el acceso. Haz clic en cualquier app para probar la experiencia de desbloqueo.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {apps.map((app) => (
              <div
                key={app.id}
                className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-3xl p-4 flex flex-col justify-between transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-2xl flex items-center justify-center border ${app.color}`}>
                        {renderAppIcon(app.icon)}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">{app.name}</h4>
                        <span className="text-[10px] text-slate-400">{app.category}</span>
                      </div>
                    </div>

                    {/* Lock toggle switch */}
                    <button
                      onClick={() => toggleAppLock(app.id)}
                      className={`p-2 rounded-xl border transition-colors ${
                        app.isLocked
                          ? 'bg-rose-950/40 text-rose-400 border-rose-500/40'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                      title={app.isLocked ? 'App Bloqueada' : 'App Desbloqueada'}
                    >
                      {app.isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-400 line-clamp-2 mb-3">
                    {app.mockData}
                  </p>
                </div>

                <button
                  onClick={() => handleOpenApp(app)}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Probar Acceso</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Security Logs & Export */}
      {activeTab === 'history' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 space-y-4">
          {/* Export Success Feedback Toast */}
          {exportSuccessMessage && (
            <div className="bg-emerald-950/90 border border-emerald-500/50 rounded-2xl p-3 flex items-center justify-between text-xs text-emerald-200 shadow-lg shadow-emerald-950/40 animate-fade-in">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-semibold">{exportSuccessMessage}</span>
              </div>
              <span className="text-[10px] text-emerald-400 font-mono">Descarga completada</span>
            </div>
          )}

          {/* Header & Export Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Auditoría de Desbloqueo y Seguridad</span>
                <span className="text-xs font-mono font-medium text-cyan-400 bg-cyan-950/80 border border-cyan-800/60 px-2 py-0.5 rounded-full">
                  {unlockAttempts.length} {unlockAttempts.length === 1 ? 'registro' : 'registros'}
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Registro criptográfico de intentos de desbloqueo en este navegador.
              </p>
            </div>

            {/* Export and Clear Action Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              {unlockAttempts.length > 0 ? (
                <>
                  {/* Export Options Button Group */}
                  <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-2xl border border-slate-800 shadow-inner">
                    <button
                      onClick={exportAsJSON}
                      className="px-2.5 py-1.5 bg-slate-900 hover:bg-cyan-950/80 border border-slate-800 hover:border-cyan-500/50 text-slate-200 hover:text-cyan-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                      title="Descargar historial en formato estructurado JSON"
                    >
                      <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Exportar JSON</span>
                    </button>

                    <button
                      onClick={exportAsCSV}
                      className="px-2.5 py-1.5 bg-slate-900 hover:bg-emerald-950/80 border border-slate-800 hover:border-emerald-500/50 text-slate-200 hover:text-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                      title="Descargar historial en formato tabla CSV para Excel y hojas de cálculo"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Exportar CSV</span>
                    </button>
                  </div>

                  <button
                    onClick={onClearAttempts}
                    className="px-3 py-1.5 bg-slate-800/80 hover:bg-rose-950/40 border border-slate-700/80 hover:border-rose-500/40 text-slate-300 hover:text-rose-300 rounded-xl text-xs font-medium transition-colors"
                  >
                    Limpiar
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                  <Download className="w-3.5 h-3.5" />
                  <span>Sin registros para exportar</span>
                </div>
              )}
            </div>
          </div>

          {/* Security Metrics Overview Cards */}
          {unlockAttempts.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Intentos</span>
                <span className="text-base font-extrabold text-white font-mono">{unlockAttempts.length}</span>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80">
                <span className="text-[10px] text-emerald-400 uppercase font-semibold block">Exitosos</span>
                <span className="text-base font-extrabold text-emerald-400 font-mono">
                  {unlockAttempts.filter((a) => a.success).length}
                </span>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80">
                <span className="text-[10px] text-rose-400 uppercase font-semibold block">Fallidos</span>
                <span className="text-base font-extrabold text-rose-400 font-mono">
                  {unlockAttempts.filter((a) => !a.success).length}
                </span>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80">
                <span className="text-[10px] text-cyan-400 uppercase font-semibold block">Tasa de Éxito</span>
                <span className="text-base font-extrabold text-cyan-300 font-mono">
                  {Math.round((unlockAttempts.filter((a) => a.success).length / unlockAttempts.length) * 100)}%
                </span>
              </div>
            </div>
          )}

          {/* Attempt List */}
          {unlockAttempts.length > 0 ? (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {unlockAttempts.map((attempt) => (
                <div
                  key={attempt.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-950 border border-slate-800/80 hover:border-slate-700/80 transition-colors text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center font-bold ${
                        attempt.success
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                          : 'bg-rose-950 text-rose-400 border border-rose-800/50'
                      }`}
                    >
                      {attempt.success ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    </div>

                    <div>
                      <div className="font-semibold text-white">
                        {attempt.success ? 'Desbloqueo Exitoso' : 'Intento Fallido'}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {attempt.deviceInfo} · Longitud: {attempt.length} nodos
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono text-slate-300 text-xs">
                      {new Date(attempt.timestamp).toLocaleTimeString('es-ES')}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono tracking-widest">
                      {attempt.patternMasked}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500 text-xs bg-slate-950/40 rounded-2xl border border-dashed border-slate-800 p-6">
              <History className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="font-semibold text-slate-400 mb-1">No hay intentos registrados aún</p>
              <p className="text-[11px] text-slate-500">
                Los intentos realizados en la Pantalla de Bloqueo, la Pantalla USB o por el Agente IA aparecerán aquí y podrán ser exportados.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Add Note Modal */}
      {showAddNote && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateNote}
            className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-md w-full shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                Nueva Nota Secreta
              </h3>
              <button
                type="button"
                onClick={() => setShowAddNote(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                Cancelar
              </button>
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Título de la nota</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Contraseña Servidor AWS"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Categoría</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['Personal', 'Contraseñas', 'Finanzas', 'Trabajo'] as const).map((cat) => (
                    <button
                      type="button"
                      key={cat}
                      onClick={() => setNewCategory(cat)}
                      className={`py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                        newCategory === cat
                          ? 'bg-cyan-500 text-slate-950'
                          : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Contenido Confidencial</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Escribe claves, notas o datos confidenciales aquí..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold shadow-md shadow-cyan-950/30 transition-colors"
              >
                Guardar en Bóveda Cifrada
              </button>
            </div>
          </form>
        </div>
      )}

      {/* App Lock Challenge Modal */}
      {testingApp && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-sm w-full text-center">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-left">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${testingApp.color}`}>
                  {renderAppIcon(testingApp.icon)}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">{testingApp.name}</h4>
                  <span className="text-[10px] text-slate-400">Seguridad por Patrón</span>
                </div>
              </div>
              <button
                onClick={() => {
                  setTestingApp(null);
                  setAppUnlockedContent(null);
                }}
                className="text-xs text-slate-400 hover:text-white"
              >
                Cerrar
              </button>
            </div>

            {appUnlockedContent ? (
              <div className="py-4 space-y-3">
                <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-white">¡Acceso Concedido a {testingApp.name}!</h3>
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-left text-xs text-slate-200">
                  <p className="font-semibold text-emerald-400 mb-1">Datos seguros cargados:</p>
                  <p className="leading-relaxed">{appUnlockedContent}</p>
                </div>
                <button
                  onClick={() => {
                    setTestingApp(null);
                    setAppUnlockedContent(null);
                  }}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold"
                >
                  Regresar a la Bóveda
                </button>
              </div>
            ) : (
              <div className="py-2">
                <p className="text-xs text-slate-300 mb-2">
                  Dibuja tu patrón para acceder a los datos de {testingApp.name}
                </p>
                <div className="w-full flex justify-center py-2">
                  <PatternGrid
                    gridSize={gridSize}
                    theme={theme}
                    customStyle={customStyle}
                    status={appTestStatus}
                    soundEnabled={soundEnabled}
                    hapticsEnabled={hapticsEnabled}
                    onPatternComplete={handleAppPatternComplete}
                  />
                </div>
                <div className="text-[11px] text-slate-500 mt-2">
                  Verificación de seguridad activa
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
