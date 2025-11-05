/**
 * @file components/DepositForm.tsx
 * @description Component for depositing ETH into the Escrow contract
 * 
 * This component allows authenticated users to:
 * - View their Privy wallet ETH balance
 * - Enter an amount to deposit
 * - Sign and send a transaction from their wallet to the escrow contract
 * - The contract's receive() function will automatically add it to their escrow balance
 * 
 * Why this component exists:
 * - Provides the deposit functionality for users to add funds to escrow
 * - Demonstrates Privy wallet transaction signing
 * - Shows transaction status and results
 * - Enables users to fund their escrow account before transferring
 */

import { useState, useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { createPublicClient, http, formatEther, defineChain, parseEther } from 'viem';
import { getEscrowAddress } from '../services/api';
import { RPC_URL, CHAIN_ID } from '../config/constants';

interface DepositFormProps {
  className?: string;
}

export function DepositForm({ className = '' }: DepositFormProps) {
  const { authenticated, user, ready } = usePrivy();
  const { wallets } = useWallets();
  const [amount, setAmount] = useState('');
  const [walletBalance, setWalletBalance] = useState<string | null>(null);
  const [escrowAddress, setEscrowAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    transactionHash: string;
    blockNumber: string;
  } | null>(null);

  // Fetch escrow address from backend
  // Why: We need the escrow contract address to send ETH to it.
  useEffect(() => {
    async function fetchEscrowAddress() {
      try {
        const result = await getEscrowAddress();
        setEscrowAddress(result.address);
      } catch (err) {
        console.error('Failed to fetch escrow address:', err);
      }
    }

    fetchEscrowAddress();
  }, []);

  // Fetch user's wallet balance
  // Why: Users need to see their wallet balance to know how much they can deposit.
  // This is their actual ETH balance, not escrow balance.
  useEffect(() => {
    async function fetchWalletBalance() {
      if (!authenticated || !user?.wallet?.address || !RPC_URL) {
        setWalletBalance(null);
        return;
      }

      try {
        setBalanceLoading(true);
        const walletAddress = user.wallet.address;
        
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

        // Get wallet balance from blockchain
        const balance = await publicClient.getBalance({
          address: walletAddress as `0x${string}`,
        });

        // Convert wei to ETH
        const balanceEth = formatEther(balance);
        setWalletBalance(balanceEth);
      } catch (err) {
        console.error('Failed to fetch wallet balance:', err);
        setWalletBalance(null);
      } finally {
        setBalanceLoading(false);
      }
    }

    fetchWalletBalance();

    // Refresh balance every 10 seconds
    const interval = setInterval(fetchWalletBalance, 10000);

    return () => clearInterval(interval);
  }, [authenticated, user]);

  // Validate amount format
  // Why: We want to ensure the amount is a valid positive number.
  function isValidAmount(amount: string): boolean {
    const num = parseFloat(amount);
    return !isNaN(num) && num > 0;
  }

  // Handle form submission
  // Why: When the user submits the form, we need to:
  // 1. Validate inputs
  // 2. Get the user's wallet from Privy
  // 3. Sign and send a transaction to the escrow contract
  // 4. The contract's receive() function will handle the deposit
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validate inputs
    if (!amount.trim()) {
      setError('Amount is required');
      return;
    }

    if (!isValidAmount(amount)) {
      setError('Amount must be a positive number');
      return;
    }

    // Check if amount exceeds wallet balance
    if (walletBalance && parseFloat(amount) > parseFloat(walletBalance)) {
      setError(`Amount exceeds your wallet balance of ${parseFloat(walletBalance).toFixed(4)} ETH`);
      return;
    }

    if (!authenticated || !user?.wallet) {
      setError('You must be connected to deposit funds');
      return;
    }

    if (!escrowAddress) {
      setError('Escrow contract address not available');
      return;
    }

    if (!RPC_URL) {
      setError('RPC URL not configured');
      return;
    }

    try {
      setLoading(true);

      // Get the user's wallet from Privy
      // Why: Privy provides wallet objects through useWallets hook.
      // We use the first connected wallet to send the transaction.
      const wallet = wallets[0];
      
      if (!wallet || !wallet.address) {
        throw new Error('Wallet not available');
      }

      // Get Ethereum provider from Privy wallet
      // Why: Privy wallets expose getEthereumProvider() which returns an EIP-1193 provider.
      // This provider can be used with viem to send transactions.
      const { createWalletClient, custom, createPublicClient, http } = await import('viem');
      
      // Get the Ethereum provider from the wallet
      const provider = await wallet.getEthereumProvider();
      
      // Create custom transport using Privy's provider
      // Why: viem's custom transport wraps EIP-1193 providers (like Privy's).
      const transport = custom(provider);
      
      // Convert amount to wei
      const amountWei = parseEther(amount);

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

      // Create wallet client using Privy's provider
      const walletClient = createWalletClient({
        account: wallet.address as `0x${string}`,
        chain: chain,
        transport,
      });

      // Send transaction to escrow contract
      // Why: Sending ETH directly to the contract address triggers the receive() function,
      // which automatically adds the amount to the user's escrow balance.
      const transactionHash = await walletClient.sendTransaction({
        to: escrowAddress as `0x${string}`,
        value: amountWei,
      });

      // Wait for transaction receipt
      // Why: We need to wait for the transaction to be mined to confirm it succeeded.
      const publicClient = createPublicClient({
        chain: chain,
        transport: http(RPC_URL),
      });

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: transactionHash,
      });

      // Display success with transaction details
      setSuccess({
        transactionHash,
        blockNumber: receipt.blockNumber.toString(),
      });

      // Clear form and refresh balance
      setAmount('');
      // Refresh balance after a short delay to allow for block confirmation
      setTimeout(() => {
        setBalanceLoading(true);
      }, 2000);
    } catch (err) {
      console.error('Deposit failed:', err);
      setError(err instanceof Error ? err.message : 'Deposit failed');
    } finally {
      setLoading(false);
    }
  }

  if (!authenticated) {
    return (
      <div className={`deposit-form ${className}`}>
        <h2>Deposit to Escrow</h2>
        <p>Please connect your wallet to deposit funds</p>
      </div>
    );
  }

  return (
    <div className={`deposit-form ${className}`}>
      <h2>Deposit to Escrow</h2>
      <p className="subtitle">
        Send ETH from your wallet to the escrow contract. The funds will be added to your escrow balance.
      </p>

      {escrowAddress && (
        <p className="escrow-info">
          Escrow Contract: <code>{escrowAddress}</code>
        </p>
      )}

      {balanceLoading ? (
        <p className="balance-info">
          Wallet Balance: <em>Loading...</em>
        </p>
      ) : walletBalance !== null ? (
        <p className="balance-info">
          Wallet Balance: <strong>{parseFloat(walletBalance).toFixed(4)} ETH</strong>
          {parseFloat(walletBalance) > 0 && (
            <button
              type="button"
              className="max-button"
              onClick={() => setAmount(parseFloat(walletBalance).toFixed(4))}
              disabled={loading}
            >
              Use Max
            </button>
          )}
        </p>
      ) : (
        <p className="balance-info">
          Wallet Balance: <em>Unable to fetch</em>
        </p>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="deposit-amount">Amount (ETH)</label>
          <div className="amount-input-wrapper">
            <input
              id="deposit-amount"
              type="number"
              step="0.000000000000000001"
              min="0"
              max={walletBalance || undefined}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              disabled={loading}
              className={amount && !isValidAmount(amount) ? 'invalid' : ''}
            />
            {walletBalance && (
              <span className="max-hint">Max: {parseFloat(walletBalance).toFixed(4)} ETH</span>
            )}
          </div>
          {amount && !isValidAmount(amount) && (
            <span className="error-text">Amount must be a positive number</span>
          )}
          {amount && walletBalance && parseFloat(amount) > parseFloat(walletBalance) && (
            <span className="error-text">Amount exceeds your wallet balance</span>
          )}
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {success && (
          <div className="success-message">
            <p>✅ Deposit successful!</p>
            <p>Transaction Hash: <code>{success.transactionHash}</code></p>
            <p>Block Number: {success.blockNumber}</p>
            <a
              href={`https://sepolia.basescan.org/tx/${success.transactionHash}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View on Basescan
            </a>
          </div>
        )}

        <button type="submit" disabled={loading || !amount || !escrowAddress || !ready}>
          {loading ? 'Processing...' : 'Deposit'}
        </button>
      </form>
    </div>
  );
}

