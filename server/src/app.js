import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import clientsRouter from './routes/clients.js';
import productsRouter from './routes/products.js';
import quotesRouter from './routes/quotes.js';
import { globalLimiter } from './middlewares/rateLimit.js';
import { notFound } from './middlewares/notFound.js';
import { errorHandler } from './middlewares/errorHandler.js';

export const app = express();

if (env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.disable('x-powered-by');
app.use(helmet());
app.use(
  cors({
    origin: env.APP_ORIGIN,
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(pinoHttp({ logger, autoLogging: env.NODE_ENV !== 'test' }));
app.use(globalLimiter);

app.use('/api/v1/health', healthRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/clients', clientsRouter);
app.use('/api/v1/products', productsRouter);
app.use('/api/v1/quotes', quotesRouter);

app.use(notFound);
app.use(errorHandler);
