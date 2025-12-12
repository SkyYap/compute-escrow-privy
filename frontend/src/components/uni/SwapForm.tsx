/**
 * @file components/uni/SwapForm.tsx
 * @description Swap form for ETH ↔ USDC with dynamic leader fees
 */

import { useState, useEffect } from 'react';
import { useAccount, useBalance, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, parseUnits, formatEther, formatUnits } from 'viem';
import {
    POOL_SWAP_TEST_ADDRESS,
    POOL_SWAP_TEST_ABI,
    LEADER_FEE_HOOK_ADDRESS,
    USDC_ADDRESS,
    NATIVE_ETH,
    POOL_CONFIG,
    ERC20_ABI,
} from '../../config/contracts';

export function SwapForm() {
    const { address, isConnected } = useAccount();
    const [inputAmount, setInputAmount] = useState('');
    const [isEthToUsdc, setIsEthToUsdc] = useState(true);
    const [needsApproval, setNeedsApproval] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // ETH Balance
    const { data: ethBalance } = useBalance({
        address: address,
    });

    // USDC Balance
    const { data: usdcBalance } = useReadContract({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
    });

    // USDC Allowance for PoolSwapTest
    const { data: usdcAllowance, refetch: refetchAllowance } = useReadContract({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: address ? [address, POOL_SWAP_TEST_ADDRESS] : undefined,
    });

    // Write contracts
    const { writeContract, data: txHash, isPending, error, reset } = useWriteContract();
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

    // Check if approval is needed
    useEffect(() => {
        if (!isEthToUsdc && inputAmount && usdcAllowance !== undefined) {
            const requiredAmount = parseUnits(inputAmount || '0', 6);
            setNeedsApproval(usdcAllowance < requiredAmount);
        } else {
            setNeedsApproval(false);
        }
    }, [isEthToUsdc, inputAmount, usdcAllowance]);

    // Handle success
    useEffect(() => {
        if (isSuccess) {
            setSuccessMessage('Swap successful!');
            setInputAmount('');
            refetchAllowance();
            reset();
            setTimeout(() => setSuccessMessage(null), 5000);
        }
    }, [isSuccess, refetchAllowance, reset]);

    const handleApprove = () => {
        if (!address) return;

        writeContract({
            address: USDC_ADDRESS,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [POOL_SWAP_TEST_ADDRESS, parseUnits('1000000', 6)], // Approve 1M USDC
        });
    };

    const handleSwap = () => {
        if (!address || !inputAmount) return;

        const zeroForOne = isEthToUsdc; // ETH (token0) -> USDC (token1)
        const amountIn = isEthToUsdc
            ? parseEther(inputAmount)
            : parseUnits(inputAmount, 6);

        // Pool key
        const poolKey = {
            currency0: NATIVE_ETH,
            currency1: USDC_ADDRESS,
            fee: POOL_CONFIG.fee,
            tickSpacing: POOL_CONFIG.tickSpacing,
            hooks: LEADER_FEE_HOOK_ADDRESS,
        };

        // Swap params - negative amountSpecified means exact input
        const swapParams = {
            zeroForOne,
            amountSpecified: -BigInt(amountIn), // Negative = exact input
            sqrtPriceLimitX96: zeroForOne
                ? BigInt('4295128739') // Min price (swap all the way)
                : BigInt('1461446703485210103287273052203988822378723970342'), // Max price
        };

        // Test settings
        const testSettings = {
            takeClaims: false,
            settleUsingBurn: false,
        };

        writeContract({
            address: POOL_SWAP_TEST_ADDRESS,
            abi: POOL_SWAP_TEST_ABI,
            functionName: 'swap',
            args: [poolKey, swapParams, testSettings, '0x'],
            value: isEthToUsdc ? amountIn : 0n,
        });
    };

    const formatBalance = (balance: bigint | undefined, decimals: number) => {
        if (!balance) return '0';
        return parseFloat(decimals === 18 ? formatEther(balance) : formatUnits(balance, decimals)).toFixed(4);
    };

    const inputToken = isEthToUsdc ? 'ETH' : 'USDC';
    const outputToken = isEthToUsdc ? 'USDC' : 'ETH';
    const inputBalance = isEthToUsdc ? ethBalance?.value : usdcBalance;
    const inputDecimals = isEthToUsdc ? 18 : 6;

    return (
        <div className="swap-form">
            <h2>🔄 Swap</h2>
            <p className="subtitle">Swap ETH ↔ USDC (fees go to current leader)</p>

            {!isConnected ? (
                <p className="connect-prompt">Connect wallet to swap</p>
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

                    <div className="swap-container">
                        {/* Input Token */}
                        <div className="swap-input-box">
                            <div className="swap-token-header">
                                <span className="token-label">From</span>
                                <span className="balance-label">
                                    Balance: {formatBalance(inputBalance, inputDecimals)} {inputToken}
                                </span>
                            </div>
                            <div className="swap-input-row">
                                <input
                                    type="number"
                                    placeholder="0.0"
                                    value={inputAmount}
                                    onChange={(e) => setInputAmount(e.target.value)}
                                    disabled={isPending || isConfirming}
                                />
                                <span className="token-badge">{inputToken}</span>
                            </div>
                        </div>

                        {/* Swap Direction Button */}
                        <button
                            className="swap-direction-button"
                            onClick={() => setIsEthToUsdc(!isEthToUsdc)}
                            disabled={isPending || isConfirming}
                        >
                            ↕️
                        </button>

                        {/* Output Token */}
                        <div className="swap-input-box output">
                            <div className="swap-token-header">
                                <span className="token-label">To</span>
                            </div>
                            <div className="swap-input-row">
                                <input
                                    type="text"
                                    placeholder="0.0"
                                    value="~"
                                    disabled
                                />
                                <span className="token-badge">{outputToken}</span>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    {needsApproval ? (
                        <button
                            className="swap-button approve"
                            onClick={handleApprove}
                            disabled={isPending || isConfirming}
                        >
                            {isPending ? 'Confirm in Wallet...' : isConfirming ? 'Approving...' : 'Approve USDC'}
                        </button>
                    ) : (
                        <button
                            className="swap-button"
                            onClick={handleSwap}
                            disabled={isPending || isConfirming || !inputAmount}
                        >
                            {isPending ? 'Confirm in Wallet...' : isConfirming ? 'Swapping...' : 'Swap'}
                        </button>
                    )}
                </>
            )}
        </div>
    );
}
