/**
 * @file services/TeeService.ts
 * @description TEE (Trusted Execution Environment) account management service
 * 
 * This service manages the TEE's cryptographic identity derived from a mnemonic phrase.
 * The TEE uses this account to sign transactions on behalf of users (as the settler).
 * 
 * Why this exists:
 * - Separates TEE account management from route handlers
 * - Provides a single source of truth for TEE identity
 * - Makes it easy to test and mock TEE functionality
 * - Centralizes error handling for account initialization
 */

import { mnemonicToAccount } from 'viem/accounts';
import { MNEMONIC } from '../config/constants';

/**
 * TEE account instance
 * Why: We store this as a module-level variable so it's initialized once at startup
 * and can be reused throughout the application. The account contains the private key
 * derived from the mnemonic, which is used to sign transactions.
 */
let teeAccount: ReturnType<typeof mnemonicToAccount> | null = null;

/**
 * TEE public key (Ethereum address)
 * Why: The public key is the Ethereum address derived from the mnemonic. This is
 * what gets set as the "settler" on the Escrow contract and is publicly visible.
 */
let teePublicKey: string | null = null;

/**
 * Initialize the TEE account from mnemonic
 * Why: This must be called at application startup to derive the TEE's private key
 * from the mnemonic. Without this, the TEE cannot sign transactions.
 * 
 * @throws Error if mnemonic is invalid or missing
 */
export function initializeTeeAccount(): void {
  if (!MNEMONIC) {
    console.warn('⚠️  MNEMONIC not found - TEE routes will not work');
    return;
  }

  try {
    // Derive account from mnemonic
    // Why: mnemonicToAccount uses BIP39 standard to derive the private key
    // This ensures compatibility with standard wallet tools and practices
    teeAccount = mnemonicToAccount(MNEMONIC);
    teePublicKey = teeAccount.address;
    console.log(`✅ TEE account initialized: ${teePublicKey}`);
  } catch (error) {
    console.error('❌ Failed to initialize TEE account from mnemonic:', error);
    throw new Error('Failed to initialize TEE account');
  }
}

/**
 * Get the TEE's public key (Ethereum address)
 * Why: This is used by the /settler route to expose the TEE's public address.
 * The frontend needs this to know what address to set as the settler on the contract.
 * 
 * @returns The TEE's public Ethereum address, or null if not initialized
 */
export function getTeePublicKey(): string | null {
  return teePublicKey;
}

/**
 * Get the TEE account instance
 * Why: This is used to sign transactions. The account contains the private key
 * needed to sign blockchain transactions.
 * 
 * @returns The TEE account instance, or null if not initialized
 */
export function getTeeAccount(): ReturnType<typeof mnemonicToAccount> | null {
  return teeAccount;
}

