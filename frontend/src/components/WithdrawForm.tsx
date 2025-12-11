/**
 * @file components/WithdrawForm.tsx
 * @description Form for withdrawing collateral from the Auction contract
 */

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { getAuctionAddress } from '../services/api';

const AUCTION_ABI = [
  {
    name: 'withdrawCollateral',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'userCollateral',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'nextRoundHighestBidder',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'nextRoundHighestBid',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

interface WithdrawFormProps {
  className?: string;
}

export function WithdrawForm({ className = '' }: WithdrawFormProps) {
  const { address, isConnected } = useAccount();
  const [amount, setAmount] = useState('');
  const [auctionAddress, setAuctionAddress] = useState<`0x${string}` | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  // Read user's collateral balance
  const { data: collateralBalance, refetch: refetchCollateral } = useReadContract({
    address: auctionAddress ?? undefined,
    abi: AUCTION_ABI,
    functionName: 'userCollateral',
    args: address ? [address] : undefined,
    query: { enabled: !!auctionAddress && !!address },
  });

  // Check if user is highest bidder
  const { data: highestBidder } = useReadContract({
    address: auctionAddress ?? undefined,
    abi: AUCTION_ABI,
    functionName: 'nextRoundHighestBidder',
    query: { enabled: !!auctionAddress },
  });

  // Get highest bid amount (locked if user is highest bidder)
  const { data: highestBid } = useReadContract({
    address: auctionAddress ?? undefined,
    abi: AUCTION_ABI,
    functionName: 'nextRoundHighestBid',
    query: { enabled: !!auctionAddress },
  });

  // Calculate withdrawable amount
  const isHighestBidder = highestBidder?.toLowerCase() === address?.toLowerCase();
  const lockedAmount = isHighestBidder && highestBid ? highestBid : 0n;
  const withdrawableAmount = collateralBalance ? collateralBalance - lockedAmount : 0n;

  // Write contract hook
  const { writeContract, data: txHash, isPending } = useWriteContract();

  // Wait for transaction
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Refetch collateral after successful withdrawal
  useEffect(() => {
    if (isSuccess) {
      refetchCollateral();
      setAmount('');
    }
  }, [isSuccess, refetchCollateral]);

  function handleWithdraw(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    const withdrawWei = parseEther(amount);

    if (withdrawWei > withdrawableAmount) {
      setError(`Amount exceeds withdrawable balance of ${formatEther(withdrawableAmount)} ETH`);
      return;
    }

    if (!auctionAddress) {
      setError('Auction contract address not available');
      return;
    }

    writeContract({
      address: auctionAddress,
      abi: AUCTION_ABI,
      functionName: 'withdrawCollateral',
      args: [withdrawWei],
    });
  }

  if (!isConnected) {
    return (
      <div className={`withdraw-form ${className}`}>
        <h2>Withdraw Collateral</h2>
        <p>Please connect your wallet to withdraw collateral</p>
      </div>
    );
  }

  return (
    <div className={`withdraw-form ${className}`}>
      <h2>Withdraw Collateral</h2>
      <p className="subtitle">
        Withdraw your collateral from the Auction contract. Locked funds cannot be withdrawn.
      </p>

      {auctionAddress && (
        <p className="contract-info">
          Auction Contract: <code>{auctionAddress}</code>
        </p>
      )}

      <div className="balance-info">
        <p>
          Total Collateral: <strong>
            {collateralBalance !== undefined
              ? `${parseFloat(formatEther(collateralBalance)).toFixed(4)} ETH`
              : 'Loading...'}
          </strong>
        </p>
        {isHighestBidder && lockedAmount > 0n && (
          <p className="locked-info">
            🔒 Locked (Highest Bid): <strong>{parseFloat(formatEther(lockedAmount)).toFixed(4)} ETH</strong>
          </p>
        )}
        <p>
          Withdrawable: <strong>
            {parseFloat(formatEther(withdrawableAmount)).toFixed(4)} ETH
          </strong>
          {withdrawableAmount > 0n && (
            <button
              type="button"
              className="max-button"
              onClick={() => setAmount(formatEther(withdrawableAmount))}
              disabled={isPending || isConfirming}
            >
              Use Max
            </button>
          )}
        </p>
      </div>

      <form onSubmit={handleWithdraw}>
        <div className="form-group">
          <label htmlFor="withdraw-amount">Amount (ETH)</label>
          <input
            id="withdraw-amount"
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
            <p>✅ Withdrawal successful!</p>
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

        <button type="submit" disabled={isPending || isConfirming || !amount || withdrawableAmount === 0n}>
          {isPending ? 'Confirming...' : isConfirming ? 'Processing...' : 'Withdraw'}
        </button>
      </form>
    </div>
  );
}
