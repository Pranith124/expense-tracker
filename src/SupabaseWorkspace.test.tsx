// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initialData } from './domain';

const mocks = vi.hoisted(() => ({
  listener: null as null | ((event: string, session: any) => void),
  getSession: vi.fn(), signUp: vi.fn(), signInWithPassword: vi.fn(), resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(), signOut: vi.fn(), unsubscribe: vi.fn(), readWorkspace: vi.fn(), saveWorkspace: vi.fn(),
}));
vi.mock('./supabase', () => ({
  supabase: { auth: {
    onAuthStateChange: (callback: typeof mocks.listener) => { mocks.listener = callback; return { data: { subscription: { unsubscribe: mocks.unsubscribe } } }; },
    getSession: mocks.getSession, signUp: mocks.signUp, signInWithPassword: mocks.signInWithPassword,
    resetPasswordForEmail: mocks.resetPasswordForEmail, updateUser: mocks.updateUser, signOut: mocks.signOut,
  } }, readWorkspace: mocks.readWorkspace, saveWorkspace: mocks.saveWorkspace,
}));
import SupabaseWorkspace from './SupabaseWorkspace';

const session = (id = 'user-one', name = 'Prane') => ({ user: { id, email: `${id}@example.com`, user_metadata: { full_name: name } } });
async function boot(event = 'INITIAL_SESSION', value: any = null) {
  render(<SupabaseWorkspace/>);
  act(() => { mocks.listener!(event, value); });
}
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); window.scrollTo = vi.fn();
  mocks.getSession.mockResolvedValue({ error: null });
  mocks.signUp.mockResolvedValue({ data: { session: null }, error: null });
  mocks.signInWithPassword.mockResolvedValue({ error: null });
  mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
  mocks.updateUser.mockResolvedValue({ error: null });
  mocks.readWorkspace.mockResolvedValue({ data: initialData(), revision: 1 });
  mocks.saveWorkspace.mockResolvedValue(2);
  mocks.signOut.mockImplementation(async () => { mocks.listener!('SIGNED_OUT', null); return { error: null }; });
});
afterEach(cleanup);

describe('Supabase accounts', () => {
  it('signs in with an email and shows authentication failures', async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: new Error('Invalid login credentials') });
    await boot(); const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email address'), 'hello@example.com');
    await user.type(screen.getByLabelText('Password'), 'a-long-password');
    await user.click(screen.getAllByRole('button', { name: 'Sign in' })[1]);
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: 'hello@example.com', password: 'a-long-password' });
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid login credentials');
  });
  it('registers a named account and waits for email confirmation', async () => {
    await boot(); const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Sign up' }));
    await user.type(screen.getByLabelText('Full name'), 'Prane');
    await user.type(screen.getByLabelText('Email address'), 'prane@example.com');
    await user.type(screen.getByLabelText('Password', { exact: true }), 'long-password-123');
    await user.type(screen.getByLabelText('Confirm password'), 'long-password-123');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(mocks.signUp).toHaveBeenCalledWith(expect.objectContaining({ options: { data: { full_name: 'Prane' }, emailRedirectTo: window.location.origin } }));
    expect(await screen.findByRole('status')).toHaveTextContent('Check your email');
    expect(screen.queryByText('Your money, at a glance.')).not.toBeInTheDocument();
  });
  it('rejects mismatched sign-up passwords before calling Auth', async () => {
    await boot(); const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Sign up' }));
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Prane' } });
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'p@example.com' } });
    fireEvent.change(screen.getByLabelText('Password', { exact: true }), { target: { value: 'long-password-123' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'different-password' } });
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Passwords do not match'); expect(mocks.signUp).not.toHaveBeenCalled();
  });
  it('sends a reset link and handles the recovery event', async () => {
    await boot(); const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Forgot password?' }));
    await user.type(screen.getByLabelText('Email address'), 'prane@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith('prane@example.com', { redirectTo: window.location.origin });
    act(() => mocks.listener!('PASSWORD_RECOVERY', session()));
    await user.type(screen.getByLabelText('New password'), 'new-password-123');
    await user.type(screen.getByLabelText('Confirm password'), 'new-password-123');
    await user.click(screen.getByRole('button', { name: 'Save new password' }));
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: 'new-password-123' });
    expect(await screen.findByText('Your money, at a glance.')).toBeInTheDocument();
  });
  it('updates the profile, offers phone navigation, and signs out', async () => {
    await boot('INITIAL_SESSION', session()); const user = userEvent.setup();
    expect(await screen.findByText('Your money, at a glance.')).toBeInTheDocument();
    const triggers = screen.getAllByRole('button', { name: 'Open your profile' }); expect(triggers).toHaveLength(2);
    await user.click(triggers[0]);
    await user.clear(screen.getByLabelText('Full name')); await user.type(screen.getByLabelText('Full name'), 'Prane Kumar');
    await user.click(screen.getByRole('button', { name: 'Save profile' }));
    expect(mocks.updateUser).toHaveBeenCalledWith({ data: { full_name: 'Prane Kumar' } });
    expect(await screen.findByRole('status')).toHaveTextContent('Profile updated');
    act(() => mocks.listener!('USER_UPDATED', session('user-one', 'Prane Kumar')));
    expect(screen.getByText('Prane Kumar')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByText('Welcome back.')).toBeInTheDocument();
    expect(screen.queryByText('Your profile')).not.toBeInTheDocument();
  });
  it('clears the previous workspace when accounts change', async () => {
    await boot('INITIAL_SESSION', session());
    expect(await screen.findByText('Your money, at a glance.')).toBeInTheDocument();
    mocks.readWorkspace.mockResolvedValue({ data: initialData(), revision: 0 });
    act(() => mocks.listener!('SIGNED_IN', session('user-two', 'Another user')));
    expect(await screen.findByText('Your new workspace')).toBeInTheDocument();
    expect(mocks.readWorkspace).toHaveBeenLastCalledWith('user-two');
    expect(screen.queryByText('Prane')).not.toBeInTheDocument();
  });
  it('keeps a transaction form open when cloud saving fails', async () => {
    mocks.saveWorkspace.mockRejectedValue(new Error('Your records changed in another tab or device.'));
    await boot('INITIAL_SESSION', session()); const user = userEvent.setup();
    await user.click((await screen.findAllByRole('button', { name: 'Add transaction' }))[0]);
    await user.type(screen.getByLabelText(/Amount spent/), '100');
    await user.selectOptions(screen.getByLabelText(/Category/), 'category-0');
    await user.click(screen.getByRole('button', { name: 'Save transaction' }));
    await waitFor(() => expect(mocks.saveWorkspace).toHaveBeenCalledWith(expect.objectContaining({ transactions: expect.arrayContaining([expect.objectContaining({ amount: 10000 })]) }), 1));
    expect(await screen.findByRole('alert')).toHaveTextContent('records changed');
    expect(screen.getByLabelText(/Amount spent/)).toHaveValue('100');
  });
});
