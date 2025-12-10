// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Auction
 * @dev Timeboost-style sealed-bid, second-price continuous auction
 * @notice Highest bidder wins 60 seconds of leadership. Winner pays second-highest bid.
 *         Bidding for Round N+1 is open while Round N is active.
 */
contract Auction is Ownable {
    // ============ Events ============
    event SettlerUpdated(
        address indexed oldSettler,
        address indexed newSettler
    );
    event CollateralDeposited(
        address indexed user,
        uint256 amount,
        uint256 totalCollateral
    );
    event CollateralWithdrawn(
        address indexed user,
        uint256 amount,
        uint256 totalCollateral
    );
    event BidPlaced(address indexed bidder, uint256 amount, uint256 forRound);
    event RoundResolved(
        uint256 indexed round,
        address indexed winner,
        uint256 pricePaid,
        uint256 winningBid
    );
    event LeadershipExpired(address indexed previousLeader, uint256 round);
    event RentCollected(
        address indexed from,
        uint256 amount,
        uint256 totalRentPool
    );
    event RentWithdrawn(address indexed owner, uint256 amount);

    // ============ Constants ============
    uint256 public constant ROUND_DURATION = 60; // 60 seconds per round

    // ============ State Variables ============

    /// @notice The settler address (TEE public key for EigenX)
    address public settler;

    /// @notice Current round number (increments each resolution)
    uint256 public currentRound;

    /// @notice Timestamp when current round started
    uint256 public currentRoundStart;

    /// @notice Current leader (winner of auction)
    address public currentLeader;

    /// @notice Price paid by current leader (second-highest bid)
    uint256 public currentRoundPricePaid;

    // --- Next Round Bidding State ---
    /// @notice Highest bidder for next round
    address public nextRoundHighestBidder;

    /// @notice Highest bid amount for next round
    uint256 public nextRoundHighestBid;

    /// @notice Second-highest bid for next round (price winner will pay)
    uint256 public nextRoundSecondBid;

    /// @notice User collateral balances (ETH)
    mapping(address => uint256) public userCollateral;

    /// @notice Accumulated rent from winning bids (for owner to withdraw)
    uint256 public rentPool;

    // ============ Modifiers ============

    modifier onlySettler() {
        _onlySettler();
        _;
    }

    function _onlySettler() internal view {
        require(msg.sender == settler, "Only settler can call this function");
    }

    // ============ Constructor ============

    constructor() Ownable(msg.sender) {
        currentRound = 0;
        currentRoundStart = block.timestamp;
        settler = msg.sender;
    }

    // ============ Owner Functions ============

    /**
     * @dev Update the settler address (TEE public key)
     * @param _newSettler The new settler address
     */
    function updateSettler(address _newSettler) external onlyOwner {
        require(_newSettler != address(0), "Settler cannot be zero address");
        address oldSettler = settler;
        settler = _newSettler;
        emit SettlerUpdated(oldSettler, _newSettler);
    }

    // ============ Collateral Functions ============

    /**
     * @dev Deposit ETH as collateral for bidding
     */
    function depositCollateral() external payable {
        require(msg.value > 0, "Amount must be greater than zero");
        userCollateral[msg.sender] += msg.value;
        emit CollateralDeposited(
            msg.sender,
            msg.value,
            userCollateral[msg.sender]
        );
    }

    /**
     * @dev Withdraw collateral (only if not locked as highest bidder for next round)
     * @param amount Amount to withdraw
     */
    function withdrawCollateral(uint256 amount) external {
        require(amount > 0, "Amount must be greater than zero");
        require(
            userCollateral[msg.sender] >= amount,
            "Insufficient collateral"
        );

        // Cannot withdraw below locked bid if user is highest bidder for next round
        if (msg.sender == nextRoundHighestBidder) {
            require(
                userCollateral[msg.sender] - amount >= nextRoundHighestBid,
                "Collateral locked for next round bid"
            );
        }

        userCollateral[msg.sender] -= amount;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "ETH transfer failed");

        emit CollateralWithdrawn(
            msg.sender,
            amount,
            userCollateral[msg.sender]
        );
    }

    // ============ Bidding Functions ============

    /**
     * @dev Place a bid to become leader of the NEXT round
     * @param amount Bid amount (must be higher than current highest bid for next round)
     * @notice Uses second-price auction: winner pays second-highest bid
     */
    function bid(uint256 amount) external {
        require(amount > 0, "Bid amount must be greater than zero");
        require(
            amount > nextRoundHighestBid,
            "Bid must be higher than current highest bid"
        );
        require(
            userCollateral[msg.sender] >= amount,
            "Insufficient collateral for bid"
        );

        // Update second-highest bid before replacing highest
        nextRoundSecondBid = nextRoundHighestBid;

        // Set new highest bidder
        nextRoundHighestBidder = msg.sender;
        nextRoundHighestBid = amount;

        emit BidPlaced(msg.sender, amount, currentRound + 1);
    }

    /**
     * @dev Resolve the current round and start the next one
     * @notice Only the settler (TEE) can call this to trigger round transitions
     */
    function resolveRound() external onlySettler {
        require(
            block.timestamp >= currentRoundStart + ROUND_DURATION,
            "Current round is still active"
        );

        // Expire previous leader
        if (currentLeader != address(0)) {
            emit LeadershipExpired(currentLeader, currentRound);
        }

        // Increment round
        currentRound += 1;
        currentRoundStart = block.timestamp;

        // Resolve winner for this new round
        if (nextRoundHighestBidder != address(0)) {
            address winner = nextRoundHighestBidder;
            uint256 priceToPay = nextRoundSecondBid; // Second-price auction

            // Deduct price from winner's collateral -> rentPool
            require(
                userCollateral[winner] >= priceToPay,
                "Winner has insufficient collateral for price"
            );
            userCollateral[winner] -= priceToPay;
            rentPool += priceToPay;
            emit RentCollected(winner, priceToPay, rentPool);

            // Set new leader
            currentLeader = winner;
            currentRoundPricePaid = priceToPay;

            emit RoundResolved(
                currentRound,
                winner,
                priceToPay,
                nextRoundHighestBid
            );

            // Clear next-round bidding state
            nextRoundHighestBidder = address(0);
            nextRoundHighestBid = 0;
            nextRoundSecondBid = 0;
        } else {
            // No bids for this round -> no leader
            currentLeader = address(0);
            currentRoundPricePaid = 0;

            emit RoundResolved(currentRound, address(0), 0, 0);
        }
    }

    // ============ Receive ETH ============

    /// @notice Fallback to deposit collateral when ETH is sent directly
    receive() external payable {
        userCollateral[msg.sender] += msg.value;
        emit CollateralDeposited(
            msg.sender,
            msg.value,
            userCollateral[msg.sender]
        );
    }
}
