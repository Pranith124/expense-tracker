// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initialData, today, type Data } from './domain';
import { STORAGE_KEY } from './storage';

vi.setConfig({testTimeout: 20000});
afterEach(() => {cleanup(); localStorage.clear(); vi.unstubAllGlobals(); vi.resetModules();});
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
const seed = () => {const data = initialData(); data.transactions = [{id:'local-expense',categoryId:'category-0',date:today(),time:'',amount:10529,remarks:'Existing expense',createdAt:1}]; return data;};
async function boot() {vi.resetModules(); window.scrollTo = vi.fn(); const {default: CloudWorkspace} = await import('./CloudWorkspace'); return render(<CloudWorkspace/>);}

describe('cloud workspace', () => {
  it('uploads existing data only after an explicit migration action and retains the browser copy', async () => {
    const data = seed(); const original = JSON.stringify(data); localStorage.setItem(STORAGE_KEY, original);
    const writes: any[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_path: string, options: RequestInit) => {
      if (options.method === 'PUT') {writes.push(JSON.parse(String(options.body))); return response({revision:1});}
      return response({data:initialData(),revision:0});
    }));
    await boot(); const u = userEvent.setup();
    const upload = await screen.findByRole('button', {name:'Upload this browser’s data'});
    expect(writes).toHaveLength(0);
    await u.click(upload);
    expect(await screen.findByText('Across 1 transaction this month')).toBeInTheDocument();
    expect(writes).toEqual([{data,revision:0}]);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(original);
    expect(screen.getByText('Saved in MongoDB')).toBeInTheDocument();
  });
  it('signs in and loads existing cloud records without replacing them with local data', async () => {
    localStorage.setItem(STORAGE_KEY,JSON.stringify(seed())); let signedIn = false;
    vi.stubGlobal('fetch',vi.fn(async (path:string) => {
      if (path === '/api/login') {signedIn = true; return response({ok:true});}
      return signedIn ? response({data:initialData(),revision:5}) : response({error:'Sign in.'},401);
    }));
    await boot(); const u = userEvent.setup();
    await u.type(await screen.findByLabelText('Workspace password'),'a-private-password');
    await u.click(screen.getByRole('button',{name:'Sign in'}));
    expect(await screen.findByText('Across 0 transactions this month')).toBeInTheDocument();
    expect(screen.queryByText('Existing expense')).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).transactions).toHaveLength(1);
  });
  it('keeps a failed cloud save in the form and does not silently save to localStorage', async () => {
    const original = JSON.stringify(seed()); localStorage.setItem(STORAGE_KEY,original);
    vi.stubGlobal('fetch',vi.fn(async (_path:string, options:RequestInit) => options.method === 'PUT' ? response({error:'Cloud storage unavailable. Try again.'},503) : response({data:initialData(),revision:1})));
    await boot(); const u = userEvent.setup();
    await u.click(await screen.findByRole('button',{name:'Add your first transaction'}));
    await u.type(screen.getByLabelText(/Amount spent/),'500.29');
    await u.selectOptions(screen.getByLabelText(/^Category/),'category-0');
    await u.click(screen.getByRole('button',{name:'Save transaction'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('Cloud storage unavailable');
    expect(screen.getByLabelText(/Amount spent/)).toHaveValue('500.29');
    expect(screen.queryByText(/Transaction added/)).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(original);
  });
  it('confirms a save only after the cloud acknowledges it', async () => {
    let acknowledge: (r: Response) => void = () => {};
    const writes: any[] = [];
    vi.stubGlobal('fetch',vi.fn(async (_path:string, options:RequestInit) => {
      if (options.method === 'PUT') {writes.push(JSON.parse(String(options.body))); return new Promise<Response>(resolve => {acknowledge = resolve;});}
      return response({data:initialData(),revision:3});
    }));
    await boot(); const u = userEvent.setup();
    await u.click(await screen.findByRole('button',{name:'Add your first transaction'}));
    await u.type(screen.getByLabelText(/Amount spent/),'123.45');
    await u.selectOptions(screen.getByLabelText(/^Category/),'category-2');
    await u.click(screen.getByRole('button',{name:'Save transaction'}));
    expect(screen.getByRole('status')).toHaveTextContent('Saving to cloud');
    expect(screen.queryByText(/Transaction added/)).not.toBeInTheDocument();
    expect(writes[0].revision).toBe(3);
    expect(writes[0].data.transactions[0]).toMatchObject({amount:12345,date:today(),time:''});
    await act(async () => {acknowledge(response({revision:4}));});
    expect(await screen.findByRole('status')).toHaveTextContent('Saved to cloud');
    expect(screen.getByText('Across 1 transaction this month')).toBeInTheDocument();
  });
  it('rejects a malformed imported backup without changing local records', async () => {
    const original = JSON.stringify(seed()); localStorage.setItem(STORAGE_KEY,original);
    const fetchMock = vi.fn(async () => response({data:initialData(),revision:0})); vi.stubGlobal('fetch', fetchMock);
    await boot();
    const input = await screen.findByLabelText('Import a Bluebook JSON backup');
    const file = {size:10,text:async()=>'{"version":1}'};
    fireEvent.change(input,{target:{files:[file]}});
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid expense backup');
    expect(fetchMock.mock.calls).toHaveLength(1);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(original);
  });
});
