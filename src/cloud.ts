import type { Data } from './domain';
import { validateData } from './storage';

export type CloudSnapshot = { data: Data; revision: number };
export class CloudError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/${path}`, {
      ...options,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...options.headers },
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new CloudError('Could not reach cloud storage. Your change has not been confirmed. Check your connection and try again.', 0);
  }
  let payload: any;
  try { payload = await response.json(); } catch {
    throw new CloudError('The cloud backend is not responding correctly. Check that it is running; your browser data is still intact.', response.status);
  }
  if (!response.ok) throw new CloudError(payload.error || 'Cloud request failed. Please try again.', response.status);
  return payload;
}
export async function readCloud(): Promise<CloudSnapshot> {
  const snapshot = await api<CloudSnapshot>('data');
  if (!Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0) throw new Error('The cloud data version is invalid.');
  return { data: validateData(snapshot.data), revision: snapshot.revision };
}
export async function writeCloud(data: Data, revision: number) {
  const result = await api<{ revision: number }>('data', { method: 'PUT', body: JSON.stringify({ data, revision }) });
  if (!Number.isSafeInteger(result.revision) || result.revision !== revision + 1) throw new Error('Cloud save could not be confirmed. Reload to check the latest data.');
  return result.revision;
}
