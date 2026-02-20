import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import { datasets, projects } from '../db/schema.js';
import { authMiddleware } from '../lib/middleware.js';
import { uploadBuffer, getDownloadUrl } from '../lib/storage.js';
import { STORAGE_PREFIX, MAX_DATASET_SIZE_MB } from '@varyn/shared';

const datasetRoutes = new Hono();
datasetRoutes.use('*', authMiddleware);

// POST /projects/:projectId/datasets — upload a dataset
datasetRoutes.post('/', async (c) => {
  const userId = c.get('userId') as string;
  const projectId = c.req.param('projectId');

  // Verify project ownership
  const [project] = await db.select({ id: projects.id }).from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId))).limit(1);
  if (!project) return c.json({ error: 'not_found', message: 'Project not found' }, 404);

  const formData = await c.req.formData();
  const file = formData.get('file');
  if (!file || !(file instanceof File)) {
    return c.json({ error: 'validation', message: 'file field required' }, 400);
  }

  const allowedExts = ['.csv', '.dta'];
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!allowedExts.includes(ext)) {
    return c.json({ error: 'validation', message: 'Only .csv and .dta files are supported' }, 400);
  }

  if (file.size > MAX_DATASET_SIZE_MB * 1024 * 1024) {
    return c.json({ error: 'validation', message: `File exceeds ${MAX_DATASET_SIZE_MB}MB limit` }, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const storageKey = `${STORAGE_PREFIX.datasets}/${projectId}/${nanoid()}-${file.name}`;
  const contentType = ext === '.csv' ? 'text/csv' : 'application/octet-stream';

  await uploadBuffer(storageKey, buffer, contentType);

  const [dataset] = await db.insert(datasets).values({
    projectId,
    filename: file.name,
    storageKey,
    sizeBytes: file.size,
  }).returning();

  return c.json(dataset, 201);
});

// GET /projects/:projectId/datasets (list)
datasetRoutes.get('/', async (c) => {
  const userId = c.get('userId') as string;
  const projectId = c.req.param('projectId');

  const [project] = await db.select({ id: projects.id }).from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId))).limit(1);
  if (!project) return c.json({ error: 'not_found', message: 'Project not found' }, 404);

  const rows = await db.select().from(datasets).where(eq(datasets.projectId, projectId));
  return c.json(rows);
});

// GET /projects/:projectId/datasets/:datasetId/preview
datasetRoutes.get('/:datasetId/preview', async (c) => {
  const userId = c.get('userId') as string;
  const projectId = c.req.param('projectId');
  const datasetId = c.req.param('datasetId');

  const [project] = await db.select({ id: projects.id }).from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId))).limit(1);
  if (!project) return c.json({ error: 'not_found', message: 'Project not found' }, 404);

  const [dataset] = await db.select().from(datasets)
    .where(and(eq(datasets.id, datasetId), eq(datasets.projectId, projectId))).limit(1);
  if (!dataset) return c.json({ error: 'not_found', message: 'Dataset not found' }, 404);

  // Return metadata + download URL. The web app will render the preview.
  // Full preview generation (head rows, summary stats) happens via the runner at upload time
  // or lazily on first request. For MVP, return what we have.
  return c.json({
    meta: dataset,
    downloadUrl: await getDownloadUrl(dataset.storageKey),
  });
});

export { datasetRoutes };
