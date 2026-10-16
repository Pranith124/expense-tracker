import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
import { MongoClient, MongoServerError } from 'mongodb';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp, emptySnapshot, type Repository, type Snapshot } from './app';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
loadEnv({path: path.join(root, '.env.server'), quiet: true});
const uri = process.env.MONGODB_URI;
const password = process.env.APP_PASSWORD;
const sessionSecret = process.env.SESSION_SECRET;
const production = process.env.NODE_ENV === 'production';
const publicOrigin = process.env.PUBLIC_ORIGIN?.replace(/\/$/, '');
if (!uri || !/^mongodb(\+srv)?:\/\//.test(uri) || !password || password.length < 12 || !sessionSecret || sessionSecret.length < 32 || (production && !publicOrigin?.startsWith('https://'))) {
  console.error('Configure MONGODB_URI, APP_PASSWORD (12+ characters), SESSION_SECRET (32+ characters), and PUBLIC_ORIGIN (HTTPS in production). See .env.server.example.');
  process.exit(1);
}

const client = new MongoClient(uri, {serverSelectionTimeoutMS: 10000, maxPoolSize: 5});
try {
  await client.connect();
  await client.db(process.env.MONGODB_DB || 'bluebook').command({ping: 1});
} catch {
  console.error('Could not connect to MongoDB. Check the URI, database user, and Atlas IP access list. Credentials were not logged.');
  await client.close();
  process.exit(1);
}
const collection = client.db(process.env.MONGODB_DB || 'bluebook').collection<Snapshot & {_id: string; updatedAt: Date}>('workspace');
const repository: Repository = {
  async read() {const record = await collection.findOne({_id: 'personal'}); return record ? {data: record.data, revision: record.revision} : emptySnapshot();},
  async write(data, expectedRevision) {
    try {
      const result = await collection.updateOne({_id: 'personal', revision: expectedRevision}, {$set: {data, updatedAt: new Date()}, $inc: {revision: 1}}, {upsert: expectedRevision === 0, writeConcern: {w: 'majority'}});
      return result.modifiedCount || result.upsertedCount ? expectedRevision + 1 : null;
    } catch (e) {if (e instanceof MongoServerError && e.code === 11000) return null; throw e;}
  },
};
const app = createApp(repository, {password, sessionSecret, production, publicOrigin});
app.use(express.static(path.join(root, 'dist')));
app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(root, 'dist', 'index.html')));
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = (err as {status?: number})?.status;
  if (status === 413) return res.status(413).json({error: 'This workspace exceeds the 10 MB upload limit. Export your data before making further changes.'});
  if (status === 400) return res.status(400).json({error: 'Invalid JSON request. No changes were saved.'});
  console.error('An API request failed; no database credentials were logged.');
  res.status(503).json({error: 'Cloud storage is temporarily unavailable. Your change has not been confirmed. Please try again.'});
});
const server = app.listen(Number(process.env.PORT || 3001), '0.0.0.0', () => console.log(`Bluebook backend ready on port ${process.env.PORT || 3001}.`));
const shutdown = () => {server.close(() => {void client.close().then(() => process.exit(0));});};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
