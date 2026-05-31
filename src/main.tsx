import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';

// Immediate Startup Watchdog to Capture Blank-Screen/Iframe crashes
const errorFallback = document.createElement('div');
errorFallback.style.cssText = 'position:fixed;top:16px;left:16px;right:16px;background-color:#FFF5F5;border:1px solid #FEB2B2;color:#9B2C2C;padding:24px;border-radius:16px;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;z-index:999999;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);display:none;';
errorFallback.id = 'startup-error-fallback';
errorFallback.innerHTML = `
  <div style="font-weight:700;font-size:18px;margin-bottom:8px;display:flex;items-center:center;gap:8px;">
    <span>âšï¸ Application Loading Error</span>
  </div>
  <p style="font-size:14px;color:#C53030;margin:0 0 16px 0;line-height:1.5;">
    The application failed to initialize. If you are viewing this in an embedded preview, please open the application in a new tab using the "Open in new tab" icon. Browser iframe permissions can sometimes block Firestore connections or local storage keys.
  </p>
  <pre id="startup-error-stack" style="background:#FFF;padding:12px;border-radius:8px;font-family:monospace;font-size:12px;overflow-x:auto;margin:0;border:1px solid #FEE2E2;white-space:pre-wrap;word-break:break-all;"></pre>
`;
document.body.appendChild(errorFallback);

function showStartupError(message: string, stack?: string) {
  errorFallback.style.display = 'block';
  const pre = document.getElementById('startup-error-stack');
  if (pre) {
    pre.textContent = `Error: ${message}\n\nStack:\n${stack || 'No stack trace available'}`;
  }
}

window.addEventListener('error', (event) => {
  showStartupError(event.message, event.error?.stack);
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  showStartupError(reason?.message || 'Unhandled promise rejection', reason?.stack);
});

import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

