/**
 * @file components/uni/AddLiquidityForm.tsx
 * @description Add liquidity form for ETH/USDC pool
 */

import { useState, useEffect } from 'react';
import { useAccount, useBalance, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, parseUnits, formatEther, formatUnits } from 'viem';
import {
    POOL_MODIFY_LIQUIDITY_TEST_ADDRESS,
    POOL_MODIFY_LIQUIDITY_TEST_ABI,
    LEADER_FEE_HOOK_ADDRESS,
    USDC_ADDRESS,
    NATIVE_ETH,
    POOL_CONFIG,
    ERC20_ABI,
} from '../../config/contracts';

export function AddLiquidityForm() {
    const { address, isConnected } = useAccount();
    const [ethAmount, setEthAmount] = useState('');
    const [usdcAmount, setUsdcAmount] = useState('');
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

    // USDC Allowance for PoolModifyLiquidityTest
    const { data: usdcAllowance, refetch: refetchAllowance } = useReadContract({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: address ? [address, POOL_MODIFY_LIQUIDITY_TEST_ADDRESS] : undefined,
    });

    // Write contracts
    const { writeContract, data: txHash, isPending, error, reset } = useWriteContract();
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

    // Check if approval is needed
    useEffect(() => {
        if (usdcAmount && usdcAllowance !== undefined) {
            const requiredAmount = parseUnits(usdcAmount || '0', 6);
            setNeedsApproval(usdcAllowance < requiredAmount);
        } else {
            setNeedsApproval(false);
        }
    }, [usdcAmount, usdcAllowance]);

    // Handle success
    useEffect(() => {
        if (isSuccess) {
            setSuccessMessage('Liquidity added successfully!');
            setEthAmount('');
            setUsdcAmount('');
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
            args: [POOL_MODIFY_LIQUIDITY_TEST_ADDRESS, parseUnits('1000000', 6)], // Approve 1M USDC
        });
    };

    const handleAddLiquidity = () => {
        if (!address || !ethAmount || !usdcAmount) return;

        // Pool key
        const poolKey = {
            currency0: NATIVE_ETH,
            currency1: USDC_ADDRESS,
            fee: POOL_CONFIG.fee,
            tickSpacing: POOL_CONFIG.tickSpacing,
            hooks: LEADER_FEE_HOOK_ADDRESS,
        };

        // Liquidity params
        // Full range: tickLower = -887220, tickUpper = 887220 (for tickSpacing 60)
        const params = {
            tickLower: -887220,
            tickUpper: 887220,
            liquidityDelta: parseEther(ethAmount), // Simplified: use ETH amount as liquidity
            salt: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
        };

        writeContract({
            address: POOL_MODIFY_LIQUIDITY_TEST_ADDRESS,
            abi: POOL_MODIFY_LIQUIDITY_TEST_ABI,
            functionName: 'modifyLiquidity',
            args: [poolKey, params, '0x'],
            value: parseEther(ethAmount),
        });
    };

    const formatBalance = (balance: bigint | undefined, decimals: number) => {
        if (!balance) return '0';
        return parseFloat(decimals === 18 ? formatEther(balance) : formatUnits(balance, decimals)).toFixed(4);
    };

    return (
        <div className="add-liquidity-form">
            <h2>💧 Add Liquidity</h2>
            <p className="subtitle">Provide ETH and USDC to earn swap fees</p>

            {!isConnected ? (
                <p className="connect-prompt">Connect wallet to add liquidity</p>
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

                    <div className="liquidity-inputs">
                        {/* ETH Input */}
                        <div className="liquidity-input-box">
                            <div className="input-header">
                                <span className="token-label">ETH</span>
                                <span className="balance-label">
                                    Balance: {formatBalance(ethBalance?.value, 18)}
                                </span>
                            </div>
                            <input
                                type="number"
                                placeholder="0.0"
                                value={ethAmount}
                                onChange={(e) => setEthAmount(e.target.value)}
                                disabled={isPending || isConfirming}
                            />
                        </div>

                        <div className="plus-sign">+</div>

                        {/* USDC Input */}
                        <div className="liquidity-input-box">
                            <div className="input-header">
                                <span className="token-label">USDC</span>
                                <span className="balance-label">
                                    Balance: {formatBalance(usdcBalance as bigint, 6)}
                                </span>
                            </div>
                            <input
                                type="number"
                                placeholder="0.0"
                                value={usdcAmount}
                                onChange={(e) => setUsdcAmount(e.target.value)}
                                disabled={isPending || isConfirming}
                            />
                        </div>
                    </div>

                    {/* Action Buttons */}
                    {needsApproval ? (
                        <button
                            className="liquidity-button approve"
                            onClick={handleApprove}
                            disabled={isPending || isConfirming}
                        >
                            {isPending ? 'Confirm in Wallet...' : isConfirming ? 'Approving...' : 'Approve USDC'}
                        </button>
                    ) : (
                        <button
                            className="liquidity-button"
                            onClick={handleAddLiquidity}
                            disabled={isPending || isConfirming || !ethAmount || !usdcAmount}
                        >
                            {isPending ? 'Confirm in Wallet...' : isConfirming ? 'Adding Liquidity...' : 'Add Liquidity'}
                        </button>
                    )}
                </>
            )}
        </div>
    );
}
