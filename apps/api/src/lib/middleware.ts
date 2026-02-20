import { createMiddleware } from 'hono/factory';
import { verifyToken } from './auth.js';

export type AppEnv = { Variables: { userId: string } };

export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    return c.json({ error: 'unauthorized', message: 'Missing or invalid token' }, 401);
  }
  try {
    const userId = await verifyToken(header.slice(7));
    c.set('userId', userId);
    await next();
  } catch {
    return c.json({ error: 'unauthorized', message: 'Invalid or expired token' }, 401);
  }
});
