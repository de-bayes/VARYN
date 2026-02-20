import { Context, Next } from 'hono';
import { verifyToken } from './auth.js';

export async function authMiddleware(c: Context, next: Next) {
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
}
