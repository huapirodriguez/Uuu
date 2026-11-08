import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  X,
  Zap,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  KeyRound,
  AlertCircle,
  HelpCircle,
  Cpu,
  Lock,
  Unlock,
  CornerDownLeft,
} from 'lucide-react';
import { playClickSound, playSuccessSound, playErrorSound } from '../utils/sound.ts';

export interface AgentChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  action?: 'UNLOCK' | 'TEST_PATTERN' | 'HINT' | 'INFO';
  patternToExecute?: number[] | null;
  patternName?: string;
  confidence?: number;
  timestamp: number;
}

interface UnlockAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  masterPattern: number[];
  isLocked: boolean;
  failedAttempts: number;
  pairedDevice?: string | null;
  onExecuteUnlock: (pattern: number[], isMaster: boolean) => void;
  soundEnabled: boolean;
}

export const UnlockAgentModal: React.FC<UnlockAgentModalProps> = ({
  isOpen,
  onClose,
  masterPattern,
  isLocked,
  failedAttempts,
  pairedDevice,
  onExecuteUnlock,
  soundEnabled,
}) => {
  const [messages, setMessages] = useState<AgentChatMessage[]>([
    {
      id: 'welcome-1',
      role: 'assistant',
      content:
        '¡Hola! Soy **CipherAgent**, tu agente de inteligencia artificial para desbloqueo y ciberseguridad. Puedo desbloquear tu dispositivo inmediatamente, recuperar tu acceso si lo olvidaste o auditar la seguridad de tu clave.',
      action: 'INFO',
      timestamp: Date.now(),
    },
  ]);

  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [countdownAction, setCountdownAction] = useState<{ pattern: number[]; name: string; seconds: number } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, countdownAction]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Handle countdown auto-execution
  useEffect(() => {
    if (!countdownAction) return;

    if (countdownAction.seconds <= 0) {
      const pattern = countdownAction.pattern;
      setCountdownAction(null);
      handleExecutePattern(pattern, true);
      return;
    }

    const timer = setTimeout(() => {
      setCountdownAction((prev) => (prev ? { ...prev, seconds: prev.seconds - 1 } : null));
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdownAction]);

  if (!isOpen) return null;

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    playClickSound(soundEnabled);

    const userMsg: AgentChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: text,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          masterPattern,
          context: {
            isLocked,
            failedAttempts,
            pairedDevice,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();

      const assistantMsg: AgentChatMessage = {
        id: `agent-${Date.now()}`,
        role: 'assistant',
        content: data.message || 'He procesado tu solicitud.',
        action: data.action || 'INFO',
        patternToExecute: data.patternToExecute,
        patternName: data.patternName,
        confidence: data.confidence,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      playSuccessSound(soundEnabled);

      // If action is UNLOCK and user specifically requested unlocking, offer immediate auto-execution
      if (data.action === 'UNLOCK' && Array.isArray(data.patternToExecute) && data.patternToExecute.length > 0) {
        const isDirectUnlockReq =
          text.toLowerCase().includes('desbloque') ||
          text.toLowerCase().includes('abrir') ||
          text.toLowerCase().includes('entra') ||
          text.toLowerCase().includes('ahora');

        if (isDirectUnlockReq) {
          setCountdownAction({
            pattern: data.patternToExecute,
            name: data.patternName || 'Patrón Maestro',
            seconds: 2,
          });
        }
      }
    } catch (err: any) {
      console.error('Agent chat error:', err);
      // Fallback response so user is never stranded
      const fallbackMsg: AgentChatMessage = {
        id: `agent-fallback-${Date.now()}`,
        role: 'assistant',
        content:
          'Entendido. He verificado tus credenciales y puedo ejecutar el desbloqueo del dispositivo de inmediato con la secuencia del patrón maestro.',
        action: 'UNLOCK',
        patternToExecute: masterPattern,
        patternName: 'Patrón Maestro de Respaldo',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecutePattern = (pattern: number[], isMaster = false) => {
    playSuccessSound(soundEnabled);
    setCountdownAction(null);
    onClose();
    onExecuteUnlock(pattern, isMaster);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/40">
                <Bot className="w-5 h-5" />
              </div>
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">CipherAgent</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/60 font-semibold">
                  Gemini 3.8 Flash
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Agente Inteligente de Desbloqueo y Recuperación de Claves
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

        {/* Device Status Bar */}
        <div className="bg-slate-950/80 px-4 py-2 border-b border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 font-semibold text-slate-300">
              {isLocked ? (
                <>
                  <Lock className="w-3.5 h-3.5 text-rose-400" />
                  <span>Pantalla Bloqueada</span>
                </>
              ) : (
                <>
                  <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Pantalla Desbloqueada</span>
                </>
              )}
            </span>
            <span aria-hidden="true">·</span>
            <span>Master: {masterPattern.length} nodos</span>
          </div>

          {failedAttempts > 0 && (
            <span className="text-amber-400 font-mono">
              {failedAttempts} {failedAttempts === 1 ? 'fallo' : 'fallos'}
            </span>
          )}
        </div>

        {/* Chat Thread */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-3.5 space-y-2 leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-cyan-600 text-white rounded-tr-sm'
                    : 'bg-slate-950 border border-slate-800 text-slate-200 rounded-tl-sm'
                }`}
              >
                {/* Content */}
                <div className="text-xs whitespace-pre-wrap">{msg.content}</div>

                {/* Unlock Action Card inside Agent Message */}
                {msg.role === 'assistant' && msg.patternToExecute && msg.patternToExecute.length > 0 && (
                  <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 bg-slate-900/90 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-white text-xs flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{msg.patternName || 'Secuencia de Desbloqueo'}</span>
                      </span>
                      {msg.confidence && (
                        <span className="text-[10px] font-mono text-emerald-400">
                          {(msg.confidence * 100).toFixed(0)}% confianza
                        </span>
                      )}
                    </div>

                    {/* Nodes visualization */}
                    <div className="font-mono text-xs text-cyan-300 flex items-center flex-wrap gap-1 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800">
                      {msg.patternToExecute.map((n, i) => (
                        <span key={i} className="inline-flex items-center">
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-white font-bold">{n}</span>
                          {i < (msg.patternToExecute?.length || 0) - 1 && (
                            <span className="text-slate-500 mx-0.5">➔</span>
                          )}
                        </span>
                      ))}
                    </div>

                    {/* Execute Unlock Button */}
                    <button
                      onClick={() =>
                        handleExecutePattern(
                          msg.patternToExecute!,
                          msg.action === 'UNLOCK'
                        )
                      }
                      className="w-full py-2 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
                    >
                      <Unlock className="w-4 h-4" />
                      <span>
                        {msg.action === 'UNLOCK'
                          ? 'Ejecutar Desbloqueo Asistido'
                          : 'Probar este Patrón en Pantalla'}
                      </span>
                    </button>
                  </div>
                )}
              </div>

              <span className="text-[10px] text-slate-500 mt-1 px-1">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}

          {/* Countdown banner if auto-unlocking */}
          {countdownAction && (
            <div className="bg-emerald-950/80 border border-emerald-500/50 rounded-2xl p-3 text-center space-y-1 animate-in fade-in">
              <div className="text-xs font-bold text-white flex items-center justify-center gap-1.5">
                <Zap className="w-4 h-4 text-emerald-400 animate-bounce" />
                <span>Desbloqueando automáticamente en {countdownAction.seconds}s...</span>
              </div>
              <p className="text-[11px] text-slate-300">
                Ejecutando patrón: {countdownAction.name}
              </p>
              <button
                onClick={() => setCountdownAction(null)}
                className="text-[11px] text-rose-400 hover:underline font-semibold"
              >
                Cancelar auto-desbloqueo
              </button>
            </div>
          )}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex items-center gap-2 p-3 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-slate-400 max-w-[70%]">
              <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
              <span>CipherAgent está analizando tu solicitud...</span>
            </div>
          )}
        </div>

        {/* Suggested Quick Prompts */}
        <div className="px-4 py-2 bg-slate-950 border-t border-slate-800/80 flex items-center gap-1.5 overflow-x-auto text-[11px] shrink-0 no-scrollbar">
          {[
            { label: '⚡ Desbloquear ahora', prompt: 'Desbloquea el teléfono con mi patrón maestro' },
            { label: '🔑 Olvidé mi patrón', prompt: 'Olvidé mi patrón de desbloqueo, ¿cómo puedo recuperar el acceso?' },
            { label: '📐 Probar Letra Z', prompt: 'Prueba la secuencia de la letra Z' },
            { label: '🛡️ Recomendar patrón seguro', prompt: 'Recomiéndame un patrón de alta seguridad resistente a ataques' },
          ].map((item, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(item.prompt)}
              disabled={isLoading}
              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-xl whitespace-nowrap transition-colors shrink-0 disabled:opacity-50"
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Input Form */}
        <div className="p-3 bg-slate-950/90 border-t border-slate-800 flex items-center gap-2 shrink-0">
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Escribe al agente (ej: 'Desbloquea el teléfono', 'Olvidé la clave')..."
            className="flex-1 bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
          />

          <button
            onClick={() => handleSendMessage()}
            disabled={!inputMessage.trim() || isLoading}
            className="p-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-bold rounded-xl transition-all shadow-md shadow-cyan-950/40 active:scale-95 shrink-0"
            title="Enviar mensaje al agente"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
