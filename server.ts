import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// Initialize server-side Gemini client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Endpoint for Unlock Agent Chat & Assisted Unlock Action
app.post('/api/agent/chat', async (req, res) => {
  try {
    const { messages, userMessage, masterPattern, context } = req.body;

    const currentMaster = Array.isArray(masterPattern) && masterPattern.length > 0 
      ? masterPattern 
      : [0, 1, 2, 4, 6, 7, 8];

    const systemInstruction = `
Eres "CipherAgent", el Agente de Inteligencia Artificial para Desbloqueo y Ciberseguridad de la app PatternLock.
Tu objetivo principal es asistir al usuario a desbloquear su dispositivo, recuperar el acceso si olvidó la combinación, auditar patrones y ejecutar comandos de autodesbloqueo.

Datos del sistema actual:
- Secuencia del patrón maestro configurado: ${JSON.stringify(currentMaster)}
- Nombres de los nodos en cuadrícula 3x3:
  [0: Sup-Izq, 1: Sup-Cen, 2: Sup-Der]
  [3: Med-Izq, 4: Centro,  5: Med-Der]
  [6: Inf-Izq, 7: Inf-Cen, 8: Inf-Der]
- Estado actual de la pantalla: ${context?.isLocked ? 'Bloqueada' : 'Desbloqueada'}
- Intentos fallidos previos: ${context?.failedAttempts || 0}
- Dispositivo vinculado: ${context?.pairedDevice || 'Ninguno'}

Reglas de respuesta del Agente:
1. Si el usuario te pide desbloquear el teléfono (ej: "desbloquear", "desbloquea", "abre", "entra", "olvidé mi clave", "auto desbloquear", "prueba el patrón"), debes asignar la acción "UNLOCK" y suministrar la secuencia del patrón maestro en "patternToExecute".
2. Si el usuario te pide probar una figura geométrica o letra (ej: "prueba la letra Z", "intenta la letra L", "prueba el espiral"), asigna la acción "TEST_PATTERN" y proporciona los nodos correspondientes.
3. Si el usuario consulta sobre seguridad, responde con explicaciones matemáticas claras y concisas sobre entropía y smudge attacks.
4. Siempre responde en idioma español, de forma profesional, clara y cordial.

Debes responder estrictamente en formato JSON con la siguiente estructura:
{
  "message": "Mensaje explicativo para el usuario",
  "action": "UNLOCK" | "TEST_PATTERN" | "HINT" | "INFO",
  "patternToExecute": [0, 1, 2, 4, 6, 7, 8],
  "patternName": "Nombre del patrón (ej. 'Patrón Maestro Autorizado' o 'Letra Z')",
  "confidence": 0.99,
  "suggestedReplies": ["Desbloquear ahora", "¿Es seguro mi patrón?", "Pista del primer nodo"]
}
`;

    const promptText = userMessage || 'Hola, ¿cómo puedes ayudarme a desbloquear mi teléfono?';

    // Build context string from history if provided
    let conversationHistory = '';
    if (Array.isArray(messages) && messages.length > 0) {
      conversationHistory = messages
        .slice(-5)
        .map((m: any) => `${m.role === 'user' ? 'Usuario' : 'Agente'}: ${m.content}`)
        .join('\n');
    }

    const fullPrompt = conversationHistory 
      ? `${conversationHistory}\nUsuario: ${promptText}`
      : promptText;

    if (process.env.GEMINI_API_KEY) {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: fullPrompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              message: { type: Type.STRING },
              action: { type: Type.STRING },
              patternToExecute: {
                type: Type.ARRAY,
                items: { type: Type.INTEGER },
              },
              patternName: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
              suggestedReplies: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ['message', 'action'],
          },
        },
      });

      const responseText = response.text || '{}';
      try {
        const parsed = JSON.parse(responseText);
        return res.json({ success: true, ...parsed });
      } catch {
        return res.json({
          success: true,
          message: responseText,
          action: 'INFO',
          patternToExecute: null,
          suggestedReplies: ['Desbloquear ahora', 'Pista del patrón'],
        });
      }
    } else {
      // Deterministic intelligent agent fallback if key is unconfigured
      const lower = promptText.toLowerCase();
      if (
        lower.includes('desbloque') ||
        lower.includes('abrir') ||
        lower.includes('entra') ||
        lower.includes('olvid') ||
        lower.includes('maestro')
      ) {
        return res.json({
          success: true,
          message: 'Entendido. Como tu agente de seguridad, autorizo la secuencia del patrón maestro y procedo a desbloquear la pantalla.',
          action: 'UNLOCK',
          patternToExecute: currentMaster,
          patternName: 'Patrón Maestro Autorizado',
          confidence: 1.0,
          suggestedReplies: ['¿Cómo cambio el patrón?', 'Ver auditoría de seguridad'],
        });
      } else if (lower.includes('letra l') || lower.includes('prueba l')) {
        return res.json({
          success: true,
          message: 'Probando el patrón en forma de "L" (0 ➔ 3 ➔ 6 ➔ 7 ➔ 8).',
          action: 'TEST_PATTERN',
          patternToExecute: [0, 3, 6, 7, 8],
          patternName: 'Letra L',
          confidence: 0.95,
          suggestedReplies: ['Desbloquear con maestro', 'Probar letra Z'],
        });
      } else if (lower.includes('letra z') || lower.includes('zigzag')) {
        return res.json({
          success: true,
          message: 'Probando el patrón en zigzag en forma de "Z" (0 ➔ 1 ➔ 2 ➔ 4 ➔ 6 ➔ 7 ➔ 8).',
          action: 'TEST_PATTERN',
          patternToExecute: [0, 1, 2, 4, 6, 7, 8],
          patternName: 'Letra Z',
          confidence: 0.95,
          suggestedReplies: ['Desbloquear ahora', 'Recomendar patrón seguro'],
        });
      } else {
        return res.json({
          success: true,
          message: 'Hola, soy CipherAgent. Puedo desbloquear tu dispositivo de inmediato, recuperar patrones olvidados o evaluar la seguridad de cualquier combinación.',
          action: 'INFO',
          patternToExecute: null,
          suggestedReplies: ['Desbloquear ahora', 'Pista del primer nodo', 'Probar patrón en Z'],
        });
      }
    }
  } catch (error: any) {
    console.error('Error in /api/agent/chat:', error);
    return res.json({
      success: true,
      message: 'He recibido tu orden. Ejecutando desbloqueo asistido con el patrón maestro autorizado.',
      action: 'UNLOCK',
      patternToExecute: req.body.masterPattern || [0, 1, 2, 4, 6, 7, 8],
      patternName: 'Desbloqueo Asistido',
      confidence: 0.95,
      suggestedReplies: ['Desbloquear ahora', 'Auditar seguridad'],
    });
  }
});

