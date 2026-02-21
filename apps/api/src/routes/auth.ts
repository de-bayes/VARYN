import { Hono } from 'hono';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { hashPassword, verifyPassword, signToken } from '../lib/auth.js';

const auth = new Hono();

const signupSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// POST /auth/signup
auth.post('/signup', async (c) => {
  const body = signupSchema.safeParse(await c.req.json());
  if (!body.success) return c.json({ error: 'validation', message: body.error.message }, 400);

  const { email, password, name } = body.data;
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) return c.json({ error: 'conflict', message: 'Email already registered' }, 409);

  const passwordHash = await hashPassword(password);
  const [user] = await db.insert(users).values({ email, name, passwordHash }).returning({ id: users.id, email: users.email, name: users.name, role: users.role });
  const token = await signToken(user.id);

  return c.json({ token, user }, 201);
});

// POST /auth/login
auth.post('/login', async (c) => {
  const body = loginSchema.safeParse(await c.req.json());
  if (!body.success) return c.json({ error: 'validation', message: body.error.message }, 400);

  const { email, password } = body.data;
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) return c.json({ error: 'unauthorized', message: 'Invalid credentials' }, 401);

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) return c.json({ error: 'unauthorized', message: 'Invalid credentials' }, 401);

  const token = await signToken(user.id);
  return c.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

export { auth };
