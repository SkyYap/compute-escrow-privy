/**
 * @file App.tsx
 * @description Main application component with RainbowKit wallet connection
 */

import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { WALLETCONNECT_PROJECT_ID } from './config/constants';
import { ConnectionStatus } from './components/ConnectionStatus';
import { StatsDashboard } from './components/StatsDashboard';
import { DepositForm } from './components/DepositForm';
import { BidForm } from './components/BidForm';
import { WithdrawForm } from './components/WithdrawForm';
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
          <div className="app">
            <header className="app-header">
              <h1>Auction TEE Frontend</h1>
              <p className="subtitle">
                Timeboost-style second-price continuous auction
              </p>
            </header>

            <main className="app-main">
              <section className="connection-section">
                <ConnectionStatus />
              </section>

              <section className="stats-section">
                <StatsDashboard />
              </section>

              <section className="deposit-section">
                <DepositForm />
              </section>

              <section className="bid-section">
                <BidForm />
              </section>

              <section className="withdraw-section">
                <WithdrawForm />
              </section>
            </main>

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
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;
