/**
 * @file config/contracts.ts
 * @description Contract configuration for Base Sepolia
 */

// ============================================
// Uniswap V4 Core Contracts (Base Sepolia)
// ============================================
export const POOL_MANAGER_ADDRESS = '0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408' as const;
export const POOL_SWAP_TEST_ADDRESS = '0x8b5bcc363dde2614281ad875bad385e0a785d3b9' as const;
export const POOL_MODIFY_LIQUIDITY_TEST_ADDRESS = '0x37429cd17cb1454c34e7f50b09725202fd533039' as const;
export const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3' as const;

// ============================================
// LeaderFeeHook Contract
// ============================================
// Replace with your deployed hook address after running deployment script
export const LEADER_FEE_HOOK_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

// ============================================
// Token Addresses (Base Sepolia)
// ============================================
export const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const;
export const NATIVE_ETH = '0x0000000000000000000000000000000000000000' as const;

// Token metadata for UI
export const TOKENS = {
    ETH: {
        address: NATIVE_ETH,
        symbol: 'ETH',
        name: 'Ethereum',
        decimals: 18,
    },
    USDC: {
        address: USDC_ADDRESS,
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
    },
} as const;

// ============================================
// Pool Configuration
// ============================================
// Note: In V4, ETH is represented as address(0) but sorted as Currency
// USDC (0x036...) > ETH (0x000...) so token0 = ETH, token1 = USDC
export const POOL_CONFIG = {
    token0: NATIVE_ETH,      // ETH (lower address)
    token1: USDC_ADDRESS,    // USDC (higher address)
    fee: 3000,               // 0.3% base fee (dynamic via hook)
    tickSpacing: 60,         // Standard for 0.3% pools
    // sqrtPriceX96 for ~2000 USDC per ETH initial price
    // sqrt(2000) * 2^96 ≈ 3543191142285914205922034323214
    initialSqrtPriceX96: '3543191142285914205922034323214',
} as const;

// ============================================
// LeaderFeeHook ABI
// ============================================
export const LEADER_FEE_HOOK_ABI = [
    // Events
    {
        type: 'event',
        name: 'LeaderUpdated',
        inputs: [
            { name: 'leader', type: 'address', indexed: true },
            { name: 'timestamp', type: 'uint256', indexed: false }
        ]
    },
    {
        type: 'event',
        name: 'FeeUpdated',
        inputs: [
            { name: 'leader', type: 'address', indexed: true },
            { name: 'fee', type: 'uint24', indexed: false }
        ]
    },
    {
        type: 'event',
        name: 'FeeAccumulated',
        inputs: [
            { name: 'leader', type: 'address', indexed: true },
            { name: 'amount', type: 'uint256', indexed: false },
            { name: 'token', type: 'address', indexed: false }
        ]
    },
    {
        type: 'event',
        name: 'FeesWithdrawn',
        inputs: [
            { name: 'leader', type: 'address', indexed: true },
            { name: 'amount', type: 'uint256', indexed: false },
            { name: 'token', type: 'address', indexed: false }
        ]
    },

    // View Functions
    {
        type: 'function',
        name: 'DEFAULT_FEE',
        inputs: [],
        outputs: [{ type: 'uint24' }],
        stateMutability: 'view'
    },
    {
        type: 'function',
        name: 'MIN_FEE',
        inputs: [],
        outputs: [{ type: 'uint24' }],
        stateMutability: 'view'
    },
    {
        type: 'function',
        name: 'MAX_FEE',
        inputs: [],
        outputs: [{ type: 'uint24' }],
        stateMutability: 'view'
    },
    {
        type: 'function',
        name: 'ROUND_DURATION',
        inputs: [],
        outputs: [{ type: 'uint256' }],
        stateMutability: 'view'
    },
    {
        type: 'function',
        name: 'cachedLeader',
        inputs: [],
        outputs: [{ type: 'address' }],
        stateMutability: 'view'
    },
    {
        type: 'function',
        name: 'leadershipStart',
        inputs: [],
        outputs: [{ type: 'uint256' }],
        stateMutability: 'view'
    },
    {
        type: 'function',
        name: 'cachedLeaderFee',
        inputs: [],
        outputs: [{ type: 'uint24' }],
        stateMutability: 'view'
    },
    {
        type: 'function',
        name: 'leaderFees',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ type: 'uint24' }],
        stateMutability: 'view'
    },
    {
        type: 'function',
        name: 'unclaimedFees',
        inputs: [
            { name: 'leader', type: 'address' },
            { name: 'token', type: 'address' }
        ],
        outputs: [{ type: 'uint256' }],
        stateMutability: 'view'
    },
    {
        type: 'function',
        name: 'getCurrentLeader',
        inputs: [],
        outputs: [{ type: 'address' }],
        stateMutability: 'view'
    },
    {
        type: 'function',
        name: 'getCurrentFee',
        inputs: [],
        outputs: [{ type: 'uint24' }],
        stateMutability: 'view'
    },
    {
        type: 'function',
        name: 'getLeadershipTimeRemaining',
        inputs: [],
        outputs: [{ type: 'uint256' }],
        stateMutability: 'view'
    },

    // Write Functions
    {
        type: 'function',
        name: 'setFee',
        inputs: [{ name: 'fee', type: 'uint24' }],
        outputs: [],
        stateMutability: 'nonpayable'
    },
    {
        type: 'function',
        name: 'withdrawFees',
        inputs: [{ name: 'token', type: 'address' }],
        outputs: [],
        stateMutability: 'nonpayable'
    }
] as const;

