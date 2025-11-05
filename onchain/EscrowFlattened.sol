// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19 ^0.8.20;

// lib/openzeppelin-contracts/contracts/utils/Context.sol

// OpenZeppelin Contracts (last updated v5.0.1) (utils/Context.sol)

/**
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 *
 * This contract is only required for intermediate, library-like contracts.
 */
abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }

    function _contextSuffixLength() internal view virtual returns (uint256) {
        return 0;
    }
}

// lib/openzeppelin-contracts/contracts/access/Ownable.sol

// OpenZeppelin Contracts (last updated v5.0.0) (access/Ownable.sol)

/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * The initial owner is set to the address provided by the deployer. This can
 * later be changed with {transferOwnership}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
abstract contract Ownable is Context {
    address private _owner;

    /**
     * @dev The caller account is not authorized to perform an operation.
     */
    error OwnableUnauthorizedAccount(address account);

    /**
     * @dev The owner is not a valid owner account. (eg. `address(0)`)
     */
    error OwnableInvalidOwner(address owner);

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the address provided by the deployer as the initial owner.
     */
    constructor(address initialOwner) {
        if (initialOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(initialOwner);
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view virtual returns (address) {
        return _owner;
    }

    /**
     * @dev Throws if the sender is not the owner.
     */
    function _checkOwner() internal view virtual {
        if (owner() != _msgSender()) {
            revert OwnableUnauthorizedAccount(_msgSender());
        }
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby disabling any functionality that is only available to the owner.
     */
    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public virtual onlyOwner {
        if (newOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Internal function without access restriction.
     */
    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}

// src/Escrow.sol

/**
 * @title Escrow
 * @dev Escrow contract for TEE-based backend application on EigenCloud
 * @notice This contract manages the application escrow for users
 */
contract Escrow is Ownable {
    // Events
    event SettlerUpdated(address indexed oldSettler, address indexed newSettler);
    event Deposit(address indexed user, uint256 amount, uint256 totalBalance);
    event Withdrawal(address indexed user, uint256 amount, uint256 totalBalance);
    event EscrowTransfer(address indexed settler, address indexed from, address indexed to, uint256 amount, uint256 fromBalance, uint256 toBalance);
   
    // State variables

    // The settler should be set to the public address of the TEE
    // as deployed. The contract owner will be set as the default settler.
    // The deployment sequence is as follows:
    //
    // 1) Deploy this escrow contract, obtain address.
    // 2) Deploy your EigenX TEE, obtain public address.
    // 3) As the owner, call updateSettler and set it to the public address of the TEE.
    address public settler;

    // It's possible that settlements fail if the receiving account is a smart contract,
    // there isn't enough gas from the settler, etc. In this case we want to enable escrow
    // users to withdraw asynchronously at a later time.
    // Users can also deposit ETH directly by sending ETH to the contract, which will be
    // added to their escrow balance.
    mapping(address => uint256) public userEscrowBalance;

    modifier onlySettler() {
        require(msg.sender == settler, "Only settler can call this function");
        _;
    }

    // Constructor
    constructor() Ownable(msg.sender) {
        settler = msg.sender; // Initially, owner is also the settler
    }

    /**
     * @dev Update the settler address
     * @param _newSettler The new settler address
     * @notice Only the owner can call this function
     */
    function updateSettler(address _newSettler) external onlyOwner {
        require(_newSettler != address(0), "Settler cannot be zero address");
        address oldSettler = settler;
        settler = _newSettler;
        emit SettlerUpdated(oldSettler, _newSettler);
    }

    /**
     * @dev Withdraw funds from escrow balance
     * @notice Allows users to withdraw funds from their escrow balance
     */
    function withdrawPending() external {
        uint256 amount = userEscrowBalance[msg.sender];
        require(amount > 0, "No funds to withdraw");
        
        userEscrowBalance[msg.sender] = 0;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Withdrawal failed");
        
        emit Withdrawal(msg.sender, amount, userEscrowBalance[msg.sender]);
    }

    /**
     * @dev Withdraw a specific amount from the user's escrow balance
     * @param amount The amount of ETH to withdraw (in wei)
     * @notice Allows users to withdraw a specific amount from their escrow balance.
     *         The escrow balance includes ETH deposited directly to the contract
     *         and any funds that failed to transfer during settlement.
     * @custom:security This function uses the checks-effects-interactions pattern:
     *          - First checks that the user has sufficient balance
     *          - Then updates the state (subtracts amount from balance)
     *          - Finally transfers the ETH
     * @custom:reentrancy This function is safe from reentrancy attacks as the balance
     *         is updated before the external call, and the transfer uses a low-level
     *         call with a require to ensure it succeeds.
     */
    function withdrawFromEscrow(uint256 amount) external {
        require(amount > 0, "Amount must be greater than zero");
        require(userEscrowBalance[msg.sender] >= amount, "Insufficient escrow balance");
        
        // Update balance before transfer to prevent reentrancy
        userEscrowBalance[msg.sender] -= amount;
        
        // Transfer ETH to user
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "ETH transfer failed");
        
        emit Withdrawal(msg.sender, amount, userEscrowBalance[msg.sender]);
    }

    /**
     * @dev Transfer escrow balance from one user to another
     * @param from The address to transfer from
     * @param to The address to transfer to
     * @param amount The amount to transfer (in wei)
     * @notice Only the settler can call this function. This is useful for settlements
     *         where funds need to be moved between users' escrow accounts.
     * @custom:security This function uses the checks-effects-interactions pattern:
     *          - First checks that addresses are valid and amount is sufficient
     *          - Then updates the state (subtracts from sender, adds to receiver)
     *          - No external calls are made, so reentrancy is not a concern
     */
    function transferEscrowBalance(address from, address to, uint256 amount) external onlySettler {
        require(from != address(0), "From address cannot be zero");
        require(to != address(0), "To address cannot be zero");
        require(from != to, "From and to addresses must be different");
        require(amount > 0, "Amount must be greater than zero");
        require(userEscrowBalance[from] >= amount, "Insufficient escrow balance in source account");
        
        // Update balances
        userEscrowBalance[from] -= amount;
        userEscrowBalance[to] += amount;
        
        // Emit event with updated balances and settler address
        emit EscrowTransfer(msg.sender, from, to, amount, userEscrowBalance[from], userEscrowBalance[to]);
    }

    // Fallback function to receive ETH
    receive() external payable {
        // Add received ETH to the sender's escrow balance
        userEscrowBalance[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value, userEscrowBalance[msg.sender]);
    }
}
