import express from 'express';
import rateLimit from 'express-rate-limit';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { initialData, validDate, type Data } from '../src/domain';

export type Snapshot = { data: Data; revision: number };
export type Repository = {
  read: () => Promise<Snapshot>;
  write: (data: Data, expectedRevision: number) => Promise<number | null>;
};
export type Config = { password: string; sessionSecret: string; production: boolean; publicOrigin?: string };

const paise = z.number().int().min(0).max(100000000000);
const id = z.string().min(1).max(100).refine(s => !['__proto__', 'constructor', 'prototype'].includes(s));
export const dataSchema = z.object({
  version: z.literal(1),
  categories: z.array(z.object({id, name: z.string().trim().min(1).max(40), color: z.string().regex(/^#[\da-fA-F]{6}$/), icon: z.string().min(1).max(40)})).min(1),
  transactions: z.array(z.object({id, categoryId: id, date: z.string().refine(validDate), time: z.string().regex(/^$|^([01]\d|2[0-3]):[0-5]\d$/), amount: paise.refine(n => n > 0), remarks: z.string().max(2000), createdAt: z.number().finite()})),
  deletionLog: z.array(z.object({transactionId: id, reason: z.string().trim().min(1).max(1000), deletedAt: z.number().int().nonnegative().safe()})).optional(),
  budgets: z.record(z.string().regex(/^(19\d{2}|[2-9]\d{3})-(0[1-9]|1[0-2])$/), z.record(id, paise)),
  heatThresholds: z.array(paise).length(3).refine(a => a[0] > 0 && a[0] < a[1] && a[1] < a[2]),
  budgetThresholds: z.tuple([z.number().positive(), z.number().max(100)]).refine(a => a[0] < a[1]),
}).superRefine((d, ctx) => {
  const ids = new Set(d.categories.map(c => c.id));
  const names = new Set(d.categories.map(c => c.name.toLowerCase()));
  if (ids.size !== d.categories.length || names.size !== d.categories.length || new Set(d.transactions.map(t => t.id)).size !== d.transactions.length || d.transactions.some(t => !ids.has(t.categoryId)) || Object.values(d.budgets).some(b => Object.keys(b).some(k => !ids.has(k)))) {
    ctx.addIssue({code: 'custom', message: 'Duplicate or unknown category/transaction IDs.'});
  }
});

function equal(a: string, b: string) {
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
}

export function createApp(repository: Repository, config: Config) {
  const app = express();
  app.disable('x-powered-by');
  // Hosting providers generally place one proxy in front of the Node process.
  if (config.production) app.set('trust proxy', 1);
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
    if (req.path.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (!req.is('application/json')) return res.status(415).json({error: 'JSON is required.'});
      const origin = req.get('Origin');
      const expected = config.publicOrigin || `${req.protocol}://${req.get('host')}`;
      if (origin && origin !== expected) return res.status(403).json({error: 'This request origin is not allowed.'});
    }
    next();
  });
  app.use(express.json({limit: '10mb'}));
  const sign = (payload: string) => createHmac('sha256', config.sessionSecret).update(`${payload}:${config.password}`).digest('base64url');
  const authenticated = (req: express.Request) => {
    const raw = req.headers.cookie?.split(';').map(c => c.trim()).find(c => c.startsWith('bluebook_session='))?.slice('bluebook_session='.length);
    if (!raw) return false;
    const [expires, signature] = raw.split('.');
    return !!expires && !!signature && /^\d+$/.test(expires) && Number(expires) > Date.now() && equal(sign(expires), signature);
  };
  const cookieOptions = {httpOnly: true, secure: config.production, sameSite: 'strict' as const, path: '/'};
  app.post('/api/login', rateLimit({windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, message: {error: 'Too many attempts. Try again in 15 minutes.'}}), (req, res) => {
    if (typeof req.body?.password !== 'string' || !equal(req.body.password, config.password)) return res.status(401).json({error: 'Incorrect workspace password.'});
    const expires = String(Date.now() + 7 * 24 * 60 * 60 * 1000);
    res.cookie('bluebook_session', `${expires}.${sign(expires)}`, {...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000});
    res.json({ok: true});
  });
  app.post('/api/logout', (_req, res) => {res.clearCookie('bluebook_session', cookieOptions); res.json({ok: true});});
  app.get('/api/health', (_req, res) => res.json({ok: true}));
  app.use('/api', (req, res, next) => {if (!authenticated(req)) return res.status(401).json({error: 'Sign in to your workspace.'}); next();});
  app.get('/api/data', async (_req, res, next) => {try {res.json(await repository.read());} catch (e) {next(e);}});
  app.put('/api/data', async (req, res, next) => {
    const parsed = z.object({data: dataSchema, revision: z.number().int().nonnegative().safe()}).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error: 'Invalid expense data. No changes were saved.'});
    try {
      const revision = await repository.write(parsed.data.data, parsed.data.revision);
      if (revision === null) return res.status(409).json({error: 'Your data changed on another tab or device. Export any unsaved details, then reload to get the latest records before saving.'});
      res.json({revision});
    } catch (e) {next(e);}
  });
  app.use('/api', (_req, res) => res.status(404).json({error: 'API endpoint not found.'}));
  return app;
}

export const emptySnapshot = (): Snapshot => ({data: initialData(), revision: 0});
