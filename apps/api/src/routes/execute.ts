import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import { projects, datasets, runs, artifacts } from '../db/schema.js';
import { authMiddleware } from '../lib/middleware.js';
import { getDownloadUrl, uploadBuffer } from '../lib/storage.js';
import { RUNNER_TIMEOUT_SECONDS, STORAGE_PREFIX } from '@varyn/shared';
import type { RunnerRequest, RunnerResponse } from '@varyn/shared';

const executeRoutes = new Hono();
executeRoutes.use('*', authMiddleware);

const executeSchema = z.object({
  command: z.string().min(1).max(2000),
  datasetId: z.string().uuid().optional(),
});

const RUNNER_URL = process.env.RUNNER_URL || 'http://localhost:6274';

// POST /projects/:projectId/execute
executeRoutes.post('/', async (c) => {
  const userId = c.get('userId') as string;
  const projectId = c.req.param('projectId');
  const body = executeSchema.safeParse(await c.req.json());
  if (!body.success) return c.json({ error: 'validation', message: body.error.message }, 400);

  // Verify project ownership
  const [project] = await db.select({ id: projects.id }).from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId))).limit(1);
  if (!project) return c.json({ error: 'not_found', message: 'Project not found' }, 404);

  // Resolve dataset
  let datasetUrl = '';
  let datasetFilename = '';
  if (body.data.datasetId) {
    const [ds] = await db.select().from(datasets)
      .where(and(eq(datasets.id, body.data.datasetId), eq(datasets.projectId, projectId))).limit(1);
    if (!ds) return c.json({ error: 'not_found', message: 'Dataset not found' }, 404);
    datasetUrl = await getDownloadUrl(ds.storageKey);
    datasetFilename = ds.filename;
  }

  const runId = crypto.randomUUID();
  const runnerPayload: RunnerRequest = {
    runId,
    projectId,
    command: body.data.command,
    datasetUrl,
    datasetFilename,
    timeoutSeconds: RUNNER_TIMEOUT_SECONDS,
  };

  // Call runner synchronously
  let runnerResult: RunnerResponse;
  try {
    const resp = await fetch(`${RUNNER_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(runnerPayload),
      signal: AbortSignal.timeout((RUNNER_TIMEOUT_SECONDS + 5) * 1000),
    });
    runnerResult = await resp.json() as RunnerResponse;
  } catch (err) {
    runnerResult = {
      status: 'error',
      tables: [],
      plots: [],
      logs: `Runner error: ${err instanceof Error ? err.message : 'Unknown error'}`,
      durationMs: 0,
    };
  }

  // Save run record
  const [run] = await db.insert(runs).values({
    id: runId,
    projectId,
    datasetId: body.data.datasetId ?? null,
    command: body.data.command,
    status: runnerResult.status,
    logs: runnerResult.logs,
    durationMs: runnerResult.durationMs,
  }).returning();

  // Save artifacts
  const artifactRefs = [];

  for (const table of runnerResult.tables) {
    const key = `${STORAGE_PREFIX.exports}/${projectId}/${nanoid()}-${table.title.replace(/\s+/g, '_')}.json`;
    await uploadBuffer(key, Buffer.from(JSON.stringify(table)), 'application/json');
    const [art] = await db.insert(artifacts).values({
      runId, projectId, kind: 'table', title: table.title, storageKey: key,
    }).returning();
    artifactRefs.push({ id: art.id, kind: art.kind, title: art.title, storageKey: art.storageKey, createdAt: art.createdAt.toISOString() });
  }

  for (const plot of runnerResult.plots) {
    const key = `${STORAGE_PREFIX.plots}/${projectId}/${nanoid()}-${plot.title.replace(/\s+/g, '_')}.png`;
    await uploadBuffer(key, Buffer.from(plot.pngBase64, 'base64'), 'image/png');
    const [art] = await db.insert(artifacts).values({
      runId, projectId, kind: 'plot', title: plot.title, storageKey: key,
    }).returning();
    artifactRefs.push({ id: art.id, kind: art.kind, title: art.title, storageKey: art.storageKey, createdAt: art.createdAt.toISOString() });
  }

  return c.json({
    runId: run.id,
    status: run.status,
    artifacts: artifactRefs,
    logs: run.logs,
    durationMs: run.durationMs,
  });
});

export { executeRoutes };
