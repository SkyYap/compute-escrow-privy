// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {Auction} from "../src/Auction.sol";

/**
 * @title AuctionTest
 * @dev Test suite for Timeboost-style Auction contract
 */
contract AuctionTest is Test {
    Auction public auction;

    address public owner;
    address public settler;
    address public bidder1;
    address public bidder2;
    address public bidder3;

    uint256 constant INITIAL_BALANCE = 100 ether;

    // Events
    event BidPlaced(address indexed bidder, uint256 amount, uint256 forRound);
    event RoundResolved(
        uint256 indexed round,
        address indexed winner,
        uint256 pricePaid,
        uint256 winningBid
    );
    event CollateralDeposited(
        address indexed user,
        uint256 amount,
        uint256 totalCollateral
    );

    function setUp() public {
        owner = address(this);
        settler = address(0x100);
        bidder1 = address(0x1);
        bidder2 = address(0x2);
        bidder3 = address(0x3);

        auction = new Auction();
        auction.updateSettler(settler);

        vm.deal(bidder1, INITIAL_BALANCE);
        vm.deal(bidder2, INITIAL_BALANCE);
        vm.deal(bidder3, INITIAL_BALANCE);
    }

    // ============ Constructor Tests ============

    function test_Constructor_InitializesState() public view {
        assertEq(auction.owner(), owner);
        assertEq(auction.currentRound(), 0);
        assertEq(auction.currentLeader(), address(0));
    }

    // ============ Collateral Tests ============

    function test_DepositCollateral_Success() public {
        uint256 amount = 10 ether;

        vm.prank(bidder1);
        auction.depositCollateral{value: amount}();

        assertEq(auction.userCollateral(bidder1), amount);
    }

    function test_DepositCollateral_ViaReceive() public {
        uint256 amount = 10 ether;

        vm.prank(bidder1);
        (bool success, ) = address(auction).call{value: amount}("");
        assertTrue(success);

        assertEq(auction.userCollateral(bidder1), amount);
    }

    function test_WithdrawCollateral_Success() public {
        uint256 depositAmount = 10 ether;
        uint256 withdrawAmount = 5 ether;

        vm.prank(bidder1);
        auction.depositCollateral{value: depositAmount}();

        uint256 balanceBefore = bidder1.balance;
        vm.prank(bidder1);
        auction.withdrawCollateral(withdrawAmount);

        assertEq(
            auction.userCollateral(bidder1),
            depositAmount - withdrawAmount
        );
        assertEq(bidder1.balance, balanceBefore + withdrawAmount);
    }

    // ============ Bidding Tests ============

    function test_Bid_Success() public {
        uint256 collateral = 10 ether;
        uint256 bidAmount = 5 ether;

        vm.prank(bidder1);
        auction.depositCollateral{value: collateral}();

        vm.prank(bidder1);
        auction.bid(bidAmount);

        assertEq(auction.nextRoundHighestBidder(), bidder1);
        assertEq(auction.nextRoundHighestBid(), bidAmount);
        assertEq(auction.nextRoundSecondBid(), 0);
    }

    function test_Bid_SecondBidUpdatesSecondPrice() public {
        uint256 collateral = 10 ether;
        uint256 bid1Amount = 3 ether;
        uint256 bid2Amount = 5 ether;

        vm.prank(bidder1);
        auction.depositCollateral{value: collateral}();
        vm.prank(bidder1);
        auction.bid(bid1Amount);

        vm.prank(bidder2);
        auction.depositCollateral{value: collateral}();
        vm.prank(bidder2);
        auction.bid(bid2Amount);

        assertEq(auction.nextRoundHighestBidder(), bidder2);
        assertEq(auction.nextRoundHighestBid(), bid2Amount);
        assertEq(auction.nextRoundSecondBid(), bid1Amount);
    }

    function test_Bid_RevertIfNotHigherThanCurrent() public {
        uint256 collateral = 10 ether;

        vm.prank(bidder1);
        auction.depositCollateral{value: collateral}();
        vm.prank(bidder1);
        auction.bid(5 ether);

        vm.prank(bidder2);
        auction.depositCollateral{value: collateral}();
        vm.prank(bidder2);
        vm.expectRevert("Bid must be higher than current highest bid");
        auction.bid(4 ether);
    }

    // ============ Round Resolution Tests ============

    function test_ResolveRound_WinnerPaysSecondPrice() public {
        uint256 collateral = 10 ether;
        uint256 bid1 = 2 ether;
        uint256 bid2 = 5 ether;

        vm.prank(bidder1);
        auction.depositCollateral{value: collateral}();
        vm.prank(bidder1);
        auction.bid(bid1);

        vm.prank(bidder2);
        auction.depositCollateral{value: collateral}();
        vm.prank(bidder2);
        auction.bid(bid2);

        vm.warp(block.timestamp + 61);

        vm.prank(settler);
        auction.resolveRound();

        assertEq(auction.currentLeader(), bidder2);
        assertEq(auction.currentRoundPricePaid(), bid1);
        assertEq(auction.currentRound(), 1);
        assertEq(auction.userCollateral(bidder2), collateral - bid1);
        assertEq(auction.rentPool(), bid1);
    }

    function test_ResolveRound_SingleBidder_PaysZero() public {
        uint256 collateral = 10 ether;
        uint256 bidAmount = 5 ether;

        vm.prank(bidder1);
        auction.depositCollateral{value: collateral}();
        vm.prank(bidder1);
        auction.bid(bidAmount);

        vm.warp(block.timestamp + 61);

        vm.prank(settler);
        auction.resolveRound();

        assertEq(auction.currentLeader(), bidder1);
        assertEq(auction.currentRoundPricePaid(), 0);
        assertEq(auction.userCollateral(bidder1), collateral);
        assertEq(auction.rentPool(), 0);
    }

    function test_ResolveRound_OnlySettler() public {
        vm.warp(block.timestamp + 61);

        vm.prank(bidder1);
        vm.expectRevert("Only settler can call this function");
        auction.resolveRound();
    }

    function test_ResolveRound_RevertIfStillActive() public {
        vm.prank(settler);
        vm.expectRevert("Current round is still active");
        auction.resolveRound();
    }

    function test_ResolveRound_NoBids_NoLeader() public {
        vm.warp(block.timestamp + 61);

        vm.prank(settler);
        auction.resolveRound();

        assertEq(auction.currentLeader(), address(0));
        assertEq(auction.currentRound(), 1);
    }

    // ============ Continuous Bidding Tests ============

    function test_ContinuousBidding_BidForNextRoundWhileCurrentActive() public {
        uint256 collateral = 10 ether;

        // Round 1: bidder1 wins
        vm.prank(bidder1);
        auction.depositCollateral{value: collateral}();
        vm.prank(bidder1);
        auction.bid(1 ether);

        vm.warp(block.timestamp + 61);
        vm.prank(settler);
        auction.resolveRound();
        assertEq(auction.currentLeader(), bidder1);

        // While Round 1 is active, bid for Round 2
        vm.prank(bidder2);
        auction.depositCollateral{value: collateral}();
        vm.prank(bidder2);
        auction.bid(2 ether);

        // bidder1 is still leader
        assertEq(auction.currentLeader(), bidder1);
        // bidder2 is pending for next round
        assertEq(auction.nextRoundHighestBidder(), bidder2);
    }
}
