import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { auth } from './routes/auth.js';
import { projectRoutes } from './routes/projects.js';
import { datasetRoutes } from './routes/datasets.js';
import { executeRoutes } from './routes/execute.js';
import { artifactRoutes } from './routes/artifacts.js';

const app = new Hono();

app.use('*', logger());
app.use('*', cors({
  origin: (process.env.CORS_ORIGINS || 'http://localhost:3001').split(','),
  credentials: true,
}));

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }));

// Routes
app.route('/auth', auth);
app.route('/projects', projectRoutes);
app.route('/projects/:projectId/datasets', datasetRoutes);
app.route('/projects/:projectId/execute', executeRoutes);
app.route('/artifacts', artifactRoutes);

const port = Number(process.env.PORT) || 4000;

serve({ fetch: app.fetch, port }, () => {
  console.log(`Varyn API listening on :${port}`);
});
