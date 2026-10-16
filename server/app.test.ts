import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp, emptySnapshot, type Repository } from './app';
import { initialData, type Data } from '../src/domain';

const password = 'test-workspace-password';
function setup(production = false) {
  let state = emptySnapshot();
  const repository: Repository = {
    read: async () => structuredClone(state),
    write: async (data: Data, revision: number) => {
      if (revision !== state.revision) return null;
      state = {data: structuredClone(data), revision: revision + 1};
      return state.revision;
    },
  };
  const app = createApp(repository, {password, sessionSecret: 'test-secret-at-least-thirty-two-characters', production, publicOrigin: 'https://bluebook.example'});
  return {app, repository};
}
async function signIn(app: ReturnType<typeof createApp>) {
  const response = await request(app).post('/api/login').send({password});
  expect(response.status).toBe(200);
  return response.headers['set-cookie'];
}
describe('private cloud API', () => {
  it('requires authentication before reading or writing financial data', async () => {
    const {app} = setup();
    expect((await request(app).get('/api/data')).status).toBe(401);
    expect((await request(app).put('/api/data').send({data: initialData(), revision: 0})).status).toBe(401);
    expect((await request(app).get('/api/health')).status).toBe(200);
  });
  it('uses private secure cookies and rejects forged or incorrect credentials', async () => {
    const {app} = setup(true);
    expect((await request(app).post('/api/login').send({password: 'wrong'})).status).toBe(401);
    const cookies = await signIn(app);
    expect(String(cookies)).toContain('HttpOnly');
    expect(String(cookies)).toContain('Secure');
    expect(String(cookies)).toContain('SameSite=Strict');
    expect((await request(app).get('/api/data').set('Cookie', 'bluebook_session=9999999999999.forged')).status).toBe(401);
  });
  it('round-trips exact expenses, categories, settings and independent monthly budgets', async () => {
    const {app} = setup(); const cookies = await signIn(app);
    const data = initialData();
    data.transactions = [{id: 'expense-one', categoryId: 'category-0', date: '2026-10-06', time: '', amount: 24529, remarks: 'Lunch', createdAt: 1}];
    data.budgets = {'2026-10': {'category-0': 100000}, '2026-11': {'category-0': 200000}};
    data.heatThresholds = [100, 200, 300]; data.budgetThresholds = [60, 90];
    data.deletionLog = [{transactionId: 'removed-expense', reason: 'Duplicate entry', deletedAt: 1000}];
    const saved = await request(app).put('/api/data').set('Cookie', cookies).send({data, revision: 0});
    expect(saved.status).toBe(200); expect(saved.body.revision).toBe(1);
    const read = await request(app).get('/api/data').set('Cookie', cookies);
    expect(read.body).toEqual({data, revision: 1}); expect(read.headers['cache-control']).toBe('no-store');
  });
  it('rejects stale device writes instead of overwriting newer data', async () => {
    const {app} = setup(); const cookies = await signIn(app);
    const data = initialData();
    expect((await request(app).put('/api/data').set('Cookie', cookies).send({data, revision: 0})).status).toBe(200);
    const stale = {...data, categories: data.categories.map(c => ({...c, name: `New ${c.name}`}))};
    expect((await request(app).put('/api/data').set('Cookie', cookies).send({data: stale, revision: 0})).status).toBe(409);
    expect((await request(app).get('/api/data').set('Cookie', cookies)).body.data).toEqual(data);
  });
  it('validates every incoming snapshot before saving', async () => {
    const {app, repository} = setup(); const cookies = await signIn(app);
    for (const change of [
      {heatThresholds: [300, 200, 100]},
      {deletionLog: [{transactionId: 'removed-expense', reason: '   ', deletedAt: 1000}]},
      {deletionLog: [{transactionId: 'removed-expense', reason: 'Duplicate', deletedAt: -1}]},
      {budgetThresholds: [100, 80]},
      {budgets: {'2026-10': {'unknown-category': 100}}},
      {transactions: [{id:'bad',categoryId:'category-0',date:'2026-02-29',time:'',amount:1,remarks:'',createdAt:1}]},
      {transactions: [{id:'bad',categoryId:'category-0',date:'2026-10-06',time:'',amount:0.5,remarks:'',createdAt:1}]},
    ]) {
      const response = await request(app).put('/api/data').set('Cookie', cookies).send({data: {...initialData(), ...change}, revision: 0});
      expect(response.status).toBe(400);
    }
    expect((await repository.read()).revision).toBe(0);
  });
  it('rejects cross-origin mutation requests and non-JSON forms', async () => {
    const {app} = setup(); const cookies = await signIn(app);
    expect((await request(app).put('/api/data').set('Cookie', cookies).set('Origin', 'https://other.example').send({data: initialData(), revision: 0})).status).toBe(403);
    expect((await request(app).post('/api/login').type('form').send({password})).status).toBe(415);
  });
  it('rate-limits repeated password attempts', async () => {
    const {app} = setup();
    for (let i = 0; i < 10; i++) await request(app).post('/api/login').send({password: 'wrong'});
    expect((await request(app).post('/api/login').send({password: 'wrong'})).status).toBe(429);
  });
  it('clears the session cookie on sign out', async () => {
    const {app} = setup(); const cookies = await signIn(app);
    const response = await request(app).post('/api/logout').set('Cookie', cookies).send({});
    expect(response.status).toBe(200); expect(String(response.headers['set-cookie'])).toContain('Expires=Thu, 01 Jan 1970');
  });
});
