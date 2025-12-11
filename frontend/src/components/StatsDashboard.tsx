/**
 * @file components/StatsDashboard.tsx
 * @description Dashboard showing Auction contract statistics
 */

import { useEffect, useState } from 'react';
import { getDeposits, getWithdrawals, getBids, getRoundsResolved } from '../services/api';

interface Stats {
  deposits: { totalDeposits: string; totalDepositsEth: string } | null;
  withdrawals: { totalWithdrawals: string; totalWithdrawalsEth: string } | null;
  bids: { totalBids: string; totalBidsEth: string } | null;
  rounds: { roundsResolved: number } | null;
}

interface StatsDashboardProps {
  className?: string;
  refreshInterval?: number;
}

export function StatsDashboard({
  className = '',
  refreshInterval = 5000
}: StatsDashboardProps) {
  const [stats, setStats] = useState<Stats>({
    deposits: null,
    withdrawals: null,
    bids: null,
    rounds: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchStats() {
    try {
      setLoading(true);
      setError(null);

      const [deposits, withdrawals, bids, rounds] = await Promise.all([
        getDeposits(),
        getWithdrawals(),
        getBids(),
        getRoundsResolved(),
      ]);

      setStats({ deposits, withdrawals, bids, rounds });
    } catch (err) {
      console.error('Failed to fetch stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch statistics');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  if (loading && !stats.deposits) {
    return (
      <div className={`stats-dashboard ${className}`}>
        <h2>Auction Statistics</h2>
        <p>Loading statistics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`stats-dashboard ${className}`}>
        <h2>Auction Statistics</h2>
        <p className="error">Error: {error}</p>
        <button onClick={fetchStats}>Retry</button>
      </div>
    );
  }

  return (
    <div className={`stats-dashboard ${className}`}>
      <h2>Auction Statistics</h2>
      <p className="subtitle">Activity since TEE server started</p>

      <div className="stats-grid">
        <div className="stat-card">
          <h3>Collateral Deposits</h3>
          <div className="stat-value">
            {stats.deposits ? (
              <>
                <div className="stat-eth">{parseFloat(stats.deposits.totalDepositsEth).toFixed(4)} ETH</div>
              </>
            ) : (
              <div>Loading...</div>
            )}
          </div>
        </div>

        <div className="stat-card">
          <h3>Collateral Withdrawals</h3>
          <div className="stat-value">
            {stats.withdrawals ? (
              <>
                <div className="stat-eth">{parseFloat(stats.withdrawals.totalWithdrawalsEth).toFixed(4)} ETH</div>
              </>
            ) : (
              <div>Loading...</div>
            )}
          </div>
        </div>

        <div className="stat-card">
          <h3>Total Bids</h3>
          <div className="stat-value">
            {stats.bids ? (
              <>
                <div className="stat-eth">{parseFloat(stats.bids.totalBidsEth).toFixed(4)} ETH</div>
              </>
            ) : (
              <div>Loading...</div>
            )}
          </div>
        </div>

        <div className="stat-card">
          <h3>Rounds Resolved</h3>
          <div className="stat-value">
            {stats.rounds !== null ? (
              <div className="stat-eth">{stats.rounds.roundsResolved} rounds</div>
            ) : (
              <div>Loading...</div>
            )}
          </div>
        </div>
      </div>

      <button
        className="refresh-button"
        onClick={fetchStats}
        disabled={loading}
      >
        {loading ? 'Refreshing...' : 'Refresh Stats'}
      </button>
    </div>
  );
}
