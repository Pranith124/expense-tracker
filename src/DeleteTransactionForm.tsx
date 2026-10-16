import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { dateLabel, money, type Transaction } from './domain';

export default function DeleteTransactionForm({ transaction, category, onCancel, onConfirm, saveError }: {
  transaction: Transaction; category?: string; onCancel: () => void;
  onConfirm: (reason: string) => Promise<boolean>; saveError: string;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <form noValidate aria-busy={busy} onSubmit={async e => {
    e.preventDefault(); if (busy) return;
    if (!reason.trim() || reason.trim().length > 1000) { setError('Enter a deletion reason between 1 and 1,000 characters.'); document.getElementById('deletion-reason')?.focus(); return; }
    setBusy(true); setError('');
    try {
      if (!await onConfirm(reason.trim())) setError('Deletion could not be saved. Your transaction is unchanged.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Deletion failed. Please try again.'); }
    finally { setBusy(false); }
  }}>
    <p className="dialog-description">Delete {money(transaction.amount)}{category ? ` for ${category}` : ''} on {dateLabel(transaction.date)}? It will be removed from your spending totals.</p>
    <div className="form-field"><label htmlFor="deletion-reason">Reason for deletion <span>*</span></label><textarea id="deletion-reason" rows={3} maxLength={1000} required value={reason} disabled={busy} onChange={e => { setReason(e.target.value); setError(''); }} aria-invalid={!!error} aria-describedby={error ? 'deletion-error' : 'deletion-hint'} placeholder="For example, duplicate entry or recorded by mistake"/><span className="field-hint" id="deletion-hint">The reason and deletion date will be saved with your records.</span></div>
    {error && <p id="deletion-error" className="field-error" role="alert">{error}{saveError ? ` ${saveError}` : ''}</p>}
    <div className="form-actions"><button className="button secondary" type="button" disabled={busy} onClick={onCancel}>Keep transaction</button><button className="button danger" type="submit" disabled={busy}><Trash2 size={16}/>{busy ? 'Deleting…' : 'Confirm deletion'}</button></div>
  </form>;
}
