import { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { LockKeyhole, Wallet } from 'lucide-react';
import App from './App';
import { readWorkspace, saveWorkspace, supabase } from './supabase';
import { initialData, type Data } from './domain';
import { loadData, validateData } from './storage';
import './cloud.css';
import './account.css';

export default function SupabaseWorkspace() {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [recovery, setRecovery] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!supabase) { setInitializing(false); return; }
    // INITIAL_SESSION includes sessions restored from email confirmation links.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next); setInitializing(false);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_OUT') setRecovery(false);
    });
    void supabase.auth.getSession().then(({ error }) => {
      if (error) { setError(error.message); setInitializing(false); }
    }).catch(() => { setError('Could not restore your session. Reload and try again.'); setInitializing(false); });
    return () => subscription.unsubscribe();
  }, []);
  if (!supabase) return <Gate><h1>Connect your workspace</h1><p>Supabase setup is required before accounts can be used. Follow SUPABASE_SETUP.md to configure the project URL, publishable key, and database.</p></Gate>;
  if (initializing) return <Gate><h1>Opening Bluebook…</h1></Gate>;
  if (error) return <Gate><h1>Let’s reconnect</h1><p role="alert">{error}</p><button className="button primary" onClick={() => window.location.reload()}>Reload</button></Gate>;
  if (recovery && session) return <AuthForm recovery onRecovered={() => setRecovery(false)}/>;
  if (!session) return <AuthForm/>;
  return <AccountWorkspace key={session.user.id} session={session}/>;
}

function Gate({ children }: { children: React.ReactNode }) {
  return <main className="cloud-gate"><div className="cloud-brand"><span><Wallet size={27}/></span>bluebook<span>.</span></div><section className="cloud-gate-card">{children}</section><p className="cloud-gate-foot">Your money. Your personal workspace.</p></main>;
}

