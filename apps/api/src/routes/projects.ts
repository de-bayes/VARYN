import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { projects } from '../db/schema.js';
import { authMiddleware } from '../lib/middleware.js';

const projectRoutes = new Hono();
projectRoutes.use('*', authMiddleware);

const createSchema = z.object({ name: z.string().min(1).max(200) });

// POST /projects
projectRoutes.post('/', async (c) => {
  const userId = c.get('userId') as string;
  const body = createSchema.safeParse(await c.req.json());
  if (!body.success) return c.json({ error: 'validation', message: body.error.message }, 400);

  const [project] = await db.insert(projects).values({
    userId,
    name: body.data.name,
  }).returning();

  return c.json(project, 201);
});

// GET /projects (list user's projects)
projectRoutes.get('/', async (c) => {
  const userId = c.get('userId') as string;
  const rows = await db.select().from(projects).where(eq(projects.userId, userId)).orderBy(projects.updatedAt);
  return c.json(rows);
});

// GET /projects/:id
projectRoutes.get('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const [project] = await db.select().from(projects).where(
    and(eq(projects.id, c.req.param('id')), eq(projects.userId, userId))
  ).limit(1);
  if (!project) return c.json({ error: 'not_found', message: 'Project not found' }, 404);
  return c.json(project);
});

export { projectRoutes };
