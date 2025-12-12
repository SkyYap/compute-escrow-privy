/**
 * @file pages/AuctionPage.tsx
 * @description Auction page - extracted from original App.tsx content
 */

import { ConnectionStatus } from '../components/ConnectionStatus';
import { StatsDashboard } from '../components/StatsDashboard';
import { DepositForm } from '../components/DepositForm';
import { BidForm } from '../components/BidForm';
import { WithdrawForm } from '../components/WithdrawForm';

export function AuctionPage() {
    return (
        <>
            <header className="app-header">
                <h1>Auction TEE Frontend</h1>
                <p className="subtitle">
                    Timeboost-style second-price continuous auction
                </p>
            </header>

            <main className="app-main">
                <section className="connection-section">
                    <ConnectionStatus />
                </section>

                <section className="stats-section">
                    <StatsDashboard />
                </section>

                <section className="deposit-section">
                    <DepositForm />
                </section>

                <section className="bid-section">
                    <BidForm />
                </section>

                <section className="withdraw-section">
                    <WithdrawForm />
                </section>
            </main>
        </>
    );
}
