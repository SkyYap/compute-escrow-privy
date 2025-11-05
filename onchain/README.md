# Escrow Contract

A secure escrow contract for TEE-based backend applications on EigenCloud, built with Foundry and OpenZeppelin's Ownable.

## Overview

The Escrow contract manages user funds in escrow accounts, allowing deposits, withdrawals, and transfers between accounts. The contract uses a **settler** mechanism where only the designated settler address (typically your TEE's public address) can transfer funds between user escrow accounts, which is essential for settlement operations.

## Key Concepts

### Owner
- The contract owner (deployer by default) has administrative privileges
- Can update the settler address
- Can transfer ownership to another address
- Can renounce ownership (making the contract ownerless)

### Settler
- The settler is the address authorized to transfer funds between escrow accounts
- Initially set to the contract owner
- **Should be set to your EigenX TEE's public address** after TEE deployment
- Only the settler can call `transferEscrowBalance()` to move funds between users

### User Escrow Balance
- Each user has an escrow balance that tracks their deposited funds
- Users can deposit ETH directly by sending ETH to the contract
- Users can withdraw their funds at any time
- The settler can transfer funds between user accounts (for settlements)

## Deployment Sequence

**IMPORTANT:** Follow this exact sequence when deploying with a TEE:

1. **Deploy the Escrow contract**
   - Deploy the contract and note the deployed contract address
   - The deployer becomes the owner and initial settler

2. **Deploy your EigenX TEE**
   - Deploy your TEE and obtain its public address
   - This address will become the settler

3. **Update the settler**
   - As the contract owner, call `updateSettler()` with the TEE's public address
   - This transfers settler privileges from the owner to the TEE

## Contract Functions

### User Functions

#### Deposit ETH
Users can deposit ETH directly to the contract by sending ETH to the contract address. The funds are automatically added to the sender's escrow balance.

```solidity
// Simply send ETH to the contract address
// Event: Deposit(address indexed user, uint256 amount, uint256 totalBalance)
```

#### Withdraw Funds
Users can withdraw their escrow balance in two ways:

**Withdraw all funds:**
```solidity
function withdrawPending() external
// Withdraws entire escrow balance
// Event: Withdrawal(address indexed user, uint256 amount, uint256 totalBalance)
```

**Withdraw specific amount:**
```solidity
function withdrawFromEscrow(uint256 amount) external
// Withdraws a specific amount from escrow balance
// Event: Withdrawal(address indexed user, uint256 amount, uint256 totalBalance)
```

### Owner Functions

#### Update Settler
```solidity
function updateSettler(address _newSettler) external onlyOwner
```
- Updates the settler address
- Only the contract owner can call this
- Cannot set to zero address
- Event: `SettlerUpdated(address indexed oldSettler, address indexed newSettler)`

#### Transfer Ownership
```solidity
function transferOwnership(address newOwner) external onlyOwner
```
- Transfers contract ownership to a new address
- Inherited from OpenZeppelin's Ownable
- New owner can then update the settler

#### Renounce Ownership
```solidity
function renounceOwnership() external onlyOwner
```
- Removes the contract owner (sets to zero address)
- Inherited from OpenZeppelin's Ownable
- **Warning:** This permanently disables owner-only functions

### Settler Functions

#### Transfer Escrow Balance
```solidity
function transferEscrowBalance(address from, address to, uint256 amount) external onlySettler
```
- Transfers funds from one user's escrow account to another
- Only the settler can call this function
- Used for settlement operations
- Validations:
  - `from` and `to` cannot be zero addresses
  - `from` and `to` must be different
  - `amount` must be greater than zero
  - `from` must have sufficient balance
- Event: `EscrowTransfer(address indexed settler, address indexed from, address indexed to, uint256 amount, uint256 fromBalance, uint256 toBalance)`

## Deployment

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) installed
- Private key with sufficient ETH for deployment
- RPC URL for your target network

### Using the Deployment Script

#### Option 1: Using the shell script (Recommended)

```bash
cd onchain
./scripts/deploy.sh \
  --rpc-url <YOUR_RPC_URL> \
  --private-key <YOUR_PRIVATE_KEY> \
  --etherscan-api-key <YOUR_API_KEY> \
  --verify
```

#### Option 2: Using environment variables

```bash
cd onchain
export PRIVATE_KEY=<your_private_key>
export RPC_URL=<your_rpc_url>
export ETHERSCAN_API_KEY=<your_api_key>  # Optional, for verification
forge script script/DeployEscrow.s.sol:DeployEscrow \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify
```

#### Option 3: Direct forge command

```bash
cd onchain
forge script script/DeployEscrow.s.sol:DeployEscrow \
  --rpc-url <RPC_URL> \
  --private-key <PRIVATE_KEY> \
  --broadcast
```

### Deployment Output

After deployment, you'll see:
- Escrow contract address
- Deployer address (contract owner)
- Initial settler (same as owner)

Save these addresses for the next steps.

## Contract Verification

### During Deployment

Add `--verify` flag and provide Etherscan API key:

