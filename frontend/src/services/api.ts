/**
 * @file services/api.ts
 * @description API client for communicating with the TEE server
 */

import { TEE_SERVER_URL } from '../config/constants';

/**
 * Make an API request
 */
async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${TEE_SERVER_URL}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

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

  const response = await fetch(url, {
    ...options,
    headers: headers as HeadersInit,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
  }

  return response;
}

/**
 * Get TEE public address (settler address)
 */
export async function getSettlerAddress(): Promise<{ publicKey: string }> {
  const response = await apiRequest('/settler');
  return response.json();
}

/**
 * Get Auction contract address
 */
export async function getAuctionAddress(): Promise<{ address: string | null }> {
  const response = await apiRequest('/auctionAddress');
  return response.json();
}

/**
 * Get total deposits since TEE server started
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
 */
export async function getWithdrawals(): Promise<{
  totalWithdrawals: string;
  totalWithdrawalsEth: string;
}> {
  const response = await apiRequest('/withdrawals');
  return response.json();
}

/**
 * Get total bids since TEE server started
 */
export async function getBids(): Promise<{
  totalBids: string;
  totalBidsEth: string;
}> {
  const response = await apiRequest('/bids');
  return response.json();
}

/**
 * Get rounds resolved count
 */
export async function getRoundsResolved(): Promise<{
  roundsResolved: number;
}> {
  const response = await apiRequest('/rounds');
  return response.json();
}

/**
 * Check if round can be resolved
 */
export async function canResolveRound(): Promise<{ canResolve: boolean }> {
  const response = await apiRequest('/canResolve');
  return response.json();
}