function AuthForm({ recovery = false, onRecovered }: { recovery?: boolean; onRecovered?: () => void }) {
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const creating = mode === 'signup';
  const title = recovery ? 'Choose a new password' : creating ? 'Make room for clarity.' : mode === 'reset' ? 'Reset your password' : 'Welcome back.';
  return <Gate><span className="cloud-gate-icon"><LockKeyhole size={28}/></span><h1>{title}</h1><p>{creating ? 'Create your personal account to track spending anywhere.' : recovery ? 'Set a new password to secure your account.' : mode === 'reset' ? 'We’ll email you a link to reset your password.' : 'Sign in to your own expense workspace.'}</p>
    {!recovery && <div className="auth-tabs" aria-label="Account access"><button className={mode === 'signin' ? 'active' : ''} disabled={busy} onClick={() => { setMode('signin'); setError(''); setNotice(''); }}>Sign in</button><button className={creating ? 'active' : ''} disabled={busy} onClick={() => { setMode('signup'); setError(''); setNotice(''); }}>Sign up</button></div>}
    <form onSubmit={async e => {
      e.preventDefault(); if (!supabase || busy) return; setError(''); setNotice('');
      if ((creating || recovery) && password !== confirm) { setError('Passwords do not match.'); return; }
      if (creating && !name.trim()) { setError('Enter your full name.'); return; }
      setBusy(true);
      try {
        if (recovery) {
          const { error } = await supabase.auth.updateUser({ password }); if (error) throw error;
          onRecovered?.();
        } else if (mode === 'reset') {
          const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin }); if (error) throw error;
          setNotice('If an account exists, you’ll receive a password reset email.');
        } else if (creating) {
          const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name.trim() }, emailRedirectTo: window.location.origin } });
          if (error) throw error;
          if (!data.session) { setNotice('Check your email to confirm your account, then sign in.'); setMode('signin'); setPassword(''); setConfirm(''); }
        } else {
          const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password }); if (error) throw error;
        }
      } catch (e) { setError(e instanceof Error ? e.message : 'Could not complete your request. Please try again.'); }
      finally { setBusy(false); }
    }}>
      {creating && !recovery && <div className="form-field"><label htmlFor="auth-name">Full name</label><input id="auth-name" autoComplete="name" required maxLength={80} value={name} onChange={e => setName(e.target.value)} disabled={busy}/></div>}
      {!recovery && <div className="form-field"><label htmlFor="auth-email">Email address</label><input id="auth-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} disabled={busy}/></div>}
      {(mode !== 'reset' || recovery) && <div className="form-field"><label htmlFor="auth-password">{recovery ? 'New password' : 'Password'}</label><input id="auth-password" type="password" autoComplete={creating || recovery ? 'new-password' : 'current-password'} minLength={creating || recovery ? 12 : undefined} required value={password} onChange={e => setPassword(e.target.value)} disabled={busy}/>{(creating || recovery) && <span className="field-hint">Use at least 12 characters.</span>}</div>}
      {(creating || recovery) && <div className="form-field"><label htmlFor="auth-confirm">Confirm password</label><input id="auth-confirm" type="password" autoComplete="new-password" required value={confirm} onChange={e => setConfirm(e.target.value)} disabled={busy}/></div>}
      {error && <p className="field-error" role="alert">{error}</p>}{notice && <p className="inline-success" role="status">{notice}</p>}
      <button className="button primary" disabled={busy}>{busy ? 'Please wait…' : recovery ? 'Save new password' : creating ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Sign in'}</button>
    </form>
    {!recovery && mode === 'signin' && <button className="text-button auth-reset" disabled={busy} onClick={() => { setMode('reset'); setError(''); setNotice(''); }}>Forgot password?</button>}
  </Gate>;
}

function AccountWorkspace({ session }: { session: Session }) {
  const [snapshot, setSnapshot] = useState<Awaited<ReturnType<typeof readWorkspace>> | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false);
  const revision = useRef(0);
  const userId = session.user.id;
  const local = loadData();
  const hasLocal = !local.error && JSON.stringify(local.data) !== JSON.stringify(initialData());
  useEffect(() => {
    let cancelled = false;
    void readWorkspace(userId).then(next => { if (!cancelled) { revision.current = next.revision; setSnapshot(next); } }).catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [userId]);
  async function logout() { const { error } = await supabase!.auth.signOut(); if (error) throw error; }
  async function save(data: Data) { revision.current = await saveWorkspace(data, revision.current); }
  async function migrate(data: Data) {
    setBusy(true); setError('');
    try { await save(data); setSnapshot({ data, revision: revision.current }); setStarted(true); }
    catch (e) { setError(e instanceof Error ? e.message : 'Import failed.'); }
    finally { setBusy(false); }
  }
  if (!snapshot) return <Gate><h1>{error ? 'Workspace unavailable' : 'Loading your records…'}</h1>{error && <><p role="alert">{error}</p><button className="button primary" onClick={() => window.location.reload()}>Retry</button><button className="button secondary" onClick={() => void logout().catch(e => setError(e.message))}>Sign out</button></>}</Gate>;
  if (!snapshot.revision && !started) return <Gate><h1>Your new workspace</h1><p>Start fresh or import a Bluebook JSON backup. Existing browser and MongoDB records are kept untouched.</p>
    {hasLocal && <button className="button primary" disabled={busy} onClick={() => void migrate(local.data)}>Import this browser’s records</button>}
    <div className="form-field"><label htmlFor="supabase-backup">Import a Bluebook JSON backup</label><input id="supabase-backup" type="file" accept=".json,application/json" disabled={busy} onChange={async e => {
      const file = e.target.files?.[0]; if (!file) return;
      try { if (file.size > 10 * 1024 * 1024) throw new Error('Choose a backup smaller than 10 MB.'); await migrate(validateData(JSON.parse(await file.text()))); }
      catch (e) { setError(e instanceof Error ? e.message : 'Invalid backup.'); }
    }}/></div>
    <button className="button secondary" disabled={busy} onClick={() => setStarted(true)}>Start fresh</button>
    <button className="text-button auth-reset" disabled={busy} onClick={() => void logout().catch(e => setError(e.message))}>Sign out</button>
    {busy && <p role="status">Importing your records…</p>}{error && <p role="alert" className="field-error">{error}</p>}
  </Gate>;
  return <App cloud={{ data: snapshot.data, save, onLogout: logout, provider: 'Supabase', profile: {
    name: typeof session.user.user_metadata.full_name === 'string' ? session.user.user_metadata.full_name : '', email: session.user.email || '',
    save: async name => { const { error } = await supabase!.auth.updateUser({ data: { full_name: name } }); if (error) throw error; },
  } }}/>;
}