// ============================================
// PoolSwapTest ABI (Uniswap V4)
// ============================================
export const POOL_SWAP_TEST_ABI = [
    {
        type: 'function',
        name: 'swap',
        inputs: [
            {
                name: 'key',
                type: 'tuple',
                components: [
                    { name: 'currency0', type: 'address' },
                    { name: 'currency1', type: 'address' },
                    { name: 'fee', type: 'uint24' },
                    { name: 'tickSpacing', type: 'int24' },
                    { name: 'hooks', type: 'address' }
                ]
            },
            {
                name: 'params',
                type: 'tuple',
                components: [
                    { name: 'zeroForOne', type: 'bool' },
                    { name: 'amountSpecified', type: 'int256' },
                    { name: 'sqrtPriceLimitX96', type: 'uint160' }
                ]
            },
            {
                name: 'testSettings',
                type: 'tuple',
                components: [
                    { name: 'takeClaims', type: 'bool' },
                    { name: 'settleUsingBurn', type: 'bool' }
                ]
            },
            { name: 'hookData', type: 'bytes' }
        ],
        outputs: [{ name: 'delta', type: 'int256' }],
        stateMutability: 'payable'
    }
] as const;

// ============================================
// PoolModifyLiquidityTest ABI (Uniswap V4)
// ============================================
export const POOL_MODIFY_LIQUIDITY_TEST_ABI = [
    {
        type: 'function',
        name: 'modifyLiquidity',
        inputs: [
            {
                name: 'key',
                type: 'tuple',
                components: [
                    { name: 'currency0', type: 'address' },
                    { name: 'currency1', type: 'address' },
                    { name: 'fee', type: 'uint24' },
                    { name: 'tickSpacing', type: 'int24' },
                    { name: 'hooks', type: 'address' }
                ]
            },
            {
                name: 'params',
                type: 'tuple',
                components: [
                    { name: 'tickLower', type: 'int24' },
                    { name: 'tickUpper', type: 'int24' },
                    { name: 'liquidityDelta', type: 'int256' },
                    { name: 'salt', type: 'bytes32' }
                ]
            },
            { name: 'hookData', type: 'bytes' }
        ],
        outputs: [{ name: 'delta', type: 'int256' }],
        stateMutability: 'payable'
    }
] as const;

// ============================================
// ERC20 ABI (for USDC approvals)
// ============================================
export const ERC20_ABI = [
    {
        type: 'function',
        name: 'approve',
        inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' }
        ],
        outputs: [{ type: 'bool' }],
        stateMutability: 'nonpayable'
    },
    {
        type: 'function',
        name: 'allowance',
        inputs: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' }
        ],
        outputs: [{ type: 'uint256' }],
        stateMutability: 'view'
    },
    {
        type: 'function',
        name: 'balanceOf',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ type: 'uint256' }],
        stateMutability: 'view'
    },
    {
        type: 'function',
        name: 'decimals',
        inputs: [],
        outputs: [{ type: 'uint8' }],
        stateMutability: 'view'
    },
    {
        type: 'function',
        name: 'symbol',
        inputs: [],
        outputs: [{ type: 'string' }],
        stateMutability: 'view'
    }
] as const;

// ============================================
// Tracked tokens for earnings display
// ============================================
export const TRACKED_TOKENS = [
    TOKENS.ETH,
    TOKENS.USDC,
] as const;
