/**
 * @file components/BidForm.tsx
 * @description Form for placing bids in the Auction contract
 */

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { getAuctionAddress } from '../services/api';

const AUCTION_ABI = [
    {
        name: 'bid',
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
        name: 'nextRoundHighestBid',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
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
        name: 'currentLeader',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'address' }],
    },
    {
        name: 'currentRound',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
    },
] as const;

interface BidFormProps {
    className?: string;
}

export function BidForm({ className = '' }: BidFormProps) {
    const { address, isConnected } = useAccount();
    const [bidAmount, setBidAmount] = useState('');
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

    // Read current highest bid
    const { data: highestBid } = useReadContract({
        address: auctionAddress ?? undefined,
        abi: AUCTION_ABI,
        functionName: 'nextRoundHighestBid',
        query: { enabled: !!auctionAddress },
    });

    // Read current highest bidder
    const { data: highestBidder } = useReadContract({
        address: auctionAddress ?? undefined,
        abi: AUCTION_ABI,
        functionName: 'nextRoundHighestBidder',
        query: { enabled: !!auctionAddress },
    });

    // Read current round
    const { data: currentRound } = useReadContract({
        address: auctionAddress ?? undefined,
        abi: AUCTION_ABI,
        functionName: 'currentRound',
        query: { enabled: !!auctionAddress },
    });

    // Write contract hook for placing bid
    const { writeContract, data: txHash, isPending } = useWriteContract();

    // Wait for transaction
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
        hash: txHash,
    });

    // Refetch collateral after successful bid
    useEffect(() => {
        if (isSuccess) {
            refetchCollateral();
            setBidAmount('');
        }
    }, [isSuccess, refetchCollateral]);

    function handleBid(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        if (!bidAmount || parseFloat(bidAmount) <= 0) {
            setError('Please enter a valid bid amount');
            return;
        }

        const bidWei = parseEther(bidAmount);

        // Check if bid is higher than current highest
        if (highestBid && bidWei <= highestBid) {
            setError(`Bid must be higher than current highest bid (${formatEther(highestBid)} ETH)`);
            return;
        }

        // Check if user has enough collateral
        if (collateralBalance && bidWei > collateralBalance) {
            setError(`Insufficient collateral. You have ${formatEther(collateralBalance)} ETH`);
            return;
        }

        if (!auctionAddress) {
            setError('Auction contract address not available');
            return;
        }

        writeContract({
            address: auctionAddress,
            abi: AUCTION_ABI,
            functionName: 'bid',
            args: [bidWei],
        });
    }

    if (!isConnected) {
        return (
            <div className={`bid-form ${className}`}>
                <h2>Place a Bid</h2>
                <p>Please connect your wallet to place bids</p>
            </div>
        );
    }

    return (
        <div className={`bid-form ${className}`}>
            <h2>Place a Bid</h2>
            <p className="subtitle">
                Bid for leadership of the next round. Winner pays second-highest bid.
            </p>

            {auctionAddress && (
                <p className="contract-info">
                    Auction Contract: <code>{auctionAddress}</code>
                </p>
            )}

            <div className="auction-info">
                <p>Current Round: <strong>{currentRound?.toString() ?? 'Loading...'}</strong></p>
                <p>
                    Your Collateral: <strong>
                        {collateralBalance !== undefined
                            ? `${parseFloat(formatEther(collateralBalance)).toFixed(4)} ETH`
                            : 'Loading...'}
                    </strong>
                </p>
                <p>
                    Highest Bid (Next Round): <strong>
                        {highestBid !== undefined
                            ? `${parseFloat(formatEther(highestBid)).toFixed(4)} ETH`
                            : '0 ETH'}
                    </strong>
                </p>
                {highestBidder && highestBidder !== '0x0000000000000000000000000000000000000000' && (
                    <p>
                        Highest Bidder: <code>{highestBidder}</code>
                    </p>
                )}
            </div>

            <form onSubmit={handleBid}>
                <div className="form-group">
                    <label htmlFor="bid-amount">Bid Amount (ETH)</label>
                    <input
                        id="bid-amount"
                        type="number"
                        step="0.0001"
                        min="0"
                        value={bidAmount}
                        onChange={(e) => setBidAmount(e.target.value)}
                        placeholder="0.0"
                        disabled={isPending || isConfirming}
                    />
                    {highestBid !== undefined && (
                        <span className="hint">
                            Must be greater than {parseFloat(formatEther(highestBid)).toFixed(4)} ETH
                        </span>
                    )}
                </div>

                {error && <div className="error-message">{error}</div>}

                {isSuccess && txHash && (
                    <div className="success-message">
                        <p>✅ Bid placed successfully!</p>
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

                <button type="submit" disabled={isPending || isConfirming || !bidAmount}>
                    {isPending ? 'Confirming...' : isConfirming ? 'Processing...' : 'Place Bid'}
                </button>
            </form>
        </div>
    );
}
