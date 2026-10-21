import express from 'express';
import 'express-async-errors';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { api } from './routes.js';
import { errorHandler } from './middleware.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:4200' }));
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false }));
  app.use('/api/auth/signup', rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false }));
  app.use('/api', api);
  app.use((req, res) => res.status(404).json({ message: 'Route not found.' }));
  app.use(errorHandler);
  return app;
}
