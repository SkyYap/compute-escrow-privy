// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {Escrow} from "../src/Escrow.sol";

/**
 * @title UpdateSettler
 * @dev Script to update the settler address on the Escrow contract
 * @notice This script allows the contract owner to update the settler address
 * 
 * Usage with environment variables:
 *   export ESCROW_ADDRESS=<escrow_contract_address>
 *   export NEW_SETTLER=<new_settler_address>
 *   export PRIVATE_KEY=<owner_private_key>
 *   export RPC_URL=<rpc_url>
 *   forge script script/UpdateSettler.s.sol:UpdateSettler \
 *     --rpc-url $RPC_URL \
 *     --private-key $PRIVATE_KEY \
 *     --broadcast
 * 
 * Or use the shell script wrapper:
 *   ./scripts/update-settler.sh \
 *     --escrow-address <ADDRESS> \
 *     --new-settler <ADDRESS> \
 *     --rpc-url <URL> \
 *     --private-key <KEY>
 */
contract UpdateSettler is Script {
    function run() external {
        // Get addresses from environment variables
        address escrowAddress = vm.envAddress("ESCROW_ADDRESS");
        address newSettler = vm.envAddress("NEW_SETTLER");
        
        // Get private key from environment variable
        uint256 ownerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        // Validate inputs
        require(escrowAddress != address(0), "Escrow address cannot be zero");
        require(newSettler != address(0), "New settler address cannot be zero");
        
        // Get Escrow contract instance
        // Cast to payable since Escrow has a receive() function
        Escrow escrow = Escrow(payable(escrowAddress));
        
        // Verify caller is the owner
        address owner = escrow.owner();
        address caller = vm.addr(ownerPrivateKey);
        require(caller == owner, "Caller must be the contract owner");
        
        // Get current settler
        address currentSettler = escrow.settler();
        
        console.log("Escrow contract:", escrowAddress);
        console.log("Current owner:", owner);
        console.log("Caller address:", caller);
        console.log("Current settler:", currentSettler);
        console.log("New settler:", newSettler);
        
        // Start broadcasting transactions
        vm.startBroadcast(ownerPrivateKey);
        
        // Update the settler
        escrow.updateSettler(newSettler);
        
        // Stop broadcasting
        vm.stopBroadcast();
        
        // Verify the update
        address updatedSettler = escrow.settler();
        require(updatedSettler == newSettler, "Settler update failed");
        
        console.log("Settler successfully updated!");
        console.log("New settler:", updatedSettler);
    }
}

