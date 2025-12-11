/**
 * @file components/DepositForm.tsx
 * @description Form for depositing ETH as collateral for bidding
 */

import { useState, useEffect } from 'react';
import { useAccount, useBalance, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';
import { getAuctionAddress } from '../services/api';

interface DepositFormProps {
  className?: string;
}

export function DepositForm({ className = '' }: DepositFormProps) {
  const { address, isConnected } = useAccount();
  const [amount, setAmount] = useState('');
  const [auctionAddress, setAuctionAddress] = useState<`0x${string}` | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Get wallet balance
  const { data: balance, refetch: refetchBalance } = useBalance({
    address: address,
  });

  // Fetch auction contract address
  useEffect(() => {
    async function fetchAuctionAddress() {
      try {
        const result = await getAuctionAddress();
        if (result.address) {
          setAuctionAddress(result.address as `0x${string}`);
        }
      } catch (err) {
        console.error('Failed to fetch auction address:', err);
      }
    }
    fetchAuctionAddress();
  }, []);

  // Send transaction hook
  const { sendTransaction, data: txHash, isPending } = useSendTransaction();

  // Wait for transaction
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Refetch balance after successful deposit
  useEffect(() => {
    if (isSuccess) {
      refetchBalance();
      setAmount('');
    }
  }, [isSuccess, refetchBalance]);

  function handleDeposit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (balance && parseFloat(amount) > parseFloat(balance.formatted)) {
      setError(`Amount exceeds your wallet balance of ${parseFloat(balance.formatted).toFixed(4)} ETH`);
      return;
    }

    if (!auctionAddress) {
      setError('Auction contract address not available');
      return;
    }

    sendTransaction({
      to: auctionAddress,
      value: parseEther(amount),
    });
  }

  if (!isConnected) {
    return (
      <div className={`deposit-form ${className}`}>
        <h2>Deposit Collateral</h2>
        <p>Please connect your wallet to deposit collateral</p>
      </div>
    );
  }

  return (
    <div className={`deposit-form ${className}`}>
      <h2>Deposit Collateral</h2>
      <p className="subtitle">
        Deposit ETH as collateral to place bids. Collateral is locked when you're the highest bidder.
      </p>

      {auctionAddress && (
        <p className="contract-info">
          Auction Contract: <code>{auctionAddress}</code>
        </p>
      )}

      <p className="balance-info">
        Wallet Balance: <strong>
          {balance ? `${parseFloat(balance.formatted).toFixed(4)} ETH` : 'Loading...'}
        </strong>
        {balance && parseFloat(balance.formatted) > 0 && (
          <button
            type="button"
            className="max-button"
            onClick={() => setAmount(parseFloat(balance.formatted).toFixed(4))}
            disabled={isPending || isConfirming}
          >
            Use Max
          </button>
        )}
      </p>

      <form onSubmit={handleDeposit}>
        <div className="form-group">
          <label htmlFor="deposit-amount">Amount (ETH)</label>
          <input
            id="deposit-amount"
            type="number"
            step="0.0001"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            disabled={isPending || isConfirming}
          />
        </div>

        {error && <div className="error-message">{error}</div>}

        {isSuccess && txHash && (
          <div className="success-message">
            <p>✅ Deposit successful!</p>
            <p>Transaction: <code>{txHash}</code></p>
            <a
              href={`https://sepolia.basescan.org/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View on Basescan
            </a>
          </div>
        )}

        <button type="submit" disabled={isPending || isConfirming || !amount || !auctionAddress}>
          {isPending ? 'Confirming...' : isConfirming ? 'Processing...' : 'Deposit'}
        </button>
      </form>
    </div>
  );
}
