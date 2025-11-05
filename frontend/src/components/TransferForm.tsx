/**
 * @file components/TransferForm.tsx
 * @description Component for transferring escrow balance to another address
 * 
 * This component allows authenticated users to:
 * - Enter a recipient address
 * - Enter an amount in ETH
 * - Submit a transfer request to the TEE server
 * 
 * Why this component exists:
 * - Provides the core settlement functionality
 * - Demonstrates authenticated API calls
 * - Shows transaction status and results
 */

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { createPublicClient, http, formatEther, defineChain, parseAbi } from 'viem';
import { transferEscrowBalance, getEscrowAddress } from '../services/api';
import { RPC_URL, CHAIN_ID } from '../config/constants';

interface TransferFormProps {
  className?: string;
}

export function TransferForm({ className = '' }: TransferFormProps) {
  const { authenticated, user, getAccessToken } = usePrivy();
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState<string | null>(null);
  const [escrowAddress, setEscrowAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    transactionHash: string;
    blockNumber: string;
  } | null>(null);

  // Fetch escrow address from backend
  // Why: We need to know which contract this TEE is managing to display
  // it to the user and build block explorer links.
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
  // Why: Users should be able to transfer up to their escrow balance, not their wallet balance.
  // The escrow balance is the amount they've deposited to the contract and is what can be transferred.
  useEffect(() => {
    async function fetchEscrowBalance() {
      if (!authenticated || !user?.wallet?.address || !RPC_URL || !escrowAddress) {
        setMaxAmount(null);
        return;
      }

      try {
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
        // Why: userEscrowBalance is a public mapping, so we can read it directly.
        // This gives us the user's actual escrow balance, not their wallet balance.
        const balance = await publicClient.readContract({
          address: escrowAddress as `0x${string}`,
          abi: escrowAbi,
          functionName: 'userEscrowBalance',
          args: [walletAddress as `0x${string}`],
        });

        // Convert wei to ETH
        const balanceEth = formatEther(balance);
        setMaxAmount(balanceEth);
      } catch (err) {
        console.error('Failed to fetch escrow balance:', err);
        setMaxAmount(null);
      }
    }

    fetchEscrowBalance();

    // Refresh escrow balance every 10 seconds
    // Why: Escrow balance changes when deposits or transfers occur. We poll periodically
    // to keep it up-to-date.
    const interval = setInterval(fetchEscrowBalance, 10000);

    return () => clearInterval(interval);
  }, [authenticated, user, escrowAddress]);

  // Validate Ethereum address format
  // Why: We want to catch invalid addresses before submitting to the server.
  // This provides immediate feedback to the user.
  function isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  // Validate amount format
  // Why: We want to ensure the amount is a valid positive number.
  function isValidAmount(amount: string): boolean {
    const num = parseFloat(amount);
    return !isNaN(num) && num > 0;
  }

  // Handle form submission
  // Why: When the user submits the form, we need to:
  // 1. Validate inputs
  // 2. Get the Privy access token
  // 3. Call the TEE server's /transfer endpoint
  // 4. Display the result
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validate inputs
    // Why: Client-side validation provides immediate feedback and reduces
    // unnecessary API calls.
    if (!recipient.trim()) {
      setError('Recipient address is required');
      return;
    }

    if (!isValidAddress(recipient)) {
      setError('Invalid Ethereum address format');
      return;
    }

    if (!amount.trim()) {
      setError('Amount is required');
      return;
    }

    if (!isValidAmount(amount)) {
      setError('Amount must be a positive number');
      return;
    }

    // Check if amount exceeds user's balance
    // Why: Users shouldn't be able to transfer more than they have.
    if (maxAmount && parseFloat(amount) > parseFloat(maxAmount)) {
      setError(`Amount exceeds your balance of ${parseFloat(maxAmount).toFixed(4)} ETH`);
      return;
    }

    if (!authenticated) {
      setError('You must be connected to transfer funds');
      return;
    }

    try {
      setLoading(true);

      // Get Privy access token
      // Why: The /transfer endpoint requires authentication. We need the token
      // to include in the Authorization header.
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Failed to get access token');
      }

      // Call transfer endpoint
      // Why: The TEE server will validate the request, sign the transaction
      // with the TEE's private key, and submit it to the blockchain.
      const result = await transferEscrowBalance(
        token,
        amount,
        recipient.trim()
      );

      // Display success with transaction details
      // Why: Users want to see the transaction hash so they can track it
      // on a block explorer.
      setSuccess({
        transactionHash: result.transactionHash,
        blockNumber: result.receipt.blockNumber,
      });

      // Clear form
      // Why: After a successful transfer, we clear the form to allow another transfer.
      setRecipient('');
      setAmount('');
    } catch (err) {
      console.error('Transfer failed:', err);
      setError(err instanceof Error ? err.message : 'Transfer failed');
    } finally {
      setLoading(false);
    }
  }

  if (!authenticated) {
    return (
      <div className={`transfer-form ${className}`}>
        <h2>Transfer Escrow Balance</h2>
        <p>Please connect your wallet to transfer funds</p>
      </div>
    );
  }

  return (
    <div className={`transfer-form ${className}`}>
      <h2>Transfer Escrow Balance</h2>
      <p className="subtitle">
        Transfer your escrow balance to another address. The TEE will execute the transaction.
      </p>

      {escrowAddress && (
        <p className="escrow-info">
          Escrow Contract: <code>{escrowAddress}</code>
        </p>
      )}

      {maxAmount !== null && (
        <p className="balance-info">
          Your Escrow Balance: <strong>{parseFloat(maxAmount).toFixed(4)} ETH</strong>
          {parseFloat(maxAmount) > 0 && (
            <button
              type="button"
              className="max-button"
              onClick={() => setAmount(parseFloat(maxAmount).toFixed(4))}
              disabled={loading}
            >
              Use Max
            </button>
          )}
        </p>
      )}
      {maxAmount === null && authenticated && escrowAddress && (
        <p className="balance-info">
          Escrow Balance: <em>Loading...</em>
        </p>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="recipient">Recipient Address</label>
          <input
            id="recipient"
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="0x..."
            disabled={loading}
            className={recipient && !isValidAddress(recipient) ? 'invalid' : ''}
          />
          {recipient && !isValidAddress(recipient) && (
            <span className="error-text">Invalid Ethereum address</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="amount">Amount (ETH)</label>
          <div className="amount-input-wrapper">
            <input
              id="amount"
              type="number"
              step="0.000000000000000001"
              min="0"
              max={maxAmount || undefined}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              disabled={loading}
              className={amount && !isValidAmount(amount) ? 'invalid' : ''}
            />
            {maxAmount && (
              <span className="max-hint">Max: {parseFloat(maxAmount).toFixed(4)} ETH</span>
            )}
          </div>
          {amount && !isValidAmount(amount) && (
            <span className="error-text">Amount must be a positive number</span>
          )}
          {amount && maxAmount && parseFloat(amount) > parseFloat(maxAmount) && (
            <span className="error-text">Amount exceeds your balance</span>
          )}
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {success && (
          <div className="success-message">
            <p>✅ Transfer successful!</p>
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

        <button type="submit" disabled={loading || !recipient || !amount}>
          {loading ? 'Processing...' : 'Transfer'}
        </button>
      </form>
    </div>
  );
}

