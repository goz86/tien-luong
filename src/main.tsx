import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Service Worker registration with update detection
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      
      // Check for updates periodically (every 30 minutes)
      setInterval(() => {
        registration.update().catch(() => undefined);
      }, 30 * 60 * 1000);

      // When a new SW is waiting, auto-activate it
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version available — tell SW to skip waiting
            newWorker.postMessage('skipWaiting');
          }
        });
      });

      // When the new SW takes over, reload to get fresh assets
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    } catch {
      // SW registration failed, app still works without it
    }
  });
}

// Detect standalone mode (installed PWA)
if (window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone: boolean }).standalone) {
  document.body.classList.add('pwa-standalone');
}
