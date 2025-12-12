/**
 * @file pages/UniPage.tsx
 * @description Uniswap V4 LeaderFeeHook page with swap and liquidity
 */

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { LeaderDisplay } from '../components/uni/LeaderDisplay';
import { FeeSettings } from '../components/uni/FeeSettings';
import { EarningsPanel } from '../components/uni/EarningsPanel';
import { SwapForm } from '../components/uni/SwapForm';
import { AddLiquidityForm } from '../components/uni/AddLiquidityForm';

export function UniPage() {
    return (
        <>
            <header className="app-header uni-header">
                <h1>Uniswap V4 Leader Hook</h1>
                <p className="subtitle">
                    Dynamic fees controlled by auction winners • ETH/USDC Pool
                </p>
            </header>

            <main className="app-main">
                <section className="connection-section">
                    <div className="uni-connection">
                        <h2>Wallet Connection</h2>
                        <ConnectButton />
                    </div>
                </section>

                <section className="leader-section">
                    <LeaderDisplay />
                </section>

                <div className="swap-liquidity-grid">
                    <section className="swap-section">
                        <SwapForm />
                    </section>

                    <section className="liquidity-section">
                        <AddLiquidityForm />
                    </section>
                </div>

                <section className="fee-section">
                    <FeeSettings />
                </section>

                <section className="earnings-section">
                    <EarningsPanel />
                </section>
            </main>
        </>
    );
}
