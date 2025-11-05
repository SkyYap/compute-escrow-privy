/**
 * @file services/TransferService.ts
 * @description Service for executing escrow balance transfers
 * 
 * This service handles the business logic of transferring escrow balances between
 * users. It validates inputs, builds transactions, and submits them to the blockchain.
 * 
 * Why this exists:
 * - Separates transaction logic from route handlers
 * - Makes it easy to add retry logic, gas estimation, or other transaction features
 * - Provides a clean interface for initiating transfers
 * - Centralizes validation and error handling
 */

import { parseUnits } from 'viem';
import { baseSepolia } from 'viem/chains';
import { ESCROW_CONTRACT_ADDRESS } from '../config/constants';
import { getPublicClient, getWalletClient } from './BlockchainService';
import { getTeeAccount } from './TeeService';
import { ESCROW_ABI } from './EventTrackingService';

/**
 * Transfer escrow balance from one user to another
 * 
 * Why this function exists:
 * - The TEE (settler) is authorized to transfer funds between user escrow accounts
 * - Users request transfers via the /transfer endpoint
 * - The TEE signs the transaction using its private key
 * - This enables settlement operations where funds move between players
 * 
 * Flow:
 * 1. User authenticates with Privy (done in middleware)
 * 2. User requests transfer (amount, recipient)
 * 3. TEE validates the request
 * 4. TEE signs and submits transaction
 * 5. Transaction is mined on blockchain
 * 
 * @param fromAddress - The authenticated user's wallet address (from Privy)
 * @param toAddress - The recipient's wallet address
 * @param amountEth - The amount to transfer in ETH (will be converted to wei)
 * @returns Transaction hash and receipt
 * @throws Error if validation fails or transaction submission fails
 */
export async function transferEscrowBalance(
  fromAddress: `0x${string}`,
  toAddress: `0x${string}`,
  amountEth: string
): Promise<{
  transactionHash: `0x${string}`;
  receipt: {
    blockNumber: string;
    blockHash: `0x${string}`;
    status: 'success' | 'reverted';
  };
}> {
  // Validate prerequisites
  // Why: We need these services to be initialized before we can transfer.
  // Checking here provides clear error messages if something is misconfigured.
  const teeAccount = getTeeAccount();
  if (!teeAccount) {
    throw new Error('TEE account not initialized. MNEMONIC environment variable not set.');
  }

  const publicClient = getPublicClient();
  if (!publicClient) {
    throw new Error('Blockchain client not initialized. RPC_URL required.');
  }

  if (!ESCROW_CONTRACT_ADDRESS) {
    throw new Error('Escrow contract address not set. ESCROW_CONTRACT_ADDRESS required.');
  }

  // Validate and parse amount
  // Why: Users provide amounts in ETH for readability, but blockchain uses wei.
  // parseUnits converts ETH to wei with proper decimal handling.
  let amountWei: bigint;
  try {
    amountWei = parseUnits(amountEth, 18);
  } catch (error) {
    throw new Error('Invalid amount format. Must be a valid number.');
  }

  if (amountWei <= 0n) {
    throw new Error('Amount must be greater than zero');
  }

  // Validate addresses
  // Why: We need to ensure addresses are valid Ethereum addresses and different.
  // This prevents errors and protects against accidental self-transfers.
  if (!/^0x[a-fA-F0-9]{40}$/.test(fromAddress) || !/^0x[a-fA-F0-9]{40}$/.test(toAddress)) {
    throw new Error('Invalid address format');
  }

  if (fromAddress.toLowerCase() === toAddress.toLowerCase()) {
    throw new Error('Cannot transfer to the same address');
  }

  // Get wallet client for signing
  // Why: We need the wallet client to sign and send the transaction.
  // The wallet client uses the TEE's private key to sign on behalf of the settler.
  const walletClient = getWalletClient();
  if (!walletClient) {
    throw new Error('Wallet client not initialized');
  }

  // Get nonce for the transaction
  // Why: Each transaction needs a unique nonce to prevent replay attacks.
  // We get the current nonce from the blockchain to ensure we use the next valid one.
  const nonce = await publicClient.getTransactionCount({
    address: teeAccount.address,
  });

    // Build and send transaction
    // Why: writeContract is a high-level viem function that:
    // - Encodes the function call
    // - Estimates gas
    // - Signs the transaction
    // - Sends it to the network
    // - Returns the transaction hash immediately
    const transactionHash = await walletClient.writeContract({
      address: ESCROW_CONTRACT_ADDRESS,
      abi: ESCROW_ABI,
      functionName: 'transferEscrowBalance',
      args: [fromAddress, toAddress, amountWei],
      account: teeAccount,
      chain: baseSepolia,
      nonce,
    });

  // Wait for transaction receipt
  // Why: We wait for the receipt to confirm the transaction was mined.
  // This ensures the transfer actually happened before returning success to the user.
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: transactionHash,
  });

  return {
    transactionHash,
    receipt: {
      blockNumber: receipt.blockNumber.toString(),
      blockHash: receipt.blockHash,
      status: receipt.status,
    },
  };
}

