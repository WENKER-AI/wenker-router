import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { SessionProvider } from './session.jsx';
import { ThemeProvider } from './theme.jsx';
import { I18nProvider } from './i18n.jsx';
import { ToastProvider } from './toast.jsx';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SessionProvider>
      <ThemeProvider>
        <I18nProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </I18nProvider>
      </ThemeProvider>
    </SessionProvider>
  </React.StrictMode>
);
