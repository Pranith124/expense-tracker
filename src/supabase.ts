import { createClient } from '@supabase/supabase-js';
import { initialData, type Data } from './domain';
import { validateData } from './storage';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = url && key ? createClient(url, key) : null;
export type AccountProfile = { name: string; email: string; save: (name: string) => Promise<void> };

export async function readWorkspace(userId: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.from('workspaces').select('data, revision').eq('user_id', userId).maybeSingle();
  if (error) throw new Error('Could not load your workspace. Check your connection and Supabase database setup.');
  if (data && (!Number.isSafeInteger(Number(data.revision)) || Number(data.revision) < 1)) throw new Error('Your workspace revision is invalid.');
  return data ? { data: validateData(data.data), revision: Number(data.revision) } : { data: initialData(), revision: 0 };
}

export async function saveWorkspace(data: Data, revision: number) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data: next, error } = await supabase.rpc('save_workspace', { payload: validateData(data), expected_revision: revision });
  if (error) {
    if (error.code === '40001') throw new Error('Your records changed in another tab or device. Export any unsaved details, then reload before saving.');
    throw new Error('Could not save your records. Check your connection and try again.');
  }
  if (Number(next) !== revision + 1) throw new Error('Save could not be confirmed. Reload to check your records.');
  return Number(next);
}
