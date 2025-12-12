/**
 * @file components/uni/LeaderDisplay.tsx
 * @description Shows current leader info with countdown timer
 */

import { useEffect, useState } from 'react';
import { useReadContract } from 'wagmi';
import { LEADER_FEE_HOOK_ADDRESS, LEADER_FEE_HOOK_ABI } from '../../config/contracts';

export function LeaderDisplay() {
    const [timeRemaining, setTimeRemaining] = useState<number>(0);

    // Read current leader
    const { data: currentLeader, refetch: refetchLeader } = useReadContract({
        address: LEADER_FEE_HOOK_ADDRESS,
        abi: LEADER_FEE_HOOK_ABI,
        functionName: 'getCurrentLeader',
    });

    // Read current fee
    const { data: currentFee } = useReadContract({
        address: LEADER_FEE_HOOK_ADDRESS,
        abi: LEADER_FEE_HOOK_ABI,
        functionName: 'getCurrentFee',
    });

    // Read time remaining
    const { data: timeRemainingData, refetch: refetchTime } = useReadContract({
        address: LEADER_FEE_HOOK_ADDRESS,
        abi: LEADER_FEE_HOOK_ABI,
        functionName: 'getLeadershipTimeRemaining',
    });

    // Update local countdown
    useEffect(() => {
        if (timeRemainingData !== undefined) {
            setTimeRemaining(Number(timeRemainingData));
        }
    }, [timeRemainingData]);

    // Countdown timer
    useEffect(() => {
        const interval = setInterval(() => {
            setTimeRemaining((prev) => {
                if (prev <= 0) {
                    refetchLeader();
                    refetchTime();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [refetchLeader, refetchTime]);

    // Auto-refresh every 10 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            refetchLeader();
            refetchTime();
        }, 10000);

        return () => clearInterval(interval);
    }, [refetchLeader, refetchTime]);

    const hasActiveLeader = currentLeader && currentLeader !== '0x0000000000000000000000000000000000000000';
    const feePercentage = currentFee ? (Number(currentFee) / 10000).toFixed(4) : '0.30';
    const progressPercent = timeRemaining > 0 ? ((60 - timeRemaining) / 60) * 100 : 100;

    const formatAddress = (addr: string) => {
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    return (
        <div className="leader-display">
            <div className="leader-header">
                <h2>🏆 Current Leader</h2>
                <div className="countdown-badge">
                    ⏱️ {timeRemaining}s left
                </div>
            </div>

            <div className="leader-content">
                {hasActiveLeader ? (
                    <>
                        <div className="leader-address">
                            <span className="crown">👑</span>
                            <code>{formatAddress(currentLeader as string)}</code>
                        </div>
                        <div className="leader-fee">
                            <span className="fee-icon">💰</span>
                            Current Fee: <strong>{feePercentage}%</strong>
                        </div>
                    </>
                ) : (
                    <div className="no-leader">
                        <span>No active leader</span>
                        <span className="default-fee">Default fee: 0.30%</span>
                    </div>
                )}

                <div className="progress-container">
                    <div
                        className="progress-bar"
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
                <div className="progress-label">
                    {progressPercent.toFixed(0)}% round complete
                </div>
            </div>
        </div>
    );
}
