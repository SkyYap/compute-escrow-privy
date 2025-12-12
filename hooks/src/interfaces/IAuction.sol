// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title IAuction
 * @dev Interface for the Auction contract
 */
interface IAuction {
    /// @notice Current leader (winner of auction)
    function currentLeader() external view returns (address);

    /// @notice Current round number
    function currentRound() external view returns (uint256);

    /// @notice Round duration in seconds
    function ROUND_DURATION() external view returns (uint256);

    /// @notice Timestamp when current round started
    function currentRoundStart() external view returns (uint256);
}
