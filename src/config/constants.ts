/**
 * @file constants.ts
 * @description Configuration constants and environment variable definitions
 * 
 * This file centralizes all configuration constants. This makes it easy to:
 * - See what environment variables are required
 * - Change default values in one place
 * - Understand the application's configuration at a glance
 */

/**
 * Server port configuration
 * Why: The TEE server needs to listen on a specific port. Defaults to 8000,
 * which is commonly used for backend services and doesn't conflict with common
 * frontend ports (3000) or other services.
 */
export const SERVER_PORT = process.env.APP_PORT || 8000;

/**
 * Blockchain RPC URL
 * Why: We need a connection to the blockchain to read events and send transactions.
 * Supports both RPC_URL and SEPOLIA_RPC_URL for flexibility.
 */
export const RPC_URL = process.env.RPC_URL || process.env.SEPOLIA_RPC_URL || null;

/**
 * Escrow contract address
 * Why: This is the address of the deployed Escrow contract on the blockchain.
 * We need this to listen to events and interact with the contract.
 * Must be set as an environment variable after deployment.
 */
export const ESCROW_CONTRACT_ADDRESS = (process.env.ESCROW_CONTRACT_ADDRESS as `0x${string}`) || null;

/**
 * TEE mnemonic phrase
 * Why: The TEE (Trusted Execution Environment) needs a private key to sign
 * transactions. We derive this from a mnemonic for security and portability.
 * This mnemonic should be kept secret and never committed to version control.
 */
export const MNEMONIC = process.env.MNEMONIC || null;

