import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ToastProvider } from './components/Toast';
import { EditorialProvider } from './store/editorial';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Élément racine introuvable');

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <ToastProvider>
      <EditorialProvider>
        <App />
      </EditorialProvider>
    </ToastProvider>
  </React.StrictMode>,
);
