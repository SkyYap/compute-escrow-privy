/**
 * @file App.tsx
 * @description Main application component with RainbowKit wallet connection and routing
 */

import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { WALLETCONNECT_PROJECT_ID } from './config/constants';
import { NavHeader } from './components/NavHeader';
import { AuctionPage } from './pages/AuctionPage';
import { UniPage } from './pages/UniPage';
import './App.css';

const config = getDefaultConfig({
  appName: 'Auction TEE',
  projectId: WALLETCONNECT_PROJECT_ID || 'demo',
  chains: [baseSepolia],
  ssr: false,
});

const queryClient = new QueryClient();

function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <BrowserRouter>
            <div className="app">
              <NavHeader />

              <Routes>
                <Route path="/" element={<AuctionPage />} />
                <Route path="/uni" element={<UniPage />} />
              </Routes>

              <footer className="app-footer">
                <p>
                  Built with{' '}
                  <a href="https://vitejs.dev" target="_blank" rel="noopener noreferrer">
                    Vite
                  </a>
                  ,{' '}
                  <a href="https://react.dev" target="_blank" rel="noopener noreferrer">
                    React
                  </a>
                  , and{' '}
                  <a href="https://www.rainbowkit.com" target="_blank" rel="noopener noreferrer">
                    RainbowKit
                  </a>
                </p>
              </footer>
            </div>
          </BrowserRouter>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;
