// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {Escrow} from "../src/Escrow.sol";

/**
 * @title DeployEscrow
 * @dev Deployment script for Escrow contract
 * @notice This script deploys the Escrow contract and outputs the deployment address
 * 
 * Usage:
 *   forge script script/DeployEscrow.s.sol:DeployEscrow --rpc-url <RPC_URL> --private-key <PRIVATE_KEY> --broadcast
 * 
 * Or with environment variables:
 *   export PRIVATE_KEY=<your_private_key>
 *   export RPC_URL=<your_rpc_url>
 *   forge script script/DeployEscrow.s.sol:DeployEscrow --broadcast
 */
contract DeployEscrow is Script {
    function run() external returns (Escrow escrow) {
        // Get private key from environment variable or fail
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        // Start broadcasting transactions
        // Note: RPC URL should be provided via --rpc-url flag to forge script
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy the Escrow contract
        escrow = new Escrow();
        
        // Stop broadcasting
        vm.stopBroadcast();
        
        // Log deployment information
        console.log("Escrow contract deployed at:", address(escrow));
        console.log("Deployer address:", vm.addr(deployerPrivateKey));
        console.log("Contract owner:", escrow.owner());
        console.log("Initial settler:", escrow.settler());
    }
}

