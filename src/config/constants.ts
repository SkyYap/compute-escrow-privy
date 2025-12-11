/**
 * @file constants.ts
 * @description Configuration constants and environment variable definitions
 */

/**
 * Server port configuration
 */
export const SERVER_PORT = process.env.APP_PORT || 8000;

/**
 * Blockchain RPC URL
 */
export const RPC_URL = process.env.RPC_URL || process.env.SEPOLIA_RPC_URL || null;

/**
 * Auction contract address
 * @notice Set this to the deployed Auction contract address
 */
export const AUCTION_CONTRACT_ADDRESS = (process.env.AUCTION_CONTRACT_ADDRESS as `0x${string}`) || null;

/**
 * TEE mnemonic phrase
 * @notice Keep secret, never commit to version control
 */
export const MNEMONIC = process.env.MNEMONIC || null;
