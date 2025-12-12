// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {LeaderFeeHook} from "../src/LeaderFeeHook.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IAuction} from "../src/interfaces/IAuction.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {HookMiner} from "./HookMiner.sol";

/**
 * @title DeployLeaderFeeHook
 * @notice Deploys LeaderFeeHook with proper hook address mining
 *
 * Usage:
 *   forge script script/Deploy.s.sol:DeployLeaderFeeHook --rpc-url $RPC_URL --broadcast --verify
 *
 * Required environment variables:
 *   - PRIVATE_KEY: Deployer private key
 *   - AUCTION_ADDRESS: Auction contract address
 */
contract DeployLeaderFeeHook is Script {
    // Base Sepolia Uniswap V4 addresses
    address constant POOL_MANAGER = 0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408;

    // Token addresses
    address constant USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address constant NATIVE_ETH = address(0);

    // Pool config
    uint24 constant POOL_FEE = 3000; // 0.3%
    int24 constant TICK_SPACING = 60;

    // Initial price: ~2000 USDC per ETH
    // sqrt(2000) * 2^96 ≈ 3543191142285914205922034323214
    uint160 constant INITIAL_SQRT_PRICE = 3543191142285914205922034323214;

    function run() external {
        // Get auction address from env
        address auctionAddress = vm.envAddress("AUCTION_ADDRESS");
        require(auctionAddress != address(0), "AUCTION_ADDRESS not set");

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deployer:", deployer);
        console.log("Auction:", auctionAddress);
        console.log("PoolManager:", POOL_MANAGER);

        // Define the hook flags we need
        // LeaderFeeHook uses: beforeSwap (dynamic fee) and afterSwap (fee tracking)
        uint160 flags = uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG);

        console.log("Required hook flags:", flags);

        // Mine the hook address
        // This finds a CREATE2 salt that results in an address with the correct flag bits
        bytes memory creationCode = type(LeaderFeeHook).creationCode;
        bytes memory constructorArgs = abi.encode(
            IPoolManager(POOL_MANAGER),
            IAuction(auctionAddress)
        );

        console.log("Mining hook address (this may take a while)...");

        (address hookAddress, bytes32 salt) = HookMiner.find(
            deployer,
            flags,
            creationCode,
            constructorArgs
        );

        console.log("Found hook address:", hookAddress);
        console.log("Salt:", vm.toString(salt));

        // Deploy the hook
        vm.startBroadcast(deployerPrivateKey);

        LeaderFeeHook hook = new LeaderFeeHook{salt: salt}(
            IPoolManager(POOL_MANAGER),
            IAuction(auctionAddress)
        );

        require(address(hook) == hookAddress, "Hook address mismatch!");

        console.log("LeaderFeeHook deployed at:", address(hook));

        // Initialize the pool
        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(NATIVE_ETH),
            currency1: Currency.wrap(USDC),
            fee: POOL_FEE,
            tickSpacing: TICK_SPACING,
            hooks: hook
        });

        IPoolManager(POOL_MANAGER).initialize(poolKey, INITIAL_SQRT_PRICE);
        console.log("Pool initialized with ETH/USDC");

        vm.stopBroadcast();

        // Output summary
        console.log("");
        console.log("=== DEPLOYMENT SUMMARY ===");
        console.log("LeaderFeeHook:", address(hook));
        console.log("PoolManager:", POOL_MANAGER);
        console.log("Pool: ETH/USDC");
        console.log("Fee: 0.3% (dynamic via hook)");
        console.log("");
        console.log("Update frontend/src/config/contracts.ts:");
        console.log("  LEADER_FEE_HOOK_ADDRESS =", address(hook));
    }
}