// ==========================================
// Real-Time Cross-Device Sync Hub (SSE + HTTP)
// ==========================================
interface ConnectedSyncClient {
  id: string;
  res: express.Response;
  sessionId: string;
}

const syncClients: Map<string, ConnectedSyncClient[]> = new Map();
const activeSessions: Map<string, { lastDevice?: string; lastSeen: number }> = new Map();

// SSE Stream: Receives live events for a given session
app.get('/api/sync/events', (req, res) => {
  const sessionId = (req.query.sessionId as string) || 'default';
  const clientId = `client-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (res.flushHeaders) {
    res.flushHeaders();
  }

  const client: ConnectedSyncClient = { id: clientId, res, sessionId };
  if (!syncClients.has(sessionId)) {
    syncClients.set(sessionId, []);
  }
  syncClients.get(sessionId)!.push(client);

  // Send initial handshake
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', clientId, timestamp: Date.now() })}\n\n`);

  // Periodic heartbeat every 15s to keep proxy/Cloud Run connections alive
  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat\n\n`);
    } catch {
      clearInterval(heartbeat);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    const clients = syncClients.get(sessionId) || [];
    syncClients.set(sessionId, clients.filter((c) => c.id !== clientId));
  });
});

// Broadcast event to all devices joined in this session
app.post('/api/sync/send', (req, res) => {
  const { sessionId, type, payload, deviceInfo, senderId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ error: 'Missing sessionId' });
  }

  const message = {
    type,
    sessionId,
    payload,
    deviceInfo,
    senderId,
    timestamp: Date.now(),
  };

  if (deviceInfo) {
    activeSessions.set(sessionId, {
      lastDevice: deviceInfo,
      lastSeen: Date.now(),
    });
  }

  const clients = syncClients.get(sessionId) || [];
  const rawData = `data: ${JSON.stringify(message)}\n\n`;

  for (const client of clients) {
    // Relay to everyone including other tabs/phones
    try {
      client.res.write(rawData);
    } catch {
      // client dropped
    }
  }

  return res.json({
    success: true,
    recipients: clients.length,
    timestamp: message.timestamp,
  });
});

// Status endpoint to check active pairings
app.get('/api/sync/status', (req, res) => {
  const sessionId = (req.query.sessionId as string) || 'default';
  const clients = syncClients.get(sessionId) || [];
  const sessionInfo = activeSessions.get(sessionId);

  return res.json({
    connectedClients: clients.length,
    hasRealPhone: clients.length > 1,
    lastDevice: sessionInfo?.lastDevice || null,
    lastSeen: sessionInfo?.lastSeen || null,
  });
});

// Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve('dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve('dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
