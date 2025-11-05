/**
 * @file components/ConnectionStatus.tsx
 * @description Component showing user connection status and email
 * 
 * This component displays:
 * - Whether the user is connected via Privy
 * - User's email address (fetched from /hello endpoint)
 * - User's wallet address
 * 
 * Why this component exists:
 * - Provides clear feedback about authentication state
 * - Shows user identity information
 * - Demonstrates Privy integration
 */

import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { createPublicClient, http, formatEther, defineChain } from 'viem';
import { getHello, getSettlerAddress } from '../services/api';
import { RPC_URL, CHAIN_ID } from '../config/constants';

interface ConnectionStatusProps {
  className?: string;
}

export function ConnectionStatus({ className = '' }: ConnectionStatusProps) {
  const { authenticated, user, getAccessToken, login, logout, ready } = usePrivy();
  const [email, setEmail] = useState<string | null>(null);
  const [ethBalance, setEthBalance] = useState<string | null>(null);
  const [teeBalance, setTeeBalance] = useState<string | null>(null);
  const [teeAddress, setTeeAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [teeBalanceLoading, setTeeBalanceLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch user email when authenticated
  // Why: The /hello endpoint returns the user's email. We fetch it when
  // the user becomes authenticated to display their email.
  useEffect(() => {
    async function fetchEmail() {
      if (!authenticated) {
        setEmail(null);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        // Get Privy access token
        // Why: The /hello endpoint requires authentication. We need the token
        // to include in the Authorization header.
        const token = await getAccessToken();
        if (!token) {
          throw new Error('Failed to get access token');
        }

        // Call /hello endpoint
        // Why: This endpoint verifies authentication and returns the user's email.
        const result = await getHello(token);
        setEmail(result.email);
      } catch (err) {
        console.error('Failed to fetch email:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch email');
      } finally {
        setLoading(false);
      }
    }

    fetchEmail();
  }, [authenticated, getAccessToken]);

  // Get user's wallet address
  // Why: Privy provides the user's wallet address through the user object.
  // We display it to show which wallet is connected.
  const walletAddress = user?.wallet?.address || null;

  // Fetch ETH balance from blockchain
  // Why: Users want to see their wallet balance to know if they have enough ETH
  // for transactions. We fetch this from the blockchain using viem.
  useEffect(() => {
    async function fetchBalance() {
      if (!authenticated || !walletAddress) {
        setEthBalance(null);
        return;
      }

      if (!RPC_URL) {
        console.error('RPC_URL not configured');
        setEthBalance(null);
        return;
      }

      try {
        setBalanceLoading(true);
        
        // Create public client for reading blockchain data
        // Why: We need a connection to the blockchain to query the balance.
        // We use the RPC_URL from environment variables to support different networks.
        const chain = defineChain({
          id: CHAIN_ID,
          name: 'Custom Chain',
          network: 'custom',
          nativeCurrency: {
            decimals: 18,
            name: 'Ether',
            symbol: 'ETH',
          },
          rpcUrls: {
            default: {
              http: [RPC_URL],
            },
          },
        });

        const publicClient = createPublicClient({
          chain: chain,
          transport: http(RPC_URL),
        });

        // Get balance from blockchain
        // Why: We query the blockchain for the wallet's ETH balance.
        // The balance is returned in wei, so we convert it to ETH.
        const balance = await publicClient.getBalance({
          address: walletAddress as `0x${string}`,
        });

        // Convert wei to ETH and format
        // Why: formatEther converts wei (BigInt) to ETH (string) with proper decimals.
        const balanceEth = formatEther(balance);
        setEthBalance(parseFloat(balanceEth).toFixed(4)); // Show 4 decimal places
      } catch (err) {
        console.error('Failed to fetch balance:', err);
        // Don't set error state for balance - it's not critical
        setEthBalance(null);
      } finally {
        setBalanceLoading(false);
      }
    }

    fetchBalance();

    // Refresh balance every 10 seconds
    // Why: Balance changes when transactions occur. We poll periodically
    // to keep it up-to-date.
    const interval = setInterval(fetchBalance, 10000);

    return () => clearInterval(interval);
  }, [authenticated, walletAddress]);

  // Fetch TEE address and balance
  // Why: Users want to see the TEE's balance to understand its operational status.
  // This helps users verify the TEE has funds to execute transactions.
  useEffect(() => {
    async function fetchTeeInfo() {
      if (!RPC_URL) {
        return;
      }

      try {
        setTeeBalanceLoading(true);
        
        // Get TEE address from backend
        // Why: We need the TEE's public address to query its balance.
        const settlerInfo = await getSettlerAddress();
        const address = settlerInfo.publicKey;
        setTeeAddress(address);

        if (!address) {
          return;
        }

        // Create public client for reading blockchain data
        const chain = defineChain({
          id: CHAIN_ID,
          name: 'Custom Chain',
          network: 'custom',
          nativeCurrency: {
            decimals: 18,
            name: 'Ether',
            symbol: 'ETH',
          },
          rpcUrls: {
            default: {
              http: [RPC_URL],
            },
          },
        });

        const publicClient = createPublicClient({
          chain: chain,
          transport: http(RPC_URL),
        });

        // Get TEE balance from blockchain
        const balance = await publicClient.getBalance({
          address: address as `0x${string}`,
        });

        // Convert wei to ETH and format
        const balanceEth = formatEther(balance);
        setTeeBalance(parseFloat(balanceEth).toFixed(4));
      } catch (err) {
        console.error('Failed to fetch TEE balance:', err);
        setTeeBalance(null);
      } finally {
        setTeeBalanceLoading(false);
      }
    }

    fetchTeeInfo();

    // Refresh TEE balance every 10 seconds
    const interval = setInterval(fetchTeeInfo, 10000);

    return () => clearInterval(interval);
  }, []);

  // Handle connect button click
  // Why: Privy's login() function opens the Privy modal for users to choose
  // their authentication method (wallet or email).
  const handleConnect = async () => {
    try {
      await login();
    } catch (err) {
      console.error('Failed to connect:', err);
      setError('Failed to connect wallet');
    }
  };

  // Handle disconnect button click
  // Why: Logout clears the user's session and disconnects their wallet.
  const handleDisconnect = async () => {
    try {
      await logout();
      setEmail(null);
      setError(null);
    } catch (err) {
      console.error('Failed to disconnect:', err);
    }
  };

  if (!authenticated) {
    return (
      <div className={`connection-status ${className}`}>
        <div className="status-indicator disconnected">
          <span>●</span> Not Connected
        </div>
        <p className="status-message">Connect your wallet to get started</p>
        <button 
          className="connect-button"
          onClick={handleConnect}
          disabled={!ready}
        >
          {ready ? 'Connect Wallet' : 'Loading...'}
        </button>
      </div>
    );
  }

  return (
    <div className={`connection-status ${className}`}>
      <div className="status-indicator connected">
        <span>●</span> Connected
      </div>
      
      {loading && <p className="status-message">Loading user info...</p>}
      
      {error && (
        <p className="status-message error">
          Error: {error}
        </p>
      )}
      
      {!loading && !error && email && (
        <p className="status-message">
          Email: <strong>{email}</strong>
        </p>
      )}
      
      {!loading && !error && !email && (
        <p className="status-message">
          Email: <em>Not available</em>
        </p>
      )}
      
      {walletAddress && (
        <div className="wallet-info">
          <p className="wallet-address">
            Wallet: <code>{walletAddress}</code>
          </p>
          {balanceLoading ? (
            <p className="balance">Balance: Loading...</p>
          ) : ethBalance !== null ? (
            <p className="balance">
              Balance: <strong>{ethBalance} ETH</strong>
            </p>
          ) : (
            <p className="balance">Balance: Unable to fetch</p>
          )}
        </div>
      )}

      {teeAddress && (
        <div className="tee-info">
          <p className="tee-address">
            TEE Address: <code>{teeAddress}</code>
          </p>
          {teeBalanceLoading ? (
            <p className="balance">TEE Balance: Loading...</p>
          ) : teeBalance !== null ? (
            <p className="balance">
              TEE Balance: <strong>{teeBalance} ETH</strong>
            </p>
          ) : (
            <p className="balance">TEE Balance: Unable to fetch</p>
          )}
        </div>
      )}

      <button 
        className="disconnect-button"
        onClick={handleDisconnect}
      >
        Disconnect
      </button>
    </div>
  );
}

