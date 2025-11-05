/**
 * @file App.tsx
 * @description Main application component
 * 
 * This is the root component of the application. It sets up:
 * - Privy authentication provider
 * - Main layout and routing
 * - All major feature components
 * 
 * Why this structure:
 * - PrivyProvider wraps the entire app to enable authentication everywhere
 * - Clean separation of concerns with dedicated components
 * - Responsive layout that works on different screen sizes
 */

import { PrivyProvider } from '@privy-io/react-auth';
import { baseSepolia } from 'viem/chains';
import { PRIVY_APP_ID } from './config/constants';
import { ConnectionStatus } from './components/ConnectionStatus';
import { StatsDashboard } from './components/StatsDashboard';
import { DepositForm } from './components/DepositForm';
import { TransferForm } from './components/TransferForm';
import { WithdrawForm } from './components/WithdrawForm';
import './App.css';

function App() {
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        // Configure login methods
        // Why: We support both wallet and email login for flexibility.
        // Users can choose their preferred authentication method.
        loginMethods: ['wallet', 'email'],
        
        // Appearance customization
        // Why: Makes the Privy UI match our app's style.
        appearance: {
          theme: 'light',
          accentColor: '#676FFF',
          logo: 'https://your-logo-url.com/logo.png', // Optional: add your logo
        },
        
        // Embedded wallet configuration
        // Why: Privy's embedded wallet allows users without external wallets
        // to still interact with the app.
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },
        
        // Default chain - use Base Sepolia
        // Why: We're using Base Sepolia testnet for this example (where the contract is deployed).
        // Users can switch chains if needed, but Base Sepolia is the default.
        defaultChain: baseSepolia,
      }}
    >
      <div className="app">
        <header className="app-header">
          <h1>Escrow TEE Frontend</h1>
          <p className="subtitle">
            Interact with the Escrow TEE server using Privy authentication
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

          <section className="transfer-section">
            <TransferForm />
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
            <a href="https://privy.io" target="_blank" rel="noopener noreferrer">
              Privy
            </a>
          </p>
        </footer>
      </div>
    </PrivyProvider>
  );
}

export default App;

