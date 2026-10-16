import { useEffect, useRef, useState } from 'react';
import { Cloud, LockKeyhole, ShieldCheck, Upload, Wallet } from 'lucide-react';
import App from './App';
import { api, CloudError, readCloud, writeCloud, type CloudSnapshot } from './cloud';
import { loadData, validateData } from './storage';
import { initialData, type Data } from './domain';
import './cloud.css';

export default function CloudWorkspace() {
  const [phase, setPhase] = useState<'loading' | 'login' | 'import' | 'ready' | 'error'>('loading');
  const [snapshot, setSnapshot] = useState<CloudSnapshot | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const revision = useRef(0);
  const local = loadData();
  const hasLocal = !local.error && JSON.stringify(local.data) !== JSON.stringify(initialData());
  async function load() {
    setPhase('loading'); setError('');
    try {
      const next = await readCloud(); revision.current = next.revision; setSnapshot(next);
      setPhase(next.revision === 0 ? 'import' : 'ready');
    } catch (e) {
      if (e instanceof CloudError && e.status === 401) setPhase('login');
      else {setError(e instanceof Error ? e.message : 'Cloud storage is unavailable.'); setPhase('error');}
    }
  }
  useEffect(() => {void load();}, []);
  async function save(data: Data) {revision.current = await writeCloud(data, revision.current);}
  async function migrate(data: Data) {
    setBusy(true); setError('');
    try {
      await save(data); setSnapshot({data, revision: revision.current}); setPhase('ready');
    } catch (e) {setError(e instanceof Error ? e.message : 'Upload failed. Your local data was not deleted.');}
    finally {setBusy(false);}
  }
  async function logout() {
    setBusy(true);
    try {await api('logout', {method: 'POST', body: '{}'}); setSnapshot(null); setPhase('login');}
    catch (e) {throw e instanceof Error ? e : new Error('Sign out failed.');}
    finally {setBusy(false);}
  }
  if (phase === 'ready' && snapshot) return <App cloud={{data: snapshot.data, save, onLogout: logout}} />;
  return <main className="cloud-gate">
    <div className="cloud-brand"><span><Wallet size={25}/></span>bluebook<span>.</span></div>
    <section className="cloud-gate-card" aria-busy={busy || phase === 'loading'}>
      <span className="cloud-gate-icon">{phase === 'login' ? <LockKeyhole size={29}/> : <Cloud size={32}/>}</span>
      {phase === 'loading' ? <><h1>Opening your workspace</h1><p>Your records are being loaded from the cloud.</p></> : null}
      {phase === 'login' ? <><h1>Your money, safely stored.</h1><p>Sign in to your private cloud workspace. Your records follow you across devices.</p>
        <form onSubmit={async e => {
          e.preventDefault(); setBusy(true); setError('');
          try {await api('login', {method: 'POST', body: JSON.stringify({password})}); setPassword(''); await load();}
          catch (e) {setError(e instanceof Error ? e.message : 'Sign in failed.');}
          finally {setBusy(false);}
        }}><div className="form-field"><label htmlFor="workspace-password">Workspace password</label><input id="workspace-password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></div><button className="button primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button></form>
      </> : null}
      {phase === 'import' ? <><h1>A safer home for your data.</h1><p>Your cloud workspace is empty. Bring your existing records with you, or begin a new workspace.</p>
        {hasLocal && <div className="migration-preview"><strong>{local.data.transactions.length} existing transactions</strong><span>Categories, monthly budgets, and settings will be included.</span><button className="button primary" disabled={busy} onClick={() => void migrate(local.data)}><Upload size={17}/>Upload this browser’s data</button></div>}
        <div className="form-field"><label htmlFor="backup-file">Import a Bluebook JSON backup</label><input id="backup-file" type="file" accept=".json,application/json" disabled={busy} onChange={async e => {
          const file = e.target.files?.[0]; if (!file) return;
          try {if (file.size > 10 * 1024 * 1024) throw new Error('Choose a backup smaller than 10 MB.'); const data = validateData(JSON.parse(await file.text())); await migrate(data);}
          catch (e) {setError(e instanceof Error ? e.message : 'Invalid backup file.');}
        }}/></div>
        <p className="migration-note"><ShieldCheck size={16}/>Your browser’s original data will stay untouched.</p>
        <button className="button secondary" disabled={busy} onClick={() => setPhase('ready')}>Continue without importing</button>
      </> : null}
      {phase === 'error' ? <><h1>Let’s reconnect.</h1><p>Your existing records have not been replaced. Check the backend configuration and connection.</p><button className="button primary" onClick={() => void load()}>Retry connection</button></> : null}
      {error && <p className="cloud-error" role="alert">{error}</p>}
      {busy && phase === 'import' && <p role="status" className="inline-success">Uploading and verifying your records…</p>}
    </section>
    <p className="cloud-gate-foot"><ShieldCheck size={15}/>Private workspace · Stored in MongoDB</p>
  </main>;
}
