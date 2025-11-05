/**
 * @file services/api.ts
 * @description API client for communicating with the TEE server
 * 
 * This service provides functions to interact with all TEE server endpoints.
 * It handles authentication headers, error handling, and response parsing.
 * 
 * Why this exists:
 * - Centralizes all API calls in one place
 * - Provides consistent error handling
 * - Makes it easy to update API endpoints
 * - Handles authentication token management
 */

import { TEE_SERVER_URL } from '../config/constants';

/**
 * Make an authenticated API request
 * Why: Most endpoints require Privy authentication. This helper function
 * adds the Authorization header automatically.
 * 
 * @param endpoint - API endpoint path (e.g., '/hello')
 * @param token - Privy access token
 * @param options - Fetch options
 */
async function apiRequest(
  endpoint: string,
  token: string | null = null,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${TEE_SERVER_URL}${endpoint}`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Copy existing headers from options
  if (options.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((value, key) => {
        headers[key] = value;
      });
    } else if (Array.isArray(options.headers)) {
      options.headers.forEach(([key, value]) => {
        headers[key] = value;
      });
    } else {
      Object.assign(headers, options.headers);
    }
  }

  // Add authentication header if token is provided
  // Why: The TEE server expects "Authorization: Bearer <token>" for protected routes.
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers: headers as HeadersInit,
  });

  // Handle HTTP errors
  // Why: We want to throw errors for non-2xx responses so components can handle them.
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
  }

  return response;
}

/**
 * Get TEE public address (settler address)
 * Why: The frontend needs to know the TEE's public address to display it or
 * use it for contract interactions.
 * 
 * @returns The TEE's Ethereum address
 */
export async function getSettlerAddress(): Promise<{ publicKey: string }> {
  const response = await apiRequest('/settler');
  return response.json();
}

/**
 * Get Escrow contract address
 * Why: The frontend needs to know which Escrow contract this TEE server is
 * managing. This allows the frontend to display contract information, build
 * block explorer links, and verify it's connected to the correct TEE server.
 * 
 * @returns The Escrow contract address (or null if not configured)
 */
export async function getEscrowAddress(): Promise<{ address: string | null }> {
  const response = await apiRequest('/escrowAddress');
  return response.json();
}

/**
 * Test Privy authentication and get user email
 * Why: This endpoint verifies the user's Privy token is valid and returns
 * their email address. Used to confirm authentication is working.
 * 
 * @param token - Privy access token
 * @returns User's email and authentication message
 */
export async function getHello(token: string): Promise<{ message: string; email: string | null }> {
  const response = await apiRequest('/hello', token);
  return response.json();
}

/**
 * Get total deposits since TEE server started
 * Why: Displays statistics about deposit activity on the escrow contract.
 * 
 * @returns Total deposits in wei and ETH
 */
export async function getDeposits(): Promise<{
  totalDeposits: string;
  totalDepositsEth: string;
}> {
  const response = await apiRequest('/deposits');
  return response.json();
}

/**
 * Get total withdrawals since TEE server started
 * Why: Displays statistics about withdrawal activity.
 * 
 * @returns Total withdrawals in wei and ETH
 */
export async function getWithdrawals(): Promise<{
  totalWithdrawals: string;
  totalWithdrawalsEth: string;
}> {
  const response = await apiRequest('/withdrawals');
  return response.json();
}

/**
 * Get total transfers since TEE server started
 * Why: Displays statistics about settlement transfers executed by the TEE.
 * 
 * @returns Total transfers in wei and ETH
 */
export async function getTransfers(): Promise<{
  totalTransfers: string;
  totalTransfersEth: string;
}> {
  const response = await apiRequest('/transfers');
  return response.json();
}

/**
 * Transfer escrow balance to another address
 * Why: This is the core settlement mechanism. Users request transfers, and the
 * TEE executes them on the blockchain.
 * 
 * @param token - Privy access token
 * @param amount - Amount in ETH (as string, e.g., "0.5")
 * @param recipient - Recipient's Ethereum address
 * @returns Transaction hash and receipt
 */
export async function transferEscrowBalance(
  token: string,
  amount: string,
  recipient: string
): Promise<{
  success: boolean;
  message: string;
  transactionHash: string;
  from: string;
  to: string;
  amount: string;
  receipt: {
    blockNumber: string;
    blockHash: string;
    status: string;
  };
}> {
  const response = await apiRequest('/transfer', token, {
    method: 'POST',
    body: JSON.stringify({ amount, recipient }),
  });
  return response.json();
}

