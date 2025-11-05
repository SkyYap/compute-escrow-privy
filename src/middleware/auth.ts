/**
 * @file middleware/auth.ts
 * @description Privy authentication middleware for Express routes
 * 
 * This middleware handles user authentication using Privy's server-side SDK.
 * Privy is a wallet authentication service that allows users to sign in with
 * their crypto wallets (MetaMask, WalletConnect, etc.) or traditional email.
 * 
 * Why this exists:
 * - Privy provides a secure, production-ready authentication system
 * - Handles wallet connection and verification automatically
 * - Provides user identity information (wallet address, email)
 * - Separates authentication logic from route handlers
 * 
 * Flow:
 * 1. Client sends JWT token in Authorization header
 * 2. Middleware verifies token with Privy servers
 * 3. Middleware fetches user details from Privy
 * 4. User info attached to request object for route handlers
 */

import { PrivyClient } from '@privy-io/server-auth';
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';

// Initialize Privy client - will be set after dotenv loads
// Why: Module-level variable so it's initialized once and reused across requests
let privy: PrivyClient | null = null;

/**
 * Initialize the Privy client from environment variables
 * Why: Must be called at application startup, after dotenv.config() loads environment
 * variables. This creates the Privy client instance that will be used to verify tokens.
 */
export const initializePrivyClient = () => {
  if (!process.env.PRIVY_APP_ID || !process.env.PRIVY_APP_SECRET) {
    console.warn('⚠️  Privy credentials not found - Privy routes will not work');
    return;
  }

  privy = new PrivyClient(
    process.env.PRIVY_APP_ID,
    process.env.PRIVY_APP_SECRET
  );

  console.log('✅ Privy client initialized');
};

/**
 * Express middleware to authenticate users via Privy
 * 
 * Why this middleware exists:
 * - Protects routes that require user authentication
 * - Validates Privy JWT tokens to ensure requests are from authenticated users
 * - Extracts user information (wallet address, email) for use in route handlers
 * - Provides consistent error handling for authentication failures
 * 
 * Usage:
 *   app.get('/protected-route', authenticateUser, (req: AuthenticatedRequest, res) => {
 *     // req.user is now available with user.id, user.address, user.email
 *   });
 * 
 * @param req - Express request object (will be augmented with user info)
 * @param res - Express response object
 * @param next - Express next function to continue to route handler
 */
export const authenticateUser = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  // Check if Privy client is initialized
  // Why: If Privy credentials aren't set, we can't authenticate users.
  // Return 503 (Service Unavailable) to indicate the service isn't properly configured.
  if (!privy) {
    return res.status(503).json({
      error: 'Privy client not initialized',
    });
  }

  try {
    // Extract Bearer token from Authorization header
    // Why: Standard OAuth2/JWT pattern. Clients send: "Authorization: Bearer <token>"
    // We need to extract just the token part.
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Missing or invalid authorization header',
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify the token with Privy servers
    // Why: This validates that the token was issued by Privy and hasn't been tampered with.
    // Privy's servers verify the signature and expiration.
    const claims = await privy.verifyAuthToken(token);
    const userId = claims.userId;
    
    if (!userId) {
      return res.status(401).json({
        error: 'Invalid token: missing user ID',
      });
    }

    // Fetch full user details from Privy
    // Why: The token only contains the user ID. We need to fetch the full user object
    // to get the wallet address and email.
    const user = await privy.getUserById(userId);
    
    if (!user) {
      return res.status(401).json({
        error: 'User not found',
      });
    }

    // Extract wallet address from user's linked accounts
    // Why: Users can have multiple linked accounts (email, wallet, social, etc.).
    // We need the wallet account specifically because that's what we use for blockchain operations.
    const walletAccount = user.linkedAccounts?.find(
      (account: any) => account.type === 'wallet'
    ) as any;
    const address = walletAccount?.address;

    if (!address) {
      return res.status(401).json({
        error: 'No wallet address found for user',
      });
    }

    // Extract email (optional, may not be present)
    // Why: Some users may only have wallet authentication, not email.
    // We include it if available for user identification purposes.
    const email = user.email?.address || null;

    // Attach user info to request object
    // Why: Express middleware can augment the request object. By attaching user info here,
    // route handlers can access it via req.user without needing to re-authenticate.
    req.user = {
      id: user.id,
      address: address.toLowerCase(), // Normalize to lowercase for consistency
      email: email,
    };

    // Continue to the next middleware or route handler
    // Why: Authentication succeeded, so we pass control to the route handler.
    next();
  } catch (error) {
    // Handle authentication errors
    // Why: Any error during authentication (invalid token, network error, etc.)
    // should result in a 401 Unauthorized response.
    console.error('Authentication error:', error);
    return res.status(401).json({
      error: 'Authentication failed',
    });
  }
};

