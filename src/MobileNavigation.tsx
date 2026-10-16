import { LayoutDashboard, Plus, Settings2, ShieldCheck, UserRound } from 'lucide-react';

type Page = 'dashboard' | 'add' | 'edit' | 'settings' | 'profile';

export default function MobileNavigation({ page, onNavigate, cloud = false, hasProfile = false }: {
  page: Page;
  onNavigate: (page: Page) => void;
  cloud?: boolean;
  hasProfile?: boolean;
}) {
  return <>
    <span className="mobile-header-badge"><ShieldCheck size={15} />{cloud ? 'Saved in cloud' : 'On this device'}</span>
    <nav className={`mobile-nav${hasProfile ? ' has-profile' : ''}`} aria-label="Mobile navigation">
      <button
        className={page === 'dashboard' ? 'active' : ''}
        aria-label="Go to dashboard"
        aria-current={page === 'dashboard' ? 'page' : undefined}
        onClick={() => onNavigate('dashboard')}
      >
        <LayoutDashboard size={22} /><span>Dashboard</span>
      </button>
      <button
        className={`mobile-nav-add ${page === 'add' || page === 'edit' ? 'active' : ''}`}
        aria-label="Create an expense"
        aria-current={page === 'add' || page === 'edit' ? 'page' : undefined}
        onClick={() => onNavigate('add')}
      >
        <span className="mobile-add-icon"><Plus size={23} /></span><span>Add expense</span>
      </button>
      <button
        className={page === 'settings' ? 'active' : ''}
        aria-label="Open budget and category settings"
        aria-current={page === 'settings' ? 'page' : undefined}
        onClick={() => onNavigate('settings')}
      >
        <Settings2 size={22} /><span>Settings</span>
      </button>
      {hasProfile && <button className={page === 'profile' ? 'active' : ''} aria-label="Open your profile" aria-current={page === 'profile' ? 'page' : undefined} onClick={() => onNavigate('profile')}><UserRound size={22}/><span>Profile</span></button>}
    </nav>
  </>;
}
