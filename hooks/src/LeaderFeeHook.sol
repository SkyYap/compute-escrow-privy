// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseHook} from "@uniswap/v4-periphery/src/utils/BaseHook.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {
    BeforeSwapDelta,
    BeforeSwapDeltaLibrary
} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IAuction} from "./interfaces/IAuction.sol";

/**
 * @title LeaderFeeHook
 * @dev Uniswap V4 hook that allows auction winners to set swap fees and collect them
 * @notice Uses Arbitrum Timeboost pattern: caches leader to avoid external calls on every swap
 *
 * Flow:
 * 1. Auction.resolveRound() calls hook.updateLeader(winner)
 * 2. Hook caches leader address and timestamp
 * 3. On swaps, hook checks cached leader (no external call) and applies their fee
 * 4. Fees accumulate in hook treasury, leaders can withdraw anytime
 */
contract LeaderFeeHook is BaseHook {
    using PoolIdLibrary for PoolKey;

    // ============ Events ============
    event LeaderUpdated(address indexed leader, uint256 timestamp);
    event FeeUpdated(address indexed leader, uint24 fee);
    event FeeAccumulated(address indexed leader, uint256 amount, address token);
    event FeesWithdrawn(address indexed leader, uint256 amount, address token);

    // ============ Constants ============
    uint24 public constant DEFAULT_FEE = 3000; // 0.3%
    uint24 public constant MIN_FEE = 1; // 0.00001%
    uint24 public constant MAX_FEE = 50000; // 5%
    uint256 public constant ROUND_DURATION = 60; // 60 seconds

    // ============ Immutables ============
    IAuction public immutable auction;

    // ============ Cached Leader State (Timeboost pattern) ============
    address public cachedLeader;
    uint256 public leadershipStart;
    uint24 public cachedLeaderFee;

    // ============ Fee Configuration ============
    /// @notice Each address's preferred fee (set before becoming leader)
    mapping(address => uint24) public leaderFees;

    // ============ Treasury ============
    /// @notice Accumulated fees per leader per token
    mapping(address => mapping(address => uint256)) public unclaimedFees;

    // ============ Constructor ============
    constructor(
        IPoolManager _poolManager,
        IAuction _auction
    ) BaseHook(_poolManager) {
        auction = _auction;
    }

    // ============ Hook Permissions ============
    function getHookPermissions()
        public
        pure
        override
        returns (Hooks.Permissions memory)
    {
        return
            Hooks.Permissions({
                beforeInitialize: false,
                afterInitialize: false,
                beforeAddLiquidity: false,
                afterAddLiquidity: false,
                beforeRemoveLiquidity: false,
                afterRemoveLiquidity: false,
                beforeSwap: true, // Apply leader's fee
                afterSwap: true, // Collect fees for leader
                beforeDonate: false,
                afterDonate: false,
                beforeSwapReturnDelta: false,
                afterSwapReturnDelta: false,
                afterAddLiquidityReturnDelta: false,
                afterRemoveLiquidityReturnDelta: false
            });
    }

    // ============ Leader Management (Called by Auction) ============

    /**
     * @dev Called by Auction contract when a new leader is crowned
     * @param newLeader Address of the new leader
     * @notice This is the Timeboost pattern - cache leader to avoid external calls on swaps
     */
    function updateLeader(address newLeader) external {
        require(
            msg.sender == address(auction),
            "Only auction can update leader"
        );

        cachedLeader = newLeader;
        leadershipStart = block.timestamp;
        cachedLeaderFee = leaderFees[newLeader] > 0
            ? leaderFees[newLeader]
            : DEFAULT_FEE;

        emit LeaderUpdated(newLeader, block.timestamp);
    }

    // ============ Fee Configuration ============

    /**
     * @dev Set your preferred swap fee (can be set before becoming leader)
     * @param fee Fee in basis points (max 10000 = 1%)
     */
    function setFee(uint24 fee) external {
        require(
            fee >= MIN_FEE && fee <= MAX_FEE,
            "Fee out of range (0.00001% - 5%)"
        );

        leaderFees[msg.sender] = fee;

        // Update cached fee if caller is current active leader
        if (msg.sender == cachedLeader && _isLeaderActive()) {
            cachedLeaderFee = fee;
        }

        emit FeeUpdated(msg.sender, fee);
    }

    // ============ Fee Withdrawal ============

    /**
     * @dev Withdraw accumulated fees for a specific token
     * @param token Token address to withdraw (address(0) for native ETH)
     */
    function withdrawFees(address token) external {
        uint256 amount = unclaimedFees[msg.sender][token];
        require(amount > 0, "No fees to withdraw");

        unclaimedFees[msg.sender][token] = 0;

        if (token == address(0)) {
            (bool success, ) = payable(msg.sender).call{value: amount}("");
            require(success, "ETH transfer failed");
        } else {
            // For ERC20 tokens, use the pool manager's transfer
            // This is simplified - actual implementation depends on V4's token handling
            Currency currency = Currency.wrap(token);
            poolManager.unlock(abi.encode(msg.sender, currency, amount));
        }

        emit FeesWithdrawn(msg.sender, amount, token);
    }

    // ============ Hook Callbacks ============

    /**
     * @dev Called before each swap - returns the fee to apply
     * @notice Uses cached leader (no external call) for gas efficiency
     */
    function beforeSwap(
        address,
        PoolKey calldata,
        IPoolManager.SwapParams calldata,
        bytes calldata
    ) external view override returns (bytes4, BeforeSwapDelta, uint24) {
        uint24 fee = DEFAULT_FEE;

        if (_isLeaderActive() && cachedLeaderFee > 0) {
            fee = cachedLeaderFee;
        }

        return (
            BaseHook.beforeSwap.selector,
            BeforeSwapDeltaLibrary.ZERO_DELTA,
            fee
        );
    }

    /**
     * @dev Called after each swap - accumulates fees for the leader
     */
    function afterSwap(
        address,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata
    ) external override returns (bytes4, int128) {
        if (_isLeaderActive() && cachedLeader != address(0)) {
            // Calculate fee amount based on swap delta
            // The fee is already applied by the pool, we just track it
            int128 amount0 = delta.amount0();
            int128 amount1 = delta.amount1();

            // Track fees in the output token (simplified)
            if (params.zeroForOne && amount1 < 0) {
                // Swapped token0 for token1, fee is in token1
                uint256 feeAmount = (uint256(uint128(-amount1)) *
                    cachedLeaderFee) / 1_000_000;
                address token1 = Currency.unwrap(key.currency1);
                unclaimedFees[cachedLeader][token1] += feeAmount;
                emit FeeAccumulated(cachedLeader, feeAmount, token1);
            } else if (!params.zeroForOne && amount0 < 0) {
                // Swapped token1 for token0, fee is in token0
                uint256 feeAmount = (uint256(uint128(-amount0)) *
                    cachedLeaderFee) / 1_000_000;
                address token0 = Currency.unwrap(key.currency0);
                unclaimedFees[cachedLeader][token0] += feeAmount;
                emit FeeAccumulated(cachedLeader, feeAmount, token0);
            }
        }

        return (BaseHook.afterSwap.selector, 0);
    }

    // ============ Internal Helpers ============

    /**
     * @dev Check if current cached leader is still active (within round duration)
     * @notice This is the key Timeboost optimization - just a timestamp check, no external call
     */
    function _isLeaderActive() internal view returns (bool) {
        return
            cachedLeader != address(0) &&
            block.timestamp < leadershipStart + ROUND_DURATION;
    }

    // ============ View Functions ============

    /**
     * @dev Get the currently active leader (or address(0) if expired)
     */
    function getCurrentLeader() external view returns (address) {
        return _isLeaderActive() ? cachedLeader : address(0);
    }

    /**
     * @dev Get the current fee being applied
     */
    function getCurrentFee() external view returns (uint24) {
        return _isLeaderActive() ? cachedLeaderFee : DEFAULT_FEE;
    }

    /**
     * @dev Check how much time remains in current leadership period
     */
    function getLeadershipTimeRemaining() external view returns (uint256) {
        if (!_isLeaderActive()) return 0;
        return (leadershipStart + ROUND_DURATION) - block.timestamp;
    }

    // ============ Receive ETH ============
    receive() external payable {}
}
