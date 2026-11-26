// Express application setup (middleware order matters - read top to bottom).
// server.js imports createApp() and starts the HTTP server; tests import
// createApp() directly and call it with Supertest, without opening a port.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/env.js';
import { createSessionMiddleware } from './config/session.js';
import { pool } from './db/client.js';
import { verifyOrigin } from './middleware/csrf.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { createRateLimiters } from './middleware/rateLimiters.js';
import { createApiRouter } from './routes/index.js';

const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');

export function createApp({ rateLimits = config.rateLimits } = {}) {
  const app = express();

  // Behind a reverse proxy (nginx, a load balancer) that terminates HTTPS,
  // trust X-Forwarded-* so secure cookies and client IPs work.
  if (config.trustProxy) app.set('trust proxy', config.trustProxy);

  // Security headers (Content-Security-Policy, X-Content-Type-Options, ...).
  app.use(helmet());

  // Only our own frontend origin(s) may call the API with cookies.
  app.use(cors({ origin: config.clientOrigins, credentials: true }));

  app.use(express.json({ limit: '100kb' }));
  app.use(createSessionMiddleware(pool));

  // Refuse state-changing requests coming from other websites.
  app.use('/api', verifyOrigin(config.clientOrigins));
  app.use('/api', createApiRouter(createRateLimiters(rateLimits)));
  app.use('/api', notFound);

  // Optional: serve the built React app from the same Express process.
  if (config.serveClient && fs.existsSync(clientDist)) {
    app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
    // Any non-API GET returns index.html so React Router can handle the URL.
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
