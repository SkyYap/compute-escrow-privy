/**
 * @file components/uni/EarningsPanel.tsx
 * @description Panel showing accumulated fees and withdraw functionality
 */

import { useEffect, useState } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatEther, formatUnits } from 'viem';
import { LEADER_FEE_HOOK_ADDRESS, LEADER_FEE_HOOK_ABI, TOKENS, USDC_ADDRESS, NATIVE_ETH } from '../../config/contracts';

interface TokenBalance {
    address: string;
    symbol: string;
    decimals: number;
    balance: bigint;
}

export function EarningsPanel() {
    const { address, isConnected } = useAccount();
    const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);
    const [withdrawingToken, setWithdrawingToken] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Read balances for each tracked token
    const { data: ethBalance, refetch: refetchEth } = useReadContract({
        address: LEADER_FEE_HOOK_ADDRESS,
        abi: LEADER_FEE_HOOK_ABI,
        functionName: 'unclaimedFees',
        args: address ? [address, NATIVE_ETH] : undefined,
    });

    const { data: usdcBalance, refetch: refetchUsdc } = useReadContract({
        address: LEADER_FEE_HOOK_ADDRESS,
        abi: LEADER_FEE_HOOK_ABI,
        functionName: 'unclaimedFees',
        args: address ? [address, USDC_ADDRESS] : undefined,
    });

    // Write contract for withdrawals
    const { writeContract, data: txHash, isPending, error, reset } = useWriteContract();

    // Wait for transaction
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
        hash: txHash,
    });

    // Update token balances
    useEffect(() => {
        const balances: TokenBalance[] = [];

        if (ethBalance !== undefined) {
            balances.push({
                address: TOKENS.ETH.address,
                symbol: TOKENS.ETH.symbol,
                decimals: TOKENS.ETH.decimals,
                balance: ethBalance as bigint,
            });
        }

        if (usdcBalance !== undefined) {
            balances.push({
                address: TOKENS.USDC.address,
                symbol: TOKENS.USDC.symbol,
                decimals: TOKENS.USDC.decimals,
                balance: usdcBalance as bigint,
            });
        }

        setTokenBalances(balances);
    }, [ethBalance, usdcBalance]);

    // Handle success
    useEffect(() => {
        if (isSuccess) {
            setSuccessMessage('Withdrawal successful!');
            setWithdrawingToken(null);
            refetchEth();
            refetchUsdc();
            reset();
            setTimeout(() => setSuccessMessage(null), 5000);
        }
    }, [isSuccess, refetchEth, refetchUsdc, reset]);

    const handleWithdraw = (tokenAddress: string) => {
        if (!isConnected) return;

        setWithdrawingToken(tokenAddress);
        writeContract({
            address: LEADER_FEE_HOOK_ADDRESS,
            abi: LEADER_FEE_HOOK_ABI,
            functionName: 'withdrawFees',
            args: [tokenAddress as `0x${string}`],
        });
    };

    const formatBalance = (balance: bigint, decimals: number) => {
        if (decimals === 18) {
            return parseFloat(formatEther(balance)).toFixed(6);
        }
        return parseFloat(formatUnits(balance, decimals)).toFixed(2);
    };

    const hasAnyBalance = tokenBalances.some(t => t.balance > 0n);

    return (
        <div className="earnings-panel">
            <h2>💎 Your Earnings</h2>
            <p className="subtitle">Accumulated fees from your leadership rounds</p>

            {!isConnected ? (
                <p className="connect-prompt">Connect wallet to view your earnings</p>
            ) : (
                <>
                    {error && (
                        <div className="error-message">
                            Error: {error.message}
                        </div>
                    )}

                    {successMessage && (
                        <div className="success-message">
                            {successMessage}
                        </div>
                    )}

                    <div className="earnings-list">
                        {tokenBalances.map((token) => (
                            <div key={token.address} className="earnings-row">
                                <div className="token-info">
                                    <span className="token-symbol">{token.symbol}</span>
                                    <span className="token-balance">
                                        {formatBalance(token.balance, token.decimals)} {token.symbol}
                                    </span>
                                </div>
                                <button
                                    className="withdraw-button"
                                    onClick={() => handleWithdraw(token.address)}
                                    disabled={
                                        token.balance === 0n ||
                                        isPending ||
                                        isConfirming ||
                                        withdrawingToken === token.address
                                    }
                                >
                                    {withdrawingToken === token.address && (isPending || isConfirming)
                                        ? 'Withdrawing...'
                                        : 'Withdraw'}
                                </button>
                            </div>
                        ))}
                    </div>

                    {!hasAnyBalance && (
                        <p className="no-earnings">No accumulated fees yet. Win an auction to start earning!</p>
                    )}
                </>
            )}
        </div>
    );
}
