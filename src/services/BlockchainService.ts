/**
 * @file services/BlockchainService.ts
 * @description Blockchain interaction service
 * 
 * This service manages connections to the blockchain and provides methods for
 * reading blockchain data and sending transactions.
 * 
 * Why this exists:
 * - Separates blockchain logic from route handlers
 * - Provides a clean interface for blockchain operations
 * - Makes it easy to swap RPC providers or add retry logic
 * - Centralizes error handling for blockchain operations
 */

import { createPublicClient, createWalletClient, http, PublicClient, WalletClient } from 'viem';
import { baseSepolia } from 'viem/chains';
import { RPC_URL } from '../config/constants';
import { getTeeAccount } from './TeeService';

/**
 * Public client for reading blockchain data
 * Why: Viem's publicClient is used for read operations (getting balances, reading
 * events, etc.). It doesn't need a private key, so it's safe to use for queries.
 */
let publicClient: PublicClient | null = null;

/**
 * Wallet client for signing transactions
 * Why: Viem's walletClient is used for write operations (sending transactions).
 * It requires a private key to sign transactions. We create this lazily because
 * it depends on the TEE account being initialized.
 */
let walletClient: WalletClient | null = null;

/**
 * Initialize the blockchain public client
 * Why: We need a connection to the blockchain to read events and contract state.
 * This initializes the connection once at startup and reuses it throughout the app.
 */
export function initializeBlockchainClient(): void {
  if (!RPC_URL) {
    console.warn('⚠️  RPC_URL not found - event tracking routes will not work');
    return;
  }

  publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(RPC_URL),
  }) as PublicClient;

  console.log(`✅ Blockchain client initialized with RPC: ${RPC_URL}`);
}

/**
 * Get the public blockchain client
 * Why: Route handlers need access to the client to read blockchain data.
 * This getter ensures the client is initialized before use.
 * 
 * @returns The public client instance, or null if not initialized
 */
export function getPublicClient(): PublicClient | null {
  return publicClient;
}

/**
 * Get or create the wallet client for signing transactions
 * Why: We create the wallet client lazily because it requires the TEE account
 * to be initialized first. This ensures we don't try to create it before the
 * account is ready.
 * 
 * @returns The wallet client instance, or null if prerequisites not met
 */
export function getWalletClient(): WalletClient | null {
  if (walletClient) {
    return walletClient;
  }

  const teeAccount = getTeeAccount();
  if (!teeAccount || !RPC_URL) {
    return null;
  }

  walletClient = createWalletClient({
    account: teeAccount,
    chain: baseSepolia,
    transport: http(RPC_URL),
  }) as WalletClient;

  return walletClient;
}

