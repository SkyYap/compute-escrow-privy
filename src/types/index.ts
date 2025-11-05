/**
 * @file types/index.ts
 * @description Type definitions used throughout the application
 * 
 * Centralizing types here makes it easier to:
 * - Maintain consistent types across the codebase
 * - Understand the data structures used
 * - Reuse types in multiple files
 */

import { Request } from 'express';

/**
 * Authenticated request interface
 * Why: Express doesn't natively support adding properties to the Request object.
 * This interface extends Express Request to include authenticated user information
 * that's added by the authentication middleware. This provides type safety when
 * accessing req.user in route handlers.
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;        // Privy user ID
    address: string;   // User's wallet address (normalized to lowercase)
    email?: string | null;  // User's email address (if available)
  };
}

