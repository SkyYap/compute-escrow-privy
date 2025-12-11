/**
 * @file services/RoundResolverService.ts
 * @description Service for resolving auction rounds
 * 
 * This service handles the business logic of resolving auction rounds.
 * The TEE calls resolveRound() when a round expires to trigger the transition.
 */

import { baseSepolia } from 'viem/chains';
import { AUCTION_CONTRACT_ADDRESS } from '../config/constants';
import { getPublicClient, getWalletClient } from './BlockchainService';
import { getTeeAccount } from './TeeService';
import { AUCTION_ABI } from './EventTrackingService';

/**
 * Resolve the current auction round
 * 
 * Why this function exists:
 * - The TEE (settler) is authorized to call resolveRound() on the Auction contract
 * - This triggers the round transition: crowning the winner, collecting rent, starting next round
 * - Called automatically when a round expires (after 60 seconds)
 * 
 * @returns Transaction hash and receipt
 * @throws Error if prerequisites not met or transaction fails
 */
export async function resolveRound(): Promise<{
    transactionHash: `0x${string}`;
    receipt: {
        blockNumber: string;
        blockHash: `0x${string}`;
        status: 'success' | 'reverted';
    };
}> {
    // Validate prerequisites
    const teeAccount = getTeeAccount();
    if (!teeAccount) {
        throw new Error('TEE account not initialized. MNEMONIC environment variable not set.');
    }

    const publicClient = getPublicClient();
    if (!publicClient) {
        throw new Error('Blockchain client not initialized. RPC_URL required.');
    }

    if (!AUCTION_CONTRACT_ADDRESS) {
        throw new Error('Auction contract address not set. AUCTION_CONTRACT_ADDRESS required.');
    }

    // Get wallet client for signing
    const walletClient = getWalletClient();
    if (!walletClient) {
        throw new Error('Wallet client not initialized');
    }

    // Get nonce for the transaction
    const nonce = await publicClient.getTransactionCount({
        address: teeAccount.address,
    });

    // Build and send transaction
    const transactionHash = await walletClient.writeContract({
        address: AUCTION_CONTRACT_ADDRESS,
        abi: AUCTION_ABI,
        functionName: 'resolveRound',
        args: [],
        account: teeAccount,
        chain: baseSepolia,
        nonce,
    });

    // Wait for transaction receipt
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

/**
 * Check if the current round can be resolved
 * 
 * @returns True if round has expired and can be resolved
 */
export async function canResolveRound(): Promise<boolean> {
    const publicClient = getPublicClient();
    if (!publicClient || !AUCTION_CONTRACT_ADDRESS) {
        return false;
    }

    try {
        const currentRoundStart = await publicClient.readContract({
            address: AUCTION_CONTRACT_ADDRESS,
            abi: AUCTION_ABI,
            functionName: 'currentRoundStart' as never,
        }) as bigint;

        const ROUND_DURATION = 60n; // 60 seconds
        const now = BigInt(Math.floor(Date.now() / 1000));

        return now >= currentRoundStart + ROUND_DURATION;
    } catch {
        return false;
    }
}
