// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title HookMiner
 * @notice Mines hook addresses that have the correct flag bits set
 * @dev Uniswap V4 requires hook addresses to have specific bits set based on enabled callbacks
 */
library HookMiner {
    /// @notice Find a salt that produces a hook address with the required flags
    /// @param deployer The address that will deploy the hook
    /// @param flags The required hook flags (bits that must be set in the address)
    /// @param creationCode The creation code of the hook contract
    /// @param constructorArgs The encoded constructor arguments
    /// @return hookAddress The address of the hook
    /// @return salt The salt to use for CREATE2
    function find(
        address deployer,
        uint160 flags,
        bytes memory creationCode,
        bytes memory constructorArgs
    ) internal pure returns (address hookAddress, bytes32 salt) {
        bytes memory initCode = abi.encodePacked(creationCode, constructorArgs);
        bytes32 initCodeHash = keccak256(initCode);

        // Try different salts until we find one that produces an address with correct flags
        for (uint256 i = 0; i < 100000; i++) {
            salt = bytes32(i);
            hookAddress = computeAddress(deployer, salt, initCodeHash);

            // Check if the address has the required flag bits set
            if (uint160(hookAddress) & flags == flags) {
                return (hookAddress, salt);
            }
        }

        revert("HookMiner: could not find salt");
    }

    /// @notice Compute CREATE2 address
    function computeAddress(
        address deployer,
        bytes32 salt,
        bytes32 initCodeHash
    ) internal pure returns (address) {
        return
            address(
                uint160(
                    uint256(
                        keccak256(
                            abi.encodePacked(
                                bytes1(0xff),
                                deployer,
                                salt,
                                initCodeHash
                            )
                        )
                    )
                )
            );
    }
}
