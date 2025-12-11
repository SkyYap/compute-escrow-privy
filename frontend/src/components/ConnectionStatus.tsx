/**
 * @file components/ConnectionStatus.tsx
 * @description Wallet connection status with RainbowKit
 */

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useEffect, useState } from 'react';
import { getSettlerAddress, getAuctionAddress } from '../services/api';

interface ConnectionStatusProps {
  className?: string;
}

export function ConnectionStatus({ className = '' }: ConnectionStatusProps) {
  const { address, isConnected } = useAccount();
  const [settlerAddress, setSettlerAddress] = useState<string | null>(null);
  const [auctionAddress, setAuctionAddress] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAddresses() {
      try {
        const [settler, auction] = await Promise.all([
          getSettlerAddress(),
          getAuctionAddress(),
        ]);
        setSettlerAddress(settler.publicKey);
        setAuctionAddress(auction.address);
      } catch (err) {
        console.error('Failed to fetch addresses:', err);
      }
    }
    fetchAddresses();
  }, []);

  return (
    <div className={`connection-status ${className}`}>
      <h2>Wallet Connection</h2>

      <div className="connect-button-wrapper">
        <ConnectButton />
      </div>

      {isConnected && address && (
        <div className="wallet-info">
          <p>Connected: <code>{address}</code></p>
        </div>
      )}

      <div className="server-info">
        <h3>TEE Server Info</h3>
        <p>
          Settler (TEE): <code>{settlerAddress || 'Loading...'}</code>
        </p>
        <p>
          Auction Contract: <code>{auctionAddress || 'Not configured'}</code>
        </p>
      </div>
    </div>
  );
}
