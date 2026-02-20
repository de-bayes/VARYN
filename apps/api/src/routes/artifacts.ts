import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { artifacts } from '../db/schema.js';
import { authMiddleware, type AppEnv } from '../lib/middleware.js';
import { getDownloadUrl } from '../lib/storage.js';

const artifactRoutes = new Hono<AppEnv>();
artifactRoutes.use('*', authMiddleware);

// GET /artifacts/:id — returns a signed download URL
artifactRoutes.get('/:id', async (c) => {
  const [artifact] = await db.select().from(artifacts).where(eq(artifacts.id, c.req.param('id'))).limit(1);
  if (!artifact) return c.json({ error: 'not_found', message: 'Artifact not found' }, 404);

  const url = await getDownloadUrl(artifact.storageKey);
  const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

  return c.json({ url, expiresAt });
});

export { artifactRoutes };
