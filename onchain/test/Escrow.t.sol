// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test, console} from "forge-std/Test.sol";
import {Escrow} from "../src/Escrow.sol";

/**
 * @title EscrowTest
 * @dev Comprehensive test suite for Escrow contract
 * @notice Tests all functions, require statements, and edge cases
 */
contract EscrowTest is Test {
    Escrow public escrow;
    address public owner;
    address public settler;
    address public user1;
    address public user2;
    address public nonOwner;
    address public nonSettler;

    // Events from Escrow contract
    event SettlerUpdated(address indexed oldSettler, address indexed newSettler);
    event Deposit(address indexed user, uint256 amount, uint256 totalBalance);
    event Withdrawal(address indexed user, uint256 amount, uint256 totalBalance);
    event EscrowTransfer(
        address indexed settler,
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 fromBalance,
        uint256 toBalance
    );
    
    // Events from Ownable
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // Contract that rejects ETH transfers
    ReceiveFailer public receiveFailer;

    function setUp() public {
        owner = address(this);
        settler = address(0x1);
        user1 = address(0x10);
        user2 = address(0x20);
        nonOwner = address(0x30);
        nonSettler = address(0x40);

        // Deploy Escrow contract
        escrow = new Escrow();

        // Verify initial state
        assertEq(escrow.owner(), owner);
        assertEq(escrow.settler(), owner);

        // Deploy contract that rejects ETH
        receiveFailer = new ReceiveFailer();
    }

    // ============ Constructor Tests ============

    function test_Constructor_SetsOwnerAndSettler() public {
        Escrow newEscrow = new Escrow();
        assertEq(newEscrow.owner(), address(this));
        assertEq(newEscrow.settler(), address(this));
    }

    // ============ updateSettler Tests ============

    function test_UpdateSettler_Success() public {
        address newSettler = address(0x100);
        
        vm.expectEmit(true, true, false, false);
        emit SettlerUpdated(owner, newSettler);
        
        escrow.updateSettler(newSettler);
        
        assertEq(escrow.settler(), newSettler);
    }

    function test_UpdateSettler_OnlyOwner() public {
        address newSettler = address(0x100);
        
        vm.prank(nonOwner);
        vm.expectRevert();
        escrow.updateSettler(newSettler);
        
        // Settler should remain unchanged
        assertEq(escrow.settler(), owner);
    }

    function test_UpdateSettler_ZeroAddress() public {
        vm.expectRevert("Settler cannot be zero address");
        escrow.updateSettler(address(0));
    }

    function test_UpdateSettler_EventEmitted() public {
        address newSettler = address(0x100);
        address oldSettler = escrow.settler();
        
        vm.expectEmit(true, true, false, false);
        emit SettlerUpdated(oldSettler, newSettler);
        
        escrow.updateSettler(newSettler);
    }

    function test_UpdateSettler_MultipleUpdates() public {
        address settler1 = address(0x100);
        address settler2 = address(0x200);
        address settler3 = address(0x300);
        
        escrow.updateSettler(settler1);
        assertEq(escrow.settler(), settler1);
        
        escrow.updateSettler(settler2);
        assertEq(escrow.settler(), settler2);
        
        escrow.updateSettler(settler3);
        assertEq(escrow.settler(), settler3);
    }

    // ============ Deposit (receive) Tests ============

    function test_Receive_DepositETH() public {
        uint256 depositAmount = 1 ether;
        
        vm.deal(user1, depositAmount);
        vm.prank(user1);
        
        vm.expectEmit(true, false, false, false);
        emit Deposit(user1, depositAmount, depositAmount);
        
        (bool success, ) = address(escrow).call{value: depositAmount}("");
        assertTrue(success);
        
        assertEq(escrow.userEscrowBalance(user1), depositAmount);
    }

    function test_Receive_MultipleDeposits() public {
        uint256 deposit1 = 1 ether;
        uint256 deposit2 = 2 ether;
        uint256 totalExpected = deposit1 + deposit2;
        
        vm.deal(user1, totalExpected);
        
        // First deposit
        vm.prank(user1);
        (bool success1, ) = address(escrow).call{value: deposit1}("");
        assertTrue(success1);
        assertEq(escrow.userEscrowBalance(user1), deposit1);
        
        // Second deposit
        vm.prank(user1);
        (bool success2, ) = address(escrow).call{value: deposit2}("");
        assertTrue(success2);
        assertEq(escrow.userEscrowBalance(user1), totalExpected);
    }

    function test_Receive_DepositEvent() public {
        uint256 depositAmount = 1 ether;
        vm.deal(user1, depositAmount);
        
        vm.prank(user1);
        vm.expectEmit(true, false, false, false);
        emit Deposit(user1, depositAmount, depositAmount);
        
        (bool success, ) = address(escrow).call{value: depositAmount}("");
        assertTrue(success);
    }

    function test_Receive_ZeroAmount() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        
        // Zero value deposit should still work (balance stays 0)
        (bool success, ) = address(escrow).call{value: 0}("");
        assertTrue(success);
        assertEq(escrow.userEscrowBalance(user1), 0);
    }

    function test_Receive_MultipleUsers() public {
        uint256 amount1 = 1 ether;
        uint256 amount2 = 2 ether;
        
        vm.deal(user1, amount1);
        vm.deal(user2, amount2);
        
        vm.prank(user1);
        (bool success1, ) = address(escrow).call{value: amount1}("");
        assertTrue(success1);
        
        vm.prank(user2);
        (bool success2, ) = address(escrow).call{value: amount2}("");
        assertTrue(success2);
        
        assertEq(escrow.userEscrowBalance(user1), amount1);
        assertEq(escrow.userEscrowBalance(user2), amount2);
    }

    // ============ withdrawPending Tests ============

    function test_WithdrawPending_Success() public {
        uint256 depositAmount = 1 ether;
        vm.deal(user1, depositAmount);
        
        // Deposit
        vm.prank(user1);
        (bool depositSuccess, ) = address(escrow).call{value: depositAmount}("");
        assertTrue(depositSuccess);
        
        // Withdraw
        uint256 balanceBefore = user1.balance;
        vm.prank(user1);
        
        vm.expectEmit(true, false, false, false);
        emit Withdrawal(user1, depositAmount, 0);
        
        escrow.withdrawPending();
        
        assertEq(escrow.userEscrowBalance(user1), 0);
        assertEq(user1.balance, balanceBefore + depositAmount);
    }

    function test_WithdrawPending_ZeroBalance() public {
        vm.prank(user1);
        vm.expectRevert("No funds to withdraw");
        escrow.withdrawPending();
    }

    function test_WithdrawPending_EventEmitted() public {
        uint256 depositAmount = 1 ether;
        vm.deal(user1, depositAmount);
        
        vm.prank(user1);
        (bool depositSuccess, ) = address(escrow).call{value: depositAmount}("");
        assertTrue(depositSuccess);
        
        vm.prank(user1);
        vm.expectEmit(true, false, false, false);
        emit Withdrawal(user1, depositAmount, 0);
        
        escrow.withdrawPending();
    }

    function test_WithdrawPending_BalanceSetToZero() public {
        uint256 depositAmount = 1 ether;
        vm.deal(user1, depositAmount);
        
        vm.prank(user1);
        (bool depositSuccess, ) = address(escrow).call{value: depositAmount}("");
        assertTrue(depositSuccess);
        
        vm.prank(user1);
        escrow.withdrawPending();
        
        assertEq(escrow.userEscrowBalance(user1), 0);
    }

    function test_WithdrawPending_AfterWithdrawFromEscrow() public {
        uint256 depositAmount = 2 ether;
        vm.deal(user1, depositAmount);
        
        vm.prank(user1);
        (bool depositSuccess, ) = address(escrow).call{value: depositAmount}("");
        assertTrue(depositSuccess);
        
        // Partial withdrawal first
        vm.prank(user1);
        escrow.withdrawFromEscrow(1 ether);
        assertEq(escrow.userEscrowBalance(user1), 1 ether);
        
        // Then withdraw pending (remaining balance)
        vm.prank(user1);
        escrow.withdrawPending();
        assertEq(escrow.userEscrowBalance(user1), 0);
    }

    function test_WithdrawPending_TransferFailure() public {
        // Create a contract without receive/fallback - this will cause transfer to fail
        NoReceiveContract rejector = new NoReceiveContract();
        uint256 depositAmount = 1 ether;
        
        // Manually set the escrow balance (since we can't deposit normally)
        // We'll use the settler to transfer funds to this contract first
        vm.deal(user1, depositAmount);
        vm.prank(user1);
        (bool depositSuccess, ) = address(escrow).call{value: depositAmount}("");
        assertTrue(depositSuccess);
        
        // Transfer to rejector using settler
        escrow.transferEscrowBalance(user1, address(rejector), depositAmount);
        assertEq(escrow.userEscrowBalance(address(rejector)), depositAmount);
        
        // Now try to withdraw - this should fail because rejector has no receive/fallback
        vm.prank(address(rejector));
        vm.expectRevert("Withdrawal failed");
        escrow.withdrawPending();
        
        // Since the transaction reverts, balance should be restored to original value
        assertEq(escrow.userEscrowBalance(address(rejector)), depositAmount);
    }

    function test_WithdrawFromEscrow_TransferFailure() public {
        // Create a contract without receive/fallback - this will cause transfer to fail
        NoReceiveContract rejector = new NoReceiveContract();
        uint256 depositAmount = 1 ether;
        
        // Manually set the escrow balance via transfer
        vm.deal(user1, depositAmount);
        vm.prank(user1);
        (bool depositSuccess, ) = address(escrow).call{value: depositAmount}("");
        assertTrue(depositSuccess);
        
        // Transfer to rejector using settler
        escrow.transferEscrowBalance(user1, address(rejector), depositAmount);
        assertEq(escrow.userEscrowBalance(address(rejector)), depositAmount);
        
        // Try to withdraw - this should fail because rejector has no receive/fallback
        vm.prank(address(rejector));
        vm.expectRevert("ETH transfer failed");
        escrow.withdrawFromEscrow(0.5 ether);
        
        // Since the transaction reverts, balance should be restored to original value
        assertEq(escrow.userEscrowBalance(address(rejector)), depositAmount);
    }

    // ============ withdrawFromEscrow Tests ============

    function test_WithdrawFromEscrow_Success() public {
        uint256 depositAmount = 2 ether;
        uint256 withdrawAmount = 1 ether;
        
        vm.deal(user1, depositAmount);
        vm.prank(user1);
        (bool depositSuccess, ) = address(escrow).call{value: depositAmount}("");
        assertTrue(depositSuccess);
        
        uint256 balanceBefore = user1.balance;
        vm.prank(user1);
        
        vm.expectEmit(true, false, false, false);
        emit Withdrawal(user1, withdrawAmount, depositAmount - withdrawAmount);
        
        escrow.withdrawFromEscrow(withdrawAmount);
        
        assertEq(escrow.userEscrowBalance(user1), depositAmount - withdrawAmount);
        assertEq(user1.balance, balanceBefore + withdrawAmount);
    }

    function test_WithdrawFromEscrow_FullAmount() public {
        uint256 depositAmount = 1 ether;
        vm.deal(user1, depositAmount);
        
        vm.prank(user1);
        (bool depositSuccess, ) = address(escrow).call{value: depositAmount}("");
        assertTrue(depositSuccess);
        
        vm.prank(user1);
        escrow.withdrawFromEscrow(depositAmount);
        
        assertEq(escrow.userEscrowBalance(user1), 0);
    }

    function test_WithdrawFromEscrow_ZeroAmount() public {
        uint256 depositAmount = 1 ether;
        vm.deal(user1, depositAmount);
        
        vm.prank(user1);
        (bool depositSuccess, ) = address(escrow).call{value: depositAmount}("");
        assertTrue(depositSuccess);
        
        vm.prank(user1);
        vm.expectRevert("Amount must be greater than zero");
        escrow.withdrawFromEscrow(0);
    }

    function test_WithdrawFromEscrow_InsufficientBalance() public {
        uint256 depositAmount = 1 ether;
        uint256 withdrawAmount = 2 ether;
        
        vm.deal(user1, depositAmount);
        vm.prank(user1);
        (bool depositSuccess, ) = address(escrow).call{value: depositAmount}("");
        assertTrue(depositSuccess);
        
        vm.prank(user1);
        vm.expectRevert("Insufficient escrow balance");
        escrow.withdrawFromEscrow(withdrawAmount);
    }

    function test_WithdrawFromEscrow_ZeroBalance() public {
        vm.prank(user1);
        vm.expectRevert("Insufficient escrow balance");
        escrow.withdrawFromEscrow(1 ether);
    }

    function test_WithdrawFromEscrow_EventEmitted() public {
        uint256 depositAmount = 2 ether;
        uint256 withdrawAmount = 1 ether;
        vm.deal(user1, depositAmount);
        
        vm.prank(user1);
        (bool depositSuccess, ) = address(escrow).call{value: depositAmount}("");
        assertTrue(depositSuccess);
        
        vm.prank(user1);
        vm.expectEmit(true, false, false, false);
        emit Withdrawal(user1, withdrawAmount, depositAmount - withdrawAmount);
        
        escrow.withdrawFromEscrow(withdrawAmount);
    }

    function test_WithdrawFromEscrow_MultiplePartialWithdrawals() public {
        uint256 depositAmount = 3 ether;
        vm.deal(user1, depositAmount);
        
        vm.prank(user1);
        (bool depositSuccess, ) = address(escrow).call{value: depositAmount}("");
        assertTrue(depositSuccess);
        
        // First withdrawal
        vm.prank(user1);
        escrow.withdrawFromEscrow(1 ether);
        assertEq(escrow.userEscrowBalance(user1), 2 ether);
        
        // Second withdrawal
        vm.prank(user1);
        escrow.withdrawFromEscrow(1 ether);
        assertEq(escrow.userEscrowBalance(user1), 1 ether);
        
        // Third withdrawal
        vm.prank(user1);
        escrow.withdrawFromEscrow(1 ether);
        assertEq(escrow.userEscrowBalance(user1), 0);
    }

    // ============ transferEscrowBalance Tests ============

    function test_TransferEscrowBalance_Success() public {
        // Setup: Update settler and deposit funds
        address newSettler = address(0x100);
        escrow.updateSettler(newSettler);
        
        uint256 depositAmount = 1 ether;
        vm.deal(user1, depositAmount);
        vm.prank(user1);
        (bool depositSuccess, ) = address(escrow).call{value: depositAmount}("");
        assertTrue(depositSuccess);
        
        uint256 transferAmount = 0.5 ether;
        vm.prank(newSettler);
        
        vm.expectEmit(true, true, true, false);
        emit EscrowTransfer(newSettler, user1, user2, transferAmount, depositAmount - transferAmount, transferAmount);
        
        escrow.transferEscrowBalance(user1, user2, transferAmount);
        
        assertEq(escrow.userEscrowBalance(user1), depositAmount - transferAmount);
        assertEq(escrow.userEscrowBalance(user2), transferAmount);
    }

    function test_TransferEscrowBalance_OnlySettler() public {
        address newSettler = address(0x100);
        escrow.updateSettler(newSettler);
        
        uint256 depositAmount = 1 ether;
        vm.deal(user1, depositAmount);
        vm.prank(user1);
        (bool depositSuccess, ) = address(escrow).call{value: depositAmount}("");
        assertTrue(depositSuccess);
        
        vm.prank(nonSettler);
        vm.expectRevert("Only settler can call this function");
        escrow.transferEscrowBalance(user1, user2, 0.5 ether);
    }

    function test_TransferEscrowBalance_ZeroFromAddress() public {
        address newSettler = address(0x100);
        escrow.updateSettler(newSettler);
        
        vm.prank(newSettler);
        vm.expectRevert("From address cannot be zero");
        escrow.transferEscrowBalance(address(0), user2, 1 ether);
    }

    function test_TransferEscrowBalance_ZeroToAddress() public {
        address newSettler = address(0x100);
        escrow.updateSettler(newSettler);
        
        uint256 depositAmount = 1 ether;
        vm.deal(user1, depositAmount);
        vm.prank(user1);
        (bool depositSuccess, ) = address(escrow).call{value: depositAmount}("");
        assertTrue(depositSuccess);
        
        vm.prank(newSettler);
        vm.expectRevert("To address cannot be zero");
        escrow.transferEscrowBalance(user1, address(0), 0.5 ether);
    }

    function test_TransferEscrowBalance_SameAddresses() public {
        address newSettler = address(0x100);
        escrow.updateSettler(newSettler);
        
        uint256 depositAmount = 1 ether;
        vm.deal(user1, depositAmount);
        vm.prank(user1);
        (bool depositSuccess, ) = address(escrow).call{value: depositAmount}("");
        assertTrue(depositSuccess);
        
        vm.prank(newSettler);
        vm.expectRevert("From and to addresses must be different");
        escrow.transferEscrowBalance(user1, user1, 0.5 ether);
    }

    function test_TransferEscrowBalance_ZeroAmount() public {
        address newSettler = address(0x100);
        escrow.updateSettler(newSettler);
        
        uint256 depositAmount = 1 ether;
        vm.deal(user1, depositAmount);
        vm.prank(user1);
        (bool depositSuccess, ) = address(escrow).call{value: depositAmount}("");
        assertTrue(depositSuccess);
        
        vm.prank(newSettler);
        vm.expectRevert("Amount must be greater than zero");
        escrow.transferEscrowBalance(user1, user2, 0);
    }

    function test_TransferEscrowBalance_InsufficientBalance() public {
        address newSettler = address(0x100);
        escrow.updateSettler(newSettler);
        
        uint256 depositAmount = 1 ether;
        vm.deal(user1, depositAmount);
        vm.prank(user1);
        (bool depositSuccess, ) = address(escrow).call{value: depositAmount}("");
        assertTrue(depositSuccess);
        
        vm.prank(newSettler);
        vm.expectRevert("Insufficient escrow balance in source account");
        escrow.transferEscrowBalance(user1, user2, 2 ether);
    }

    function test_TransferEscrowBalance_FullAmount() public {
        address newSettler = address(0x100);
        escrow.updateSettler(newSettler);
        
        uint256 depositAmount = 1 ether;
        vm.deal(user1, depositAmount);
        vm.prank(user1);
        (bool depositSuccess, ) = address(escrow).call{value: depositAmount}("");
        assertTrue(depositSuccess);
        
        vm.prank(newSettler);
        escrow.transferEscrowBalance(user1, user2, depositAmount);
        
        assertEq(escrow.userEscrowBalance(user1), 0);
        assertEq(escrow.userEscrowBalance(user2), depositAmount);
    }

    function test_TransferEscrowBalance_EventEmitted() public {
        address newSettler = address(0x100);
        escrow.updateSettler(newSettler);
        
        uint256 depositAmount = 1 ether;
        uint256 transferAmount = 0.5 ether;
        vm.deal(user1, depositAmount);
        vm.prank(user1);
        (bool depositSuccess, ) = address(escrow).call{value: depositAmount}("");
        assertTrue(depositSuccess);
        
        vm.prank(newSettler);
        vm.expectEmit(true, true, true, false);
        emit EscrowTransfer(newSettler, user1, user2, transferAmount, depositAmount - transferAmount, transferAmount);
        
        escrow.transferEscrowBalance(user1, user2, transferAmount);
    }

    function test_TransferEscrowBalance_MultipleTransfers() public {
        address newSettler = address(0x100);
        escrow.updateSettler(newSettler);
        
        uint256 depositAmount = 3 ether;
        vm.deal(user1, depositAmount);
        vm.prank(user1);
        (bool depositSuccess, ) = address(escrow).call{value: depositAmount}("");
        assertTrue(depositSuccess);
        
        // First transfer
        vm.prank(newSettler);
        escrow.transferEscrowBalance(user1, user2, 1 ether);
        assertEq(escrow.userEscrowBalance(user1), 2 ether);
        assertEq(escrow.userEscrowBalance(user2), 1 ether);
        
        // Second transfer
        vm.prank(newSettler);
        escrow.transferEscrowBalance(user1, user2, 1 ether);
        assertEq(escrow.userEscrowBalance(user1), 1 ether);
        assertEq(escrow.userEscrowBalance(user2), 2 ether);
        
        // Third transfer from user2 to user1
        vm.prank(newSettler);
        escrow.transferEscrowBalance(user2, user1, 0.5 ether);
        assertEq(escrow.userEscrowBalance(user1), 1.5 ether);
        assertEq(escrow.userEscrowBalance(user2), 1.5 ether);
    }

    function test_TransferEscrowBalance_ToAccountWithExistingBalance() public {
        address newSettler = address(0x100);
        escrow.updateSettler(newSettler);
        
        uint256 deposit1 = 1 ether;
        uint256 deposit2 = 2 ether;
        
        vm.deal(user1, deposit1);
        vm.deal(user2, deposit2);
        
        vm.prank(user1);
        (bool success1, ) = address(escrow).call{value: deposit1}("");
        assertTrue(success1);
        
        vm.prank(user2);
        (bool success2, ) = address(escrow).call{value: deposit2}("");
        assertTrue(success2);
        
        uint256 transferAmount = 0.5 ether;
        vm.prank(newSettler);
        escrow.transferEscrowBalance(user1, user2, transferAmount);
        
        assertEq(escrow.userEscrowBalance(user1), deposit1 - transferAmount);
        assertEq(escrow.userEscrowBalance(user2), deposit2 + transferAmount);
    }

    // ============ Integration Tests ============

    function test_Integration_FullWorkflow() public {
        // 1. Deploy contract (already done in setUp)
        address newSettler = address(0x100);
        
        // 2. Update settler
        escrow.updateSettler(newSettler);
        assertEq(escrow.settler(), newSettler);
        
        // 3. Users deposit
        uint256 deposit1 = 2 ether;
        uint256 deposit2 = 3 ether;
        
        vm.deal(user1, deposit1);
        vm.deal(user2, deposit2);
        
        vm.prank(user1);
        (bool success1, ) = address(escrow).call{value: deposit1}("");
        assertTrue(success1);
        
        vm.prank(user2);
        (bool success2, ) = address(escrow).call{value: deposit2}("");
        assertTrue(success2);
        
        // 4. Settler transfers funds
        uint256 transferAmount = 1 ether;
        vm.prank(newSettler);
        escrow.transferEscrowBalance(user1, user2, transferAmount);
        
        assertEq(escrow.userEscrowBalance(user1), deposit1 - transferAmount);
        assertEq(escrow.userEscrowBalance(user2), deposit2 + transferAmount);
        
        // 5. Users withdraw
        uint256 withdrawAmount1 = 0.5 ether;
        vm.prank(user1);
        escrow.withdrawFromEscrow(withdrawAmount1);
        assertEq(escrow.userEscrowBalance(user1), deposit1 - transferAmount - withdrawAmount1);
        
        vm.prank(user2);
        escrow.withdrawPending();
        assertEq(escrow.userEscrowBalance(user2), 0);
    }

    function test_Integration_MultipleOperations() public {
        address newSettler = address(0x100);
        escrow.updateSettler(newSettler);
        
        // Multiple deposits and withdrawals
        vm.deal(user1, 10 ether);
        
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(user1);
            (bool success, ) = address(escrow).call{value: 1 ether}("");
            assertTrue(success);
        }
        
        assertEq(escrow.userEscrowBalance(user1), 5 ether);
        
        // Multiple partial withdrawals
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(user1);
            escrow.withdrawFromEscrow(0.5 ether);
        }
        
        assertEq(escrow.userEscrowBalance(user1), 2.5 ether);
    }

    function test_WithdrawFromEscrow_ExactBalance() public {
        uint256 depositAmount = 1 ether;
        vm.deal(user1, depositAmount);
        
        vm.prank(user1);
        (bool depositSuccess, ) = address(escrow).call{value: depositAmount}("");
        assertTrue(depositSuccess);
        
        // Withdraw exact balance
        vm.prank(user1);
        escrow.withdrawFromEscrow(depositAmount);
        
        assertEq(escrow.userEscrowBalance(user1), 0);
    }

    function test_TransferEscrowBalance_OwnerAsSettler() public {
        // Owner is initially settler, so we can use owner directly
        uint256 depositAmount = 1 ether;
        vm.deal(user1, depositAmount);
        
        vm.prank(user1);
        (bool depositSuccess, ) = address(escrow).call{value: depositAmount}("");
        assertTrue(depositSuccess);
        
        // Owner (as settler) can transfer
        escrow.transferEscrowBalance(user1, user2, 0.5 ether);
        
        assertEq(escrow.userEscrowBalance(user1), 0.5 ether);
        assertEq(escrow.userEscrowBalance(user2), 0.5 ether);
    }

    function test_UpdateSettler_ThenTransfer() public {
        address newSettler = address(0x100);
        uint256 depositAmount = 1 ether;
        
        vm.deal(user1, depositAmount);
        vm.prank(user1);
        (bool depositSuccess, ) = address(escrow).call{value: depositAmount}("");
        assertTrue(depositSuccess);
        
        // Update settler
        escrow.updateSettler(newSettler);
        
        // Old settler (owner) can no longer transfer
        vm.expectRevert("Only settler can call this function");
        escrow.transferEscrowBalance(user1, user2, 0.5 ether);
        
        // New settler can transfer
        vm.prank(newSettler);
        escrow.transferEscrowBalance(user1, user2, 0.5 ether);
        
        assertEq(escrow.userEscrowBalance(user1), 0.5 ether);
        assertEq(escrow.userEscrowBalance(user2), 0.5 ether);
    }

    function test_Receive_ContractDeposit() public {
        // Test that contracts can deposit
        uint256 depositAmount = 1 ether;
        vm.deal(address(this), depositAmount);
        
        (bool success, ) = address(escrow).call{value: depositAmount}("");
        assertTrue(success);
        
        assertEq(escrow.userEscrowBalance(address(this)), depositAmount);
    }

    // ============ Ownable Function Tests ============

    function test_TransferOwnership_Success() public {
        address newOwner = address(0x500);
        
        escrow.transferOwnership(newOwner);
        
        assertEq(escrow.owner(), newOwner);
    }

    function test_TransferOwnership_OnlyOwner() public {
        address newOwner = address(0x500);
        
        vm.prank(nonOwner);
        vm.expectRevert();
        escrow.transferOwnership(newOwner);
        
        // Owner should remain unchanged
        assertEq(escrow.owner(), owner);
    }

    function test_TransferOwnership_ZeroAddress() public {
        vm.expectRevert();
        escrow.transferOwnership(address(0));
    }

    function test_TransferOwnership_EventEmitted() public {
        address newOwner = address(0x500);
        address oldOwner = escrow.owner();
        
        vm.expectEmit(true, true, false, false);
        emit OwnershipTransferred(oldOwner, newOwner);
        
        escrow.transferOwnership(newOwner);
    }

    function test_RenounceOwnership_Success() public {
        escrow.renounceOwnership();
        
        assertEq(escrow.owner(), address(0));
    }

    function test_RenounceOwnership_OnlyOwner() public {
        vm.prank(nonOwner);
        vm.expectRevert();
        escrow.renounceOwnership();
        
        // Owner should remain unchanged
        assertEq(escrow.owner(), owner);
    }

    function test_RenounceOwnership_EventEmitted() public {
        address oldOwner = escrow.owner();
        
        vm.expectEmit(true, true, false, false);
        emit OwnershipTransferred(oldOwner, address(0));
        
        escrow.renounceOwnership();
    }

    function test_RenounceOwnership_ThenCannotUpdateSettler() public {
        // Renounce ownership
        escrow.renounceOwnership();
        assertEq(escrow.owner(), address(0));
        
        // Try to update settler (should fail)
        address newSettler = address(0x100);
        vm.expectRevert();
        escrow.updateSettler(newSettler);
    }

    function test_TransferOwnership_ThenNewOwnerCanUpdateSettler() public {
        address newOwner = address(0x500);
        address newSettler = address(0x100);
        
        // Transfer ownership
        escrow.transferOwnership(newOwner);
        assertEq(escrow.owner(), newOwner);
        
        // Old owner cannot update settler
        vm.expectRevert();
        escrow.updateSettler(newSettler);
        
        // New owner can update settler
        vm.prank(newOwner);
        escrow.updateSettler(newSettler);
        assertEq(escrow.settler(), newSettler);
    }
}

/**
 * @title ReceiveFailer
 * @dev Helper contract that rejects ETH transfers
 */
contract ReceiveFailer {
    receive() external payable {
        revert("Receive disabled");
    }
}

/**
 * @title NoReceiveContract
 * @dev Helper contract that has no receive() or fallback() functions
 * @notice This will cause ETH transfers to fail (success = false)
 */
contract NoReceiveContract {
    // No receive() or fallback() functions
    // This means ETH transfers to this contract will fail
}

