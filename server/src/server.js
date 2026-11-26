// Entry point: starts a long-running HTTP server (a traditional Express
// process - not serverless) and shuts it down cleanly on SIGINT/SIGTERM.
import { createApp } from './app.js';
import { config } from './config/env.js';
import { disconnectDatabase, prisma } from './db/client.js';

async function start() {
  // Fail fast with a clear message if PostgreSQL is unreachable.
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    console.error('Could not connect to PostgreSQL. Check DATABASE_URL in server/.env and that PostgreSQL is running.');
    console.error(err.message);
    process.exit(1);
  }

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`Attendance API listening on http://localhost:${config.port} (${config.env})`);
  });

  let shuttingDown = false;
  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received - finishing open requests and shutting down...`);

    // Stop accepting new connections; wait for in-flight requests to finish.
    server.close(async () => {
      await disconnectDatabase();
      console.log('Shutdown complete.');
      process.exit(0);
    });
    // Safety net: force exit if something hangs.
    setTimeout(() => process.exit(1), 10_000).unref();
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();
