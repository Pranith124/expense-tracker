import { useState } from 'react';
import { LogOut, UserRound } from 'lucide-react';
import type { AccountProfile } from './supabase';

export default function Profile({ profile, onLogout }: { profile: AccountProfile; onLogout: () => Promise<void> }) {
  const [name, setName] = useState(profile.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  return <section className="panel profile-panel">
    <div className="panel-heading"><div><h2>Your profile</h2><p>Your account, your personal workspace.</p></div><UserRound size={24}/></div>
    <form className="settings-body" onSubmit={async e => {
      e.preventDefault(); setError(''); setMessage('');
      if (!name.trim() || name.trim().length > 80) { setError('Enter a name between 1 and 80 characters.'); return; }
      setBusy(true);
      try { await profile.save(name.trim()); setMessage('Profile updated.'); }
      catch (e) { setError(e instanceof Error ? e.message : 'Could not update your profile.'); }
      finally { setBusy(false); }
    }}>
      <div className="form-field"><label htmlFor="profile-name">Full name</label><input id="profile-name" autoComplete="name" required maxLength={80} value={name} onChange={e => setName(e.target.value)} disabled={busy}/></div>
      <div className="form-field"><label htmlFor="profile-email">Email address</label><input id="profile-email" type="email" value={profile.email} readOnly/><span className="field-hint">Your sign-in email.</span></div>
      {error && <p role="alert" className="field-error">{error}</p>}
      {message && <p role="status" className="inline-success">{message}</p>}
      <button className="button primary" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
      <button className="button secondary" type="button" disabled={busy} onClick={async () => {
        setBusy(true); setError('');
        try { await onLogout(); } catch (e) { setError(e instanceof Error ? e.message : 'Sign out failed.'); setBusy(false); }
      }}><LogOut size={17}/>Sign out</button>
    </form>
  </section>;
}
