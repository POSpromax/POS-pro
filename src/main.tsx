import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {AssetRecoveryBoundary} from './components/System/AssetRecoveryBoundary.tsx';
import {installAssetVersionRecovery} from './utils/versionRecovery.ts';
import './index.css';

installAssetVersionRecovery();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AssetRecoveryBoundary>
      <App />
    </AssetRecoveryBoundary>
  </StrictMode>,
);
