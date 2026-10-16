import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import CloudWorkspace from './CloudWorkspace';
import SupabaseWorkspace from './SupabaseWorkspace';
import './styles.css';
import './mobile.css';
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode>{import.meta.env.VITE_STORAGE_MODE === 'supabase' ? <SupabaseWorkspace /> : import.meta.env.VITE_STORAGE_MODE === 'cloud' ? <CloudWorkspace /> : <App />}</React.StrictMode>);
