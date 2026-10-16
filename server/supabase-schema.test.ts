import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initialData } from '../src/domain';

const alice = '11111111-1111-4111-8111-111111111111';
const bob = '22222222-2222-4222-8222-222222222222';
const db = new PGlite();
async function asUser(id: string) {
  await db.exec('reset role; set role authenticated;');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
}
async function save(revision: number, payload: unknown = initialData()) {
  return db.query<{ revision: number }>('select public.save_workspace($1::jsonb, $2::bigint) as revision', [JSON.stringify(payload), revision]);
}
beforeAll(async () => {
  // Reproduce Supabase's Auth boundary and database client roles.
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key);
    insert into auth.users values ('${alice}'), ('${bob}');
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `);
  await db.exec(readFileSync(new URL('../supabase/migrations/202610150001_workspaces.sql', import.meta.url), 'utf8'));
}, 30000);
afterAll(async () => { await db.close(); });

describe('Supabase PostgreSQL ownership and revisions', () => {
  it('creates a workspace using the authenticated identity and rejects stale saves', async () => {
    await asUser(alice);
    expect((await save(0)).rows[0].revision).toBe(1);
    await expect(save(0)).rejects.toMatchObject({ code: '40001' });
    expect((await save(1)).rows[0].revision).toBe(2);
    await expect(save(1)).rejects.toMatchObject({ code: '40001' });
  });
  it('prevents another account from reading or overwriting the owner’s row', async () => {
    await asUser(bob);
    expect((await db.query('select * from public.workspaces')).rows).toEqual([]);
    await expect(save(2)).rejects.toMatchObject({ code: '40001' });
    expect((await save(0)).rows[0].revision).toBe(1);
    const rows = await db.query<{ user_id: string }>('select user_id from public.workspaces');
    expect(rows.rows.map(row => row.user_id)).toEqual([bob]);
    await asUser(alice);
    expect((await db.query<{ revision: number }>('select revision from public.workspaces')).rows[0].revision).toBe(2);
  });
  it('blocks direct writes and deletes so clients cannot bypass revision checks', async () => {
    await asUser(alice);
    await expect(db.exec('update public.workspaces set revision = 999')).rejects.toMatchObject({ code: '42501' });
    await expect(db.exec('delete from public.workspaces')).rejects.toMatchObject({ code: '42501' });
    await expect(db.query('insert into public.workspaces(user_id, data) values ($1, $2::jsonb)', [alice, JSON.stringify(initialData())])).rejects.toMatchObject({ code: '42501' });
  });
  it('blocks anonymous reads and writes', async () => {
    await db.exec('reset role; set role anon;');
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
    await expect(db.exec('select * from public.workspaces')).rejects.toMatchObject({ code: '42501' });
    await expect(save(0)).rejects.toMatchObject({ code: '42501' });
  });
  it('rejects missing identity, invalid revisions, and malformed documents', async () => {
    await asUser('');
    await expect(save(0)).rejects.toMatchObject({ code: '42501' });
    await asUser(alice);
    await expect(save(-1)).rejects.toMatchObject({ code: '22023' });
    await expect(save(2, { version: 1 })).rejects.toMatchObject({ code: '23514' });
    expect((await db.query<{ revision: number }>('select revision from public.workspaces')).rows[0].revision).toBe(2);
  });
});
