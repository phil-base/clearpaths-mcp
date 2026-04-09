import { createServer as createHttpServer } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ClearpathsClient } from './clearpaths-client.js';
import { createServer } from './server.js';

const MAX_BODY_BYTES = 1024 * 1024; // 1 MB
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 60 * 1000; // check every minute
const MAX_SESSIONS = 100;

interface Session {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
  tokenHash: string;
  lastActivity: number;
}

const sessions = new Map<string, Session>();

const CLEARPATHS_URL = process.env.CLEARPATHS_URL!;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

function parseBody(req: import('node:http').IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        req.destroy();
        reject(new Error('Request body too large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString();
      if (!raw) return resolve(undefined);
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function json(res: import('node:http').ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function closeSession(sessionId: string): Promise<void> {
  const session = sessions.get(sessionId);
  if (!session) return;
  sessions.delete(sessionId);
  try {
    await session.transport.close();
    await session.server.close();
  } catch {
    // best-effort cleanup
  }
  console.error(`[Clearpaths MCP] Session expired: ${sessionId}`);
}

function startSessionCleanup(): void {
  setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions) {
      if (now - session.lastActivity > SESSION_TTL_MS) {
        closeSession(id);
      }
    }
  }, CLEANUP_INTERVAL_MS);
}

/**
 * Validate a token by making a lightweight API call.
 * Returns true if the token is accepted by the clearpaths API.
 */
async function validateToken(token: string): Promise<boolean> {
  const client = new ClearpathsClient(CLEARPATHS_URL, token);
  try {
    await client.getGoalSummary();
    return true;
  } catch {
    return false;
  }
}

export async function startHttpServer(port: number): Promise<void> {
  startSessionCleanup();

  const httpServer = createHttpServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Session-Id',
        'Access-Control-Expose-Headers': 'Mcp-Session-Id',
        'Access-Control-Max-Age': '86400',
      });
      res.end();
      return;
    }

    // Health check
    if (req.url === '/health') {
      json(res, 200, { status: 'ok', sessions: sessions.size });
      return;
    }

    // Only handle /mcp
    if (req.url !== '/mcp') {
      json(res, 404, { error: 'Not found' });
      return;
    }

    // Every request must carry a Bearer token
    const token = extractBearerToken(req.headers['authorization']);
    if (!token) {
      json(res, 401, { error: 'Missing Authorization: Bearer <token> header' });
      return;
    }

    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (req.method === 'POST') {
      let body: unknown;
      try {
        body = await parseBody(req);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Bad request';
        json(res, 400, { error: message });
        return;
      }

      // Existing session — verify token matches and route to transport
      if (sessionId && sessions.has(sessionId)) {
        const session = sessions.get(sessionId)!;
        if (hashToken(token) !== session.tokenHash) {
          json(res, 401, { error: 'Token does not match session' });
          return;
        }
        session.lastActivity = Date.now();
        await session.transport.handleRequest(req, res, body);
        return;
      }

      // New session — enforce session limit
      if (sessions.size >= MAX_SESSIONS) {
        json(res, 503, { error: 'Too many active sessions. Try again later.' });
        return;
      }

      // Validate token against the clearpaths API before creating a session
      const valid = await validateToken(token);
      if (!valid) {
        json(res, 401, { error: 'Invalid or expired API token' });
        return;
      }

      const tHash = hashToken(token);

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          const mcpServer = serverRef;
          sessions.set(id, { transport, server: mcpServer, tokenHash: tHash, lastActivity: Date.now() });
          console.error(`[Clearpaths MCP] Session created: ${id}`);
        },
      });

      transport.onclose = () => {
        const id = [...sessions.entries()].find(([, s]) => s.transport === transport)?.[0];
        if (id) {
          sessions.delete(id);
          console.error(`[Clearpaths MCP] Session closed: ${id}`);
        }
      };

      const client = new ClearpathsClient(CLEARPATHS_URL, token);
      const mcpServer = createServer(client);
      const serverRef = mcpServer;
      await mcpServer.connect(transport);

      await transport.handleRequest(req, res, body);
      return;
    }

    if (req.method === 'GET') {
      if (sessionId && sessions.has(sessionId)) {
        const session = sessions.get(sessionId)!;
        if (hashToken(token) !== session.tokenHash) {
          json(res, 401, { error: 'Token does not match session' });
          return;
        }
        session.lastActivity = Date.now();
        await session.transport.handleRequest(req, res);
        return;
      }
      json(res, 400, { error: 'Missing or invalid mcp-session-id header' });
      return;
    }

    if (req.method === 'DELETE') {
      if (sessionId && sessions.has(sessionId)) {
        const session = sessions.get(sessionId)!;
        if (hashToken(token) !== session.tokenHash) {
          json(res, 401, { error: 'Token does not match session' });
          return;
        }
        await session.transport.handleRequest(req, res);
        sessions.delete(sessionId);
        console.error(`[Clearpaths MCP] Session deleted: ${sessionId}`);
        return;
      }
      json(res, 400, { error: 'Missing or invalid mcp-session-id header' });
      return;
    }

    json(res, 405, { error: 'Method not allowed' });
  });

  // Bind to loopback only — Apache reverse proxy handles public traffic
  httpServer.listen(port, '127.0.0.1', () => {
    console.error(`[Clearpaths MCP] HTTP server listening on 127.0.0.1:${port}`);
    console.error(`[Clearpaths MCP] MCP endpoint: http://127.0.0.1:${port}/mcp`);
    console.error(`[Clearpaths MCP] Health check: http://127.0.0.1:${port}/health`);
  });
}
