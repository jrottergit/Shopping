import React from 'react';
import { createRoot } from 'react-dom/client';
import { initialize } from './db';
import App from './App';
import './styles.css';

initialize()
  .then(() => {
    createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  })
  .catch(() => {
    const root = document.getElementById('root')!;
    root.innerHTML =
      '<main class="startup-error"><h1>Korb konnte nicht starten.</h1><p>Die lokale Speicherung ist gerade nicht verfügbar. Öffne die App in Safari mit erlaubter Speicherung und versuche es erneut.</p><button onclick="location.reload()">Erneut versuchen</button></main>';
  });
