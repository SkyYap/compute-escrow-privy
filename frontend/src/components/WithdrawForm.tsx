/**
 * @file components/WithdrawForm.tsx
 * @description Component for withdrawing ETH from the Escrow contract
 * 
 * This component allows authenticated users to:
 * - View their escrow balance
 * - Enter an amount to withdraw
 * - Sign and send a transaction to the escrow contract's withdrawFromEscrow function
 * - Funds are sent directly to their wallet address
 * 
 * Why this component exists:
 * - Provides the withdrawal functionality for users to retrieve funds from escrow
 * - Demonstrates direct contract interaction with Privy wallet signing
 * - Shows transaction status and results
 * - Enables users to withdraw their escrow balance to their wallet
 */

import { useState, useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { createPublicClient, http, formatEther, defineChain, parseEther, parseAbi } from 'viem';
import { getEscrowAddress } from '../services/api';
import { RPC_URL, CHAIN_ID } from '../config/constants';

interface WithdrawFormProps {
  className?: string;
}

export function WithdrawForm({ className = '' }: WithdrawFormProps) {
  const { authenticated, user, ready } = usePrivy();
  const { wallets } = useWallets();
  const [amount, setAmount] = useState('');
  const [escrowBalance, setEscrowBalance] = useState<string | null>(null);
  const [escrowAddress, setEscrowAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    transactionHash: string;
    blockNumber: string;
  } | null>(null);

  // Fetch escrow address from backend
  // Why: We need the escrow contract address to interact with it.
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

  // Fetch user's escrow balance from the Escrow contract
  // Why: Users need to see their escrow balance to know how much they can withdraw.
  // We read this directly from the contract's userEscrowBalance mapping.
  useEffect(() => {
    async function fetchEscrowBalance() {
      if (!authenticated || !user?.wallet?.address || !RPC_URL || !escrowAddress) {
        setEscrowBalance(null);
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

        // Escrow contract ABI - only need userEscrowBalance function
        const escrowAbi = parseAbi([
          'function userEscrowBalance(address) external view returns (uint256)',
        ]);

        // Read escrow balance from contract
        const balance = await publicClient.readContract({
          address: escrowAddress as `0x${string}`,
          abi: escrowAbi,
          functionName: 'userEscrowBalance',
          args: [walletAddress as `0x${string}`],
        });

        // Convert wei to ETH
        const balanceEth = formatEther(balance);
        setEscrowBalance(balanceEth);
      } catch (err) {
        console.error('Failed to fetch escrow balance:', err);
        setEscrowBalance(null);
      } finally {
        setBalanceLoading(false);
      }
    }

    fetchEscrowBalance();

    // Refresh escrow balance every 10 seconds
    const interval = setInterval(fetchEscrowBalance, 10000);

    return () => clearInterval(interval);
  }, [authenticated, user, escrowAddress]);

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
  // 3. Sign and send a transaction calling withdrawFromEscrow on the contract
  // 4. Display the result
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

    // Check if amount exceeds escrow balance
    if (escrowBalance && parseFloat(amount) > parseFloat(escrowBalance)) {
      setError(`Amount exceeds your escrow balance of ${parseFloat(escrowBalance).toFixed(4)} ETH`);
      return;
    }

    if (!authenticated || !user?.wallet) {
      setError('You must be connected to withdraw funds');
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
      const wallet = wallets[0];
      
      if (!wallet || !wallet.address) {
        throw new Error('Wallet not available');
      }

      // Get Ethereum provider from Privy wallet
      const { createWalletClient, custom, createPublicClient, http } = await import('viem');
      
      const provider = await wallet.getEthereumProvider();
      
      if (!provider) {
        throw new Error('Wallet provider not available');
      }

      // Create custom transport using Privy's provider
      const transport = custom(provider);

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

      const walletClient = createWalletClient({
        account: wallet.address as `0x${string}`,
        chain: chain,
        transport,
      });

      // Escrow contract ABI - need withdrawFromEscrow function
      const escrowAbi = parseAbi([
        'function withdrawFromEscrow(uint256 amount) external',
      ]);

      // Convert amount to wei
      const amountWei = parseEther(amount);

      // Call withdrawFromEscrow on the contract
      // Why: This function withdraws the specified amount from the user's escrow balance
      // and sends it directly to their wallet address.
      const transactionHash = await walletClient.writeContract({
        address: escrowAddress as `0x${string}`,
        abi: escrowAbi,
        functionName: 'withdrawFromEscrow',
        args: [amountWei],
      });

      // Wait for transaction receipt
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

      // Clear form and refresh balance after a short delay
      setAmount('');
      setTimeout(() => {
        setBalanceLoading(true);
      }, 2000);
    } catch (err) {
      console.error('Withdrawal failed:', err);
      setError(err instanceof Error ? err.message : 'Withdrawal failed');
    } finally {
      setLoading(false);
    }
  }

  if (!authenticated) {
    return (
      <div className={`withdraw-form ${className}`}>
        <h2>Withdraw from Escrow</h2>
        <p>Please connect your wallet to withdraw funds</p>
      </div>
    );
  }

  return (
    <div className={`withdraw-form ${className}`}>
      <h2>Withdraw from Escrow</h2>
      <p className="subtitle">
        Withdraw ETH from your escrow balance to your wallet. The funds will be sent directly to your connected wallet address.
      </p>

      {escrowAddress && (
        <p className="escrow-info">
          Escrow Contract: <code>{escrowAddress}</code>
        </p>
      )}

      {balanceLoading ? (
        <p className="balance-info">
          Escrow Balance: <em>Loading...</em>
        </p>
      ) : escrowBalance !== null ? (
        <p className="balance-info">
          Escrow Balance: <strong>{parseFloat(escrowBalance).toFixed(4)} ETH</strong>
          {parseFloat(escrowBalance) > 0 && (
            <button
              type="button"
              className="max-button"
              onClick={() => setAmount(parseFloat(escrowBalance).toFixed(4))}
              disabled={loading}
            >
              Use Max
            </button>
          )}
        </p>
      ) : (
        <p className="balance-info">
          Escrow Balance: <em>Unable to fetch</em>
        </p>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="withdraw-amount">Amount (ETH)</label>
          <div className="amount-input-wrapper">
            <input
              id="withdraw-amount"
              type="number"
              step="0.000000000000000001"
              min="0"
              max={escrowBalance || undefined}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              disabled={loading}
              className={amount && !isValidAmount(amount) ? 'invalid' : ''}
            />
            {escrowBalance && (
              <span className="max-hint">Max: {parseFloat(escrowBalance).toFixed(4)} ETH</span>
            )}
          </div>
          {amount && !isValidAmount(amount) && (
            <span className="error-text">Amount must be a positive number</span>
          )}
          {amount && escrowBalance && parseFloat(amount) > parseFloat(escrowBalance) && (
            <span className="error-text">Amount exceeds your escrow balance</span>
          )}
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {success && (
          <div className="success-message">
            <p>✅ Withdrawal successful!</p>
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
          {loading ? 'Processing...' : 'Withdraw'}
        </button>
      </form>
    </div>
  );
}

