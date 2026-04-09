#!/usr/bin/env node
import 'dotenv/config';

const transport = process.env.TRANSPORT ?? 'stdio';

async function main() {
  if (transport === 'http') {
    // HTTP mode: multi-user, token per session from Authorization header
    const { CLEARPATHS_URL } = process.env;
    if (!CLEARPATHS_URL) {
      console.error('[Clearpaths MCP] Missing required env var: CLEARPATHS_URL');
      process.exit(1);
    }

    const port = parseInt(process.env.PORT ?? '3001', 10);
    const { startHttpServer } = await import('./http-server.js');
    await startHttpServer(port);
  } else {
    // Stdio mode: single user, token from env
    const { CLEARPATHS_URL, CLEARPATHS_TOKEN } = process.env;
    if (!CLEARPATHS_URL || !CLEARPATHS_TOKEN) {
      console.error('[Clearpaths MCP] Missing required env vars: CLEARPATHS_URL, CLEARPATHS_TOKEN');
      process.exit(1);
    }

    const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
    const { ClearpathsClient } = await import('./clearpaths-client.js');
    const { createServer } = await import('./server.js');

    const client = new ClearpathsClient(CLEARPATHS_URL, CLEARPATHS_TOKEN);
    const server = createServer(client);
    const stdioTransport = new StdioServerTransport();
    await server.connect(stdioTransport);
    console.error('[Clearpaths MCP] Server running on stdio');
  }
}

main().catch((err) => {
  console.error('[Clearpaths MCP] Fatal error:', err);
  process.exit(1);
});
