/**
 * @file components/uni/FeeSettings.tsx
 * @description Fee configuration panel for setting swap fees
 */

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { LEADER_FEE_HOOK_ADDRESS, LEADER_FEE_HOOK_ABI } from '../../config/contracts';

export function FeeSettings() {
    const { address, isConnected } = useAccount();
    const [feeInput, setFeeInput] = useState<number>(3000); // 0.3% default
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Read user's current configured fee
    const { data: userFee, refetch: refetchFee } = useReadContract({
        address: LEADER_FEE_HOOK_ADDRESS,
        abi: LEADER_FEE_HOOK_ABI,
        functionName: 'leaderFees',
        args: address ? [address] : undefined,
    });

    // Read min/max fee
    const { data: minFee } = useReadContract({
        address: LEADER_FEE_HOOK_ADDRESS,
        abi: LEADER_FEE_HOOK_ABI,
        functionName: 'MIN_FEE',
    });

    const { data: maxFee } = useReadContract({
        address: LEADER_FEE_HOOK_ADDRESS,
        abi: LEADER_FEE_HOOK_ABI,
        functionName: 'MAX_FEE',
    });

    // Write contract
    const { writeContract, data: txHash, isPending, error } = useWriteContract();

    // Wait for transaction
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
        hash: txHash,
    });

    // Update local state when user fee loads
    useEffect(() => {
        if (userFee !== undefined && Number(userFee) > 0) {
            setFeeInput(Number(userFee));
        }
    }, [userFee]);

    // Handle success
    useEffect(() => {
        if (isSuccess) {
            setSuccessMessage('Fee updated successfully!');
            refetchFee();
            setTimeout(() => setSuccessMessage(null), 5000);
        }
    }, [isSuccess, refetchFee]);

    const handleSetFee = () => {
        if (!isConnected) return;

        writeContract({
            address: LEADER_FEE_HOOK_ADDRESS,
            abi: LEADER_FEE_HOOK_ABI,
            functionName: 'setFee',
            args: [feeInput],
        });
    };

    const feeToPercent = (fee: number) => (fee / 10000).toFixed(4);
    const currentFeeDisplay = userFee ? feeToPercent(Number(userFee)) : '0.3000';
    const sliderMin = minFee ? Number(minFee) : 1;
    const sliderMax = maxFee ? Number(maxFee) : 50000;

    // Preset buttons
    const presets = [
        { label: 'Low (0.05%)', value: 500 },
        { label: 'Medium (0.3%)', value: 3000 },
        { label: 'High (1%)', value: 10000 },
    ];

    return (
        <div className="fee-settings">
            <h2>⚙️ Your Fee Setting</h2>
            <p className="subtitle">Set your preferred swap fee (applied when you're the leader)</p>

            {!isConnected ? (
                <p className="connect-prompt">Connect wallet to configure your fee</p>
            ) : (
                <>
                    <div className="current-fee-display">
                        Your configured fee: <strong>{currentFeeDisplay}%</strong>
                    </div>

                    <div className="fee-slider-container">
                        <input
                            type="range"
                            className="fee-slider"
                            min={sliderMin}
                            max={sliderMax}
                            value={feeInput}
                            onChange={(e) => setFeeInput(Number(e.target.value))}
                            disabled={isPending || isConfirming}
                        />
                        <div className="fee-slider-labels">
                            <span>0.0001%</span>
                            <span className="current-value">{feeToPercent(feeInput)}%</span>
                            <span>5%</span>
                        </div>
                    </div>

                    <div className="fee-presets">
                        {presets.map((preset) => (
                            <button
                                key={preset.value}
                                className={`preset-button ${feeInput === preset.value ? 'active' : ''}`}
                                onClick={() => setFeeInput(preset.value)}
                                disabled={isPending || isConfirming}
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>

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

                    <button
                        className="update-fee-button"
                        onClick={handleSetFee}
                        disabled={isPending || isConfirming || !isConnected}
                    >
                        {isPending ? 'Confirm in Wallet...' : isConfirming ? 'Updating...' : 'Update Fee'}
                    </button>
                </>
            )}
        </div>
    );
}
