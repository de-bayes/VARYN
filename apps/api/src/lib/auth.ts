import { SignJWT, jwtVerify } from 'jose';
import { hash, verify } from '@node-rs/argon2';

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'varyn-dev-secret-change-me');
const ISSUER = 'varyn-api';
const EXPIRATION = '7d';

export async function hashPassword(password: string): Promise<string> {
  return hash(password);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return verify(hash, password);
}

export async function signToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setExpirationTime(EXPIRATION)
    .sign(secret);
}

export async function verifyToken(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, secret, { issuer: ISSUER });
  return payload.sub as string;
}
