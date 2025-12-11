/**
 * @file config/constants.ts
 * @description Frontend configuration constants
 */

/**
 * TEE Server Base URL
 */
export const TEE_SERVER_URL = import.meta.env.VITE_TEE_SERVER_URL || 'http://localhost:8000';

/**
 * WalletConnect Project ID
 * Get one free at: https://cloud.walletconnect.com
 */
export const WALLETCONNECT_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '';

/**
 * Blockchain RPC URL
 */
export const RPC_URL = import.meta.env.VITE_RPC_URL || null;

/**
 * Chain ID (defaults to Base Sepolia)
 */
export const CHAIN_ID = import.meta.env.VITE_CHAIN_ID
  ? parseInt(import.meta.env.VITE_CHAIN_ID)
  : 84532; // Base Sepolia testnet

if (!WALLETCONNECT_PROJECT_ID) {
  console.warn('⚠️  VITE_WALLETCONNECT_PROJECT_ID is not set. Wallet connection may not work.');
}

if (!TEE_SERVER_URL || TEE_SERVER_URL === 'http://localhost:8000') {
  console.warn('⚠️  VITE_TEE_SERVER_URL is using default localhost.');
}

if (!RPC_URL) {
  console.error('❌ VITE_RPC_URL is not set. Blockchain operations will not work.');
}
