import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  X,
  Sliders,
  Terminal,
  Key,
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Send,
  Copy,
  Check,
  Cpu,
  Flame,
  FileCode2,
  BookOpen,
  Sparkles,
} from 'lucide-react';
import { SecurityApiPolicy } from '../types.ts';
import { playClickSound, playSuccessSound } from '../utils/sound.ts';

interface SecurityApiModalProps {
  isOpen: boolean;
  onClose: () => void;
  soundEnabled: boolean;
  currentMasterPattern: number[];
}

const DEFAULT_POLICY: SecurityApiPolicy = {
  minPatternLength: 4,
  minEntropyBits: 15,
  maxAttemptsBeforeLockout: 5,
  lockoutDurationSeconds: 30,
  hashAlgorithm: 'HMAC-SHA-512',
  saltRounds: 100000,
  enforceNonAdjacentNodes: false,
  blockCommonShapes: true,
  smudgeAttackDefense: true,
  requireBiometricFallback: true,
};

export const SecurityApiModal: React.FC<SecurityApiModalProps> = ({
  isOpen,
  onClose,
  soundEnabled,
  currentMasterPattern,
}) => {
  const [activeTab, setActiveTab] = useState<'policy' | 'tester' | 'docs'>('policy');
  const [policy, setPolicy] = useState<SecurityApiPolicy>(DEFAULT_POLICY);
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // API Tester States
  const [selectedEndpoint, setSelectedEndpoint] = useState<'policy_get' | 'policy_put' | 'audit_post' | 'verify_post'>('audit_post');
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [apiLatency, setApiLatency] = useState<number | null>(null);
  const [apiStatusCode, setApiStatusCode] = useState<number | null>(null);
  const [copiedResponse, setCopiedResponse] = useState(false);
  const [customTestPattern, setCustomTestPattern] = useState<string>(
    currentMasterPattern.join(', ')
  );

  // Load current policy from API on open
  useEffect(() => {
    if (!isOpen) return;
    const fetchPolicy = async () => {
      try {
        const res = await fetch('/api/security/policy');
        const data = await res.json();
        if (data.success && data.policy) {
          setPolicy(data.policy);
        }
      } catch (err) {
        console.warn('Could not fetch security policy:', err);
      }
    };
    fetchPolicy();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSavePolicy = async () => {
    playClickSound(soundEnabled);
    setLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/security/policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policy),
      });
      const data = await res.json();
      if (data.success) {
        setSaveSuccess(true);
        setStatusMessage('¡Parámetros de la API de seguridad actualizados con éxito!');
        playSuccessSound(soundEnabled);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setStatusMessage(data.error || 'Error al guardar los cambios.');
      }
    } catch (err: any) {
      setStatusMessage('Fallo de conexión con el servidor API.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetToDefault = () => {
    playClickSound(soundEnabled);
    setPolicy(DEFAULT_POLICY);
    setStatusMessage('Valores reestablecidos a la configuración recomendada de fábrica.');
  };

  // Run test request in Tester tab
  const handleExecuteApiTest = async () => {
    playClickSound(soundEnabled);
    setLoading(true);
    setApiResponse(null);
    setApiStatusCode(null);
    const startTime = performance.now();

    try {
      let res: Response;
      if (selectedEndpoint === 'policy_get') {
        res = await fetch('/api/security/policy');
      } else if (selectedEndpoint === 'policy_put') {
        res = await fetch('/api/security/policy', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(policy),
        });
      } else if (selectedEndpoint === 'audit_post') {
        const parsedPattern = customTestPattern
          .split(',')
          .map((n) => parseInt(n.trim(), 10))
          .filter((n) => !isNaN(n));
        res = await fetch('/api/security/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pattern: parsedPattern.length > 0 ? parsedPattern : currentMasterPattern }),
        });
      } else {
        // verify_post
        const parsedPattern = customTestPattern
          .split(',')
          .map((n) => parseInt(n.trim(), 10))
          .filter((n) => !isNaN(n));
        res = await fetch('/api/security/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pattern: parsedPattern.length > 0 ? parsedPattern : currentMasterPattern,
            salt: 'CUSTOM_TEST_SALT_KEY',
          }),
        });
      }

      const endTime = performance.now();
      setApiLatency(Math.round(endTime - startTime));
      setApiStatusCode(res.status);

      const json = await res.json();
      setApiResponse(json);
      playSuccessSound(soundEnabled);
    } catch (err: any) {
      setApiStatusCode(500);
      setApiResponse({ error: err.message || 'Error al ejecutar llamada a la API' });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyApiResponse = () => {
    playClickSound(soundEnabled);
    if (!apiResponse) return;
    navigator.clipboard.writeText(JSON.stringify(apiResponse, null, 2)).then(() => {
      setCopiedResponse(true);
      setTimeout(() => setCopiedResponse(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Modificación de API de Seguridad</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 font-semibold">
                  v2.4 / REST
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Políticas de validación criptográfica, umbrales de bloqueo y endpoints de auditoría
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

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 p-2 bg-slate-950 border-b border-slate-800 shrink-0 text-xs">
          <button
            onClick={() => {
              playClickSound(soundEnabled);
              setActiveTab('policy');
            }}
            className={`py-1.5 px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'policy'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Configuración de Políticas</span>
          </button>

          <button
            onClick={() => {
              playClickSound(soundEnabled);
              setActiveTab('tester');
            }}
            className={`py-1.5 px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'tester'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Consola de Pruebas de la API</span>
          </button>

          <button
            onClick={() => {
              playClickSound(soundEnabled);
              setActiveTab('docs');
            }}
            className={`py-1.5 px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'docs'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Documentación & Estándares</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs flex-1">
          {/* Status Banner */}
          {statusMessage && (
            <div
              className={`p-3 rounded-2xl flex items-center gap-2 font-medium ${
                saveSuccess
                  ? 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-300'
                  : 'bg-cyan-950/80 border border-cyan-500/50 text-cyan-300'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* TAB 1: POLICY CONFIGURATION */}
          {activeTab === 'policy' && (
            <div className="space-y-4">
              {/* Algoritmo Criptográfico */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="font-bold text-white block">Algoritmo de Hash Criptográfico</label>
                    <span className="text-[11px] text-slate-400">
                      Función unidireccional para derivación de claves y almacenamiento de credenciales
                    </span>
                  </div>
                  <span className="font-mono text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800 text-[10px]">
                    FIPS 140-3
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'HMAC-SHA-512', title: 'HMAC-SHA-512', desc: 'Estándar Gatekeeper Hardware Android 15' },
                    { id: 'PBKDF2-SHA-256', title: 'PBKDF2-SHA-256', desc: '100,000 iteraciones con Salt dinámico' },
                    { id: 'SHA-256', title: 'SHA-256 (Salted)', desc: 'Hash directo de alto rendimiento' },
                  ].map((algo) => (
                    <button
                      key={algo.id}
                      onClick={() => {
                        playClickSound(soundEnabled);
                        setPolicy((prev) => ({ ...prev, hashAlgorithm: algo.id as any }));
                      }}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        policy.hashAlgorithm === algo.id
                          ? 'bg-cyan-500/10 border-cyan-500 text-white shadow-sm'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-bold text-xs text-white">{algo.title}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{algo.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sliders: Longitud Mínima y Entropía */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Min Pattern Length */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="font-bold text-white">Longitud Mínima</label>
                    <span className="font-mono font-bold text-cyan-400 text-sm bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800">
                      {policy.minPatternLength} nodos
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Nodos mínimos requeridos por la API para aceptar un nuevo patrón
                  </p>
                  <input
                    type="range"
                    min="3"
                    max="9"
                    value={policy.minPatternLength}
                    onChange={(e) => setPolicy({ ...policy, minPatternLength: parseInt(e.target.value, 10) })}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>3 (Básico)</span>
                    <span>5 (Recomendado)</span>
                    <span>9 (Máximo)</span>
                  </div>
                </div>

                {/* Min Entropy Threshold */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="font-bold text-white">Umbral de Entropía</label>
                    <span className="font-mono font-bold text-emerald-400 text-sm bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                      {policy.minEntropyBits} bits
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Entropía mínima requerida para calificar la combinación como segura
                  </p>
                  <input
                    type="range"
                    min="8"
                    max="28"
                    value={policy.minEntropyBits}
                    onChange={(e) => setPolicy({ ...policy, minEntropyBits: parseInt(e.target.value, 10) })}
                    className="w-full accent-emerald-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>8 bits (Bajo)</span>
                    <span>15 bits (Estándar)</span>
                    <span>28 bits (Alto)</span>
                  </div>
                </div>
              </div>

              {/* Lockout & Cooldown Parameters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Max Failed Attempts */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="font-bold text-white">Intentos Fallidos Máximos</label>
                    <span className="font-mono font-bold text-rose-400 text-sm bg-rose-950/80 px-2 py-0.5 rounded border border-rose-800">
                      {policy.maxAttemptsBeforeLockout} intentos
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Umbral antes de activar el bloqueo temporal de seguridad
                  </p>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={policy.maxAttemptsBeforeLockout}
                    onChange={(e) => setPolicy({ ...policy, maxAttemptsBeforeLockout: parseInt(e.target.value, 10) })}
                    className="w-full accent-rose-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>1 (Estricto)</span>
                    <span>5 (Estándar)</span>
                    <span>10 (Permisivo)</span>
                  </div>
                </div>

                {/* Lockout Duration Cooldown */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="font-bold text-white">Tiempo de Enfriamiento (Lockout)</label>
                    <span className="font-mono font-bold text-amber-400 text-sm bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800">
                      {policy.lockoutDurationSeconds} segundos
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Segundos de penalización tras superar el límite de intentos
                  </p>
                  <input
                    type="range"
                    min="10"
                    max="120"
                    step="5"
                    value={policy.lockoutDurationSeconds}
                    onChange={(e) => setPolicy({ ...policy, lockoutDurationSeconds: parseInt(e.target.value, 10) })}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>10s</span>
                    <span>30s (NIST)</span>
                    <span>120s</span>
                  </div>
                </div>
              </div>

              {/* Toggles: Advanced Heuristics */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                <h4 className="font-bold text-white text-xs uppercase tracking-wider text-slate-400">
                  Reglas Heurísticas y Mitigación de Amenazas
                </h4>

                <div className="space-y-2.5">
                  <label className="flex items-center justify-between p-2.5 bg-slate-900 rounded-xl cursor-pointer hover:bg-slate-850 transition-colors">
                    <div>
                      <span className="font-semibold text-white block">Bloquear Formas y Letras Comunes</span>
                      <span className="text-[10px] text-slate-400">
                        Rechaza secuencias predecibles como Z, L, C, N y recorridos lineales
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={policy.blockCommonShapes}
                      onChange={(e) => setPolicy({ ...policy, blockCommonShapes: e.target.checked })}
                      className="w-4 h-4 accent-cyan-500 rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 bg-slate-900 rounded-xl cursor-pointer hover:bg-slate-850 transition-colors">
                    <div>
                      <span className="font-semibold text-white block">Mitigación de Smudge Attacks</span>
                      <span className="text-[10px] text-slate-400">
                        Alerta sobre patrones vulnerables a la identificación de residuos de grasa en pantalla
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={policy.smudgeAttackDefense}
                      onChange={(e) => setPolicy({ ...policy, smudgeAttackDefense: e.target.checked })}
                      className="w-4 h-4 accent-cyan-500 rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 bg-slate-900 rounded-xl cursor-pointer hover:bg-slate-850 transition-colors">
                    <div>
                      <span className="font-semibold text-white block">Requerir Salto de Nodos no Consecutivos</span>
                      <span className="text-[10px] text-slate-400">
                        Exige al menos un salto de caballo o cruce diagonal en la combinación
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={policy.enforceNonAdjacentNodes}
                      onChange={(e) => setPolicy({ ...policy, enforceNonAdjacentNodes: e.target.checked })}
                      className="w-4 h-4 accent-cyan-500 rounded"
                    />
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
                <button
                  onClick={handleSavePolicy}
                  disabled={loading}
                  className="w-full sm:flex-1 py-2.5 px-4 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  <span>{loading ? 'Guardando en la API...' : 'Guardar Modificación de la API (PUT)'}</span>
                </button>

                <button
                  onClick={handleResetToDefault}
                  className="w-full sm:w-auto py-2.5 px-4 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 hover:text-white font-medium rounded-xl transition-colors"
                >
                  Restablecer
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: LIVE API TESTER */}
          {activeTab === 'tester' && (
            <div className="space-y-4">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider">
                    Selector de Endpoint REST
                  </h4>
                  <div className="flex items-center gap-1.5 font-mono text-[11px]">
                    <span className="text-emerald-400 font-bold">API ACTIVA</span>
                    <span className="text-slate-500">·</span>
                    <span className="text-slate-400">Node/Express Backend</span>
                  </div>
                </div>

                {/* Endpoint Tabs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  {[
                    { id: 'audit_post', method: 'POST', path: '/api/security/audit', label: 'Auditar Patrón' },
                    { id: 'verify_post', method: 'POST', path: '/api/security/verify', label: 'Verificar Hash' },
                    { id: 'policy_get', method: 'GET', path: '/api/security/policy', label: 'Consultar Política' },
                    { id: 'policy_put', method: 'PUT', path: '/api/security/policy', label: 'Actualizar Política' },
                  ].map((ep) => (
                    <button
                      key={ep.id}
                      onClick={() => {
                        playClickSound(soundEnabled);
                        setSelectedEndpoint(ep.id as any);
                      }}
                      className={`p-2 rounded-xl border text-left font-mono transition-all ${
                        selectedEndpoint === ep.id
                          ? 'bg-cyan-500/10 border-cyan-500 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded mr-1 ${
                          ep.method === 'GET'
                            ? 'bg-emerald-950 text-emerald-400'
                            : ep.method === 'POST'
                            ? 'bg-cyan-950 text-cyan-400'
                            : 'bg-amber-950 text-amber-400'
                        }`}
                      >
                        {ep.method}
                      </span>
                      <div className="font-bold text-white text-xs mt-1 truncate">{ep.label}</div>
                      <div className="text-[10px] text-slate-500 truncate">{ep.path}</div>
                    </button>
                  ))}
                </div>

                {/* Input for custom test pattern if POST audit/verify */}
                {(selectedEndpoint === 'audit_post' || selectedEndpoint === 'verify_post') && (
                  <div className="pt-2 border-t border-slate-800/80">
                    <label className="block text-[11px] text-slate-400 mb-1 font-semibold">
                      Secuencia del Patrón de Prueba (nodos 0 al 8 separados por comas):
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customTestPattern}
                        onChange={(e) => setCustomTestPattern(e.target.value)}
                        placeholder="ej: 0, 1, 2, 4, 6, 7, 8"
                        className="flex-1 bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs text-white font-mono placeholder-slate-600 focus:outline-none"
                      />
                      <button
                        onClick={() => setCustomTestPattern(currentMasterPattern.join(', '))}
                        className="px-3 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-700 text-cyan-300 rounded-xl text-xs font-semibold whitespace-nowrap"
                      >
                        Cargar Maestro
                      </button>
                    </div>
                  </div>
                )}

                {/* Execute Button */}
                <button
                  onClick={handleExecuteApiTest}
                  disabled={loading}
                  className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>Enviar Petición a la API de Seguridad</span>
                </button>
              </div>

              {/* Response Inspector */}
              {apiResponse && (
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-emerald-400 bg-emerald-950 border border-emerald-800 px-2 py-0.5 rounded text-[10px]">
                        HTTP {apiStatusCode || 200} OK
                      </span>
                      {apiLatency && (
                        <span className="text-slate-400 font-mono text-[10px]">
                          Latencia: {apiLatency} ms
                        </span>
                      )}
                    </div>
                    <button
                      onClick={handleCopyApiResponse}
                      className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 font-mono"
                    >
                      {copiedResponse ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedResponse ? 'Copiado' : 'Copiar'}</span>
                    </button>
                  </div>

                  <pre className="p-3 bg-black/90 rounded-xl text-cyan-300 font-mono text-[11px] overflow-x-auto max-h-64 border border-slate-900 select-all leading-relaxed">
                    {JSON.stringify(apiResponse, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DOCUMENTATION & STANDARDS */}
          {activeTab === 'docs' && (
            <div className="space-y-4">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-wider text-cyan-400">
                  <BookOpen className="w-4 h-4" />
                  <span>Especificación de la API de Seguridad</span>
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  La API de seguridad de PatternLock implementa un marco criptográfico integral basado en las directrices de <strong>NIST SP 800-63B</strong> y la capa de abstracción de hardware <strong>Android Gatekeeper HAL</strong>.
                </p>

                <div className="space-y-2 pt-2 border-t border-slate-800/80 font-mono text-[11px]">
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-cyan-400 font-bold">GET /api/security/policy</span>
                    <p className="text-slate-400 text-[10px] mt-0.5 font-sans">
                      Devuelve los parámetros activos de longitud, entropía mínima, algoritmo de hash e intentos máximos.
                    </p>
                  </div>

                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-amber-400 font-bold">PUT /api/security/policy</span>
                    <p className="text-slate-400 text-[10px] mt-0.5 font-sans">
                      Modifica en caliente las reglas y umbrales de seguridad de la aplicación con validación de rangos.
                    </p>
                  </div>

                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-emerald-400 font-bold">POST /api/security/audit</span>
                    <p className="text-slate-400 text-[10px] mt-0.5 font-sans">
                      Audita el patrón ingresado calculando entropía en bits, vulnerabilidad a ataques de diccionario y cumplimiento de la política.
                    </p>
                  </div>

                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-purple-400 font-bold">POST /api/security/verify</span>
                    <p className="text-slate-400 text-[10px] mt-0.5 font-sans">
                      Genera el hash criptográfico seguro mediante HMAC-SHA-512 o PBKDF2 (100,000 rondas) para comparación segura.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-4 text-emerald-300 text-xs flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-white block">Resistencia contra Ataques de Fuerza Bruta:</span>
                  <p className="text-[11px] leading-relaxed text-slate-300">
                    Con el umbral de 5 intentos fallidos y enfriamiento de 30 segundos, el espacio total de búsqueda (389,112 combinaciones para 3x3) requeriría más de <strong>75 años</strong> de intentos manuales continuos, garantizando la inviolabilidad del patrón.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