```bash
./scripts/deploy.sh \
  --rpc-url <RPC_URL> \
  --private-key <PRIVATE_KEY> \
  --etherscan-api-key <API_KEY> \
  --verify
```

### Manual Verification

If verification wasn't done during deployment:

```bash
forge verify-contract \
  <CONTRACT_ADDRESS> \
  src/Escrow.sol:Escrow \
  --chain-id <CHAIN_ID> \
  --etherscan-api-key <API_KEY> \
  --constructor-args $(cast abi-encode "constructor()")
```

## Setting the Settler (After TEE Deployment)

Once you've deployed your EigenX TEE and obtained its public address, update the settler:

### Using the Script

```bash
cd onchain
./scripts/update-settler.sh \
  --escrow-address <ESCROW_CONTRACT_ADDRESS> \
  --new-settler <TEE_PUBLIC_ADDRESS> \
  --rpc-url <RPC_URL> \
  --private-key <OWNER_PRIVATE_KEY>
```

### Using Environment Variables

```bash
cd onchain
export ESCROW_ADDRESS=<escrow_contract_address>
export NEW_SETTLER=<tee_public_address>
export PRIVATE_KEY=<owner_private_key>
export RPC_URL=<rpc_url>

forge script script/UpdateSettler.s.sol:UpdateSettler \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast
```

### Direct Forge Command

```bash
cd onchain
forge script script/UpdateSettler.s.sol:UpdateSettler \
  --sig "run(address,address)" <ESCROW_ADDRESS> <TEE_PUBLIC_ADDRESS> \
  --rpc-url <RPC_URL> \
  --private-key <OWNER_PRIVATE_KEY> \
  --broadcast
```

**Important:** Only the contract owner can update the settler. After updating, the TEE will be able to transfer funds between user escrow accounts.

## Transferring Ownership

If you need to transfer contract ownership to another address:

### Using Cast

```bash
cast send <ESCROW_ADDRESS> \
  "transferOwnership(address)" <NEW_OWNER_ADDRESS> \
  --rpc-url <RPC_URL> \
  --private-key <CURRENT_OWNER_PRIVATE_KEY>
```

### Using Foundry Script

You can create a custom script similar to `UpdateSettler.s.sol` to transfer ownership.

## Events

The contract emits the following events for tracking:

- `SettlerUpdated(address indexed oldSettler, address indexed newSettler)` - When settler is updated
- `Deposit(address indexed user, uint256 amount, uint256 totalBalance)` - When user deposits ETH
- `Withdrawal(address indexed user, uint256 amount, uint256 totalBalance)` - When user withdraws funds
- `EscrowTransfer(address indexed settler, address indexed from, address indexed to, uint256 amount, uint256 fromBalance, uint256 toBalance)` - When settler transfers funds between accounts
- `OwnershipTransferred(address indexed previousOwner, address indexed newOwner)` - When ownership is transferred (from Ownable)

## Development

### Build

```bash
forge build
```

### Test

```bash
forge test
```

Run with coverage:

```bash
forge coverage
```

### Format

```bash
forge fmt
```

### Gas Snapshots

```bash
forge snapshot
```

## Security Considerations

1. **Settler Address**: The settler address has significant power - it can transfer funds between any user accounts. Only set this to a trusted TEE address.

2. **Ownership**: The owner can change the settler. Consider using a multi-sig for ownership in production.

3. **Renouncing Ownership**: Be extremely careful with `renounceOwnership()` - it's irreversible and will permanently disable owner functions.

4. **Transfer Failures**: If a withdrawal fails (e.g., recipient is a contract that rejects ETH), the user's balance remains unchanged and they can retry later.

5. **Access Control**: All functions have proper access control:
   - Owner-only: `updateSettler()`, `transferOwnership()`, `renounceOwnership()`
   - Settler-only: `transferEscrowBalance()`
   - Public: `withdrawPending()`, `withdrawFromEscrow()`, `receive()`

## Contract Addresses

After deployment, save these addresses:
- **Escrow Contract**: `<deployed_address>`
- **Contract Owner**: `<owner_address>`
- **Settler (TEE)**: `<tee_public_address>`

## Troubleshooting

### "Only owner can call this function"
- Ensure you're using the owner's private key
- Check that ownership hasn't been transferred or renounced

### "Only settler can call this function"
- Ensure you've updated the settler to your TEE address
- Verify the TEE address is correct

### "Settler cannot be zero address"
- Cannot set settler to `address(0)`
- Use a valid address

### Withdrawal fails
- If withdrawal fails, the balance remains in escrow
- User can retry the withdrawal later
- Check that the recipient can receive ETH

## Testing

The contract has comprehensive test coverage (100% across all metrics). Run tests with:

```bash
forge test
```

Test coverage includes:
- All function calls
- All require statements
- All edge cases
- Event emissions
- Access control
- Transfer failures

## License

MIT

## References

- [Foundry Documentation](https://book.getfoundry.sh/)
- [OpenZeppelin Ownable](https://docs.openzeppelin.com/contracts/5.x/access-control#ownership-and-ownable)
- [EigenCloud Documentation](https://docs.eigencloud.xyz/)
