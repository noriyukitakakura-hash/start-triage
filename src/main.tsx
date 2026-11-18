import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import { I18nProvider } from '@/i18n';
import { SettingsProvider } from '@/app/SettingsProvider';
import { registerServiceWorker } from '@/lib/pwa';
import './index.css';

const container = document.getElementById('root');
if (container === null) throw new Error('#root not found');

// オフライン動作のため登録する。失敗してもアプリは通常どおり動く
registerServiceWorker();

createRoot(container).render(
  <StrictMode>
    <I18nProvider>
      <SettingsProvider>
        <App />
      </SettingsProvider>
    </I18nProvider>
  </StrictMode>,
);
