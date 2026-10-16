// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deleteTransaction, initialData, today, type Data } from './domain';
import { loadData, STORAGE_KEY, validateData } from './storage';

afterEach(() => { cleanup(); localStorage.clear(); vi.resetModules(); });
function seeded() {
  const data = initialData(); data.budgets[today().slice(0,7)] = { 'category-0': 50000 };
  data.transactions = [{ id: 'expense-one', categoryId: 'category-0', amount: 10000, date: today(), time: '', remarks: 'Lunch', createdAt: 1 }, { id: 'expense-other-month', categoryId: 'category-1', amount: 20000, date: '2020-01-01', time: '', remarks: 'Old expense', createdAt: 2 }];
  return data;
}
async function boot(cloud = false) {
  vi.resetModules(); localStorage.clear(); window.scrollTo = vi.fn(); const data = seeded();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  const save = vi.fn().mockRejectedValue(new Error('Cloud storage unavailable.'));
  const { default: App } = await import('./App');
  render(<App cloud={cloud ? { data, save, onLogout: vi.fn() } : undefined}/>);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /Edit Food transaction/ }));
  await user.click(screen.getByRole('button', { name: 'Delete transaction' }));
  return { user, save, dialog: screen.getByRole('dialog', { name: 'Delete transaction' }) };
}
describe('transaction deletion', () => {
  it('requires a reason, allows cancellation, and preserves edits', async () => {
    const { user, dialog } = await boot();
    await user.click(within(dialog).getByRole('button', { name: 'Confirm deletion' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Enter a deletion reason');
    fireEvent.change(within(dialog).getByLabelText(/Reason for deletion/), { target: { value: '   ' } });
    await user.click(within(dialog).getByRole('button', { name: 'Confirm deletion' }));
    expect(loadData().data.transactions).toHaveLength(2);
    await user.click(within(dialog).getByRole('button', { name: 'Keep transaction' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Amount spent/)).toHaveValue('100.00');
  });
  it('deletes only the selected transaction, saves its reason, and recalculates the month', async () => {
    const { user, dialog } = await boot();
    await user.type(within(dialog).getByLabelText(/Reason for deletion/), '  Duplicate entry  ');
    await user.click(within(dialog).getByRole('button', { name: 'Confirm deletion' }));
    expect(await screen.findByText('Across 0 transactions this month')).toBeInTheDocument();
    expect(screen.getByText('₹500 remaining')).toBeInTheDocument();
    const data = loadData().data;
    expect(data.transactions.map(t => t.id)).toEqual(['expense-other-month']);
    expect(data.deletionLog).toEqual([{ transactionId: 'expense-one', reason: 'Duplicate entry', deletedAt: expect.any(Number) }]);
    expect(validateData(JSON.parse(JSON.stringify(data))).deletionLog).toEqual(data.deletionLog);
    cleanup(); vi.resetModules(); const { default: App } = await import('./App'); render(<App/>);
    expect(screen.getByText('Across 0 transactions this month')).toBeInTheDocument();
  });
  it('retains the transaction and reason when cloud persistence fails', async () => {
    const { user, dialog, save } = await boot(true);
    await user.type(within(dialog).getByLabelText(/Reason for deletion/), 'Entered by mistake');
    await user.click(within(dialog).getByRole('button', { name: 'Confirm deletion' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('transaction is unchanged');
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ deletionLog: [expect.objectContaining({ reason: 'Entered by mistake' })] }));
    expect(loadData().data.transactions).toHaveLength(2);
    expect(within(dialog).getByLabelText(/Reason for deletion/)).toHaveValue('Entered by mistake');
  });
  it('rejects invalid deletion reasons and invalid backup history', () => {
    const data = seeded();
    expect(() => deleteTransaction(data, 'expense-one', ' ')).toThrow('deletion reason');
    expect(() => deleteTransaction(data, 'expense-one', 'x'.repeat(1001))).toThrow('deletion reason');
    expect(() => deleteTransaction(data, 'missing', 'Duplicate')).toThrow('not be found');
    expect(() => validateData({ ...data, deletionLog: [{ transactionId: 'expense-one', reason: '', deletedAt: 1 }] })).toThrow('deletion history');
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, deletionLog: 'invalid' }));
    expect(loadData().error).toBeTruthy();
    expect(validateData(data)).toEqual(data); // Old backups need no migration.
  });
});
