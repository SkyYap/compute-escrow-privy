#!/bin/bash

# Script to update the settler address on the Escrow contract
# Usage: ./scripts/update-settler.sh [--escrow-address ADDRESS] [--new-settler ADDRESS] [--rpc-url RPC_URL] [--private-key PRIVATE_KEY]

set -e

# Parse command line arguments
RPC_URL=""
PRIVATE_KEY=""
ESCROW_ADDRESS=""
NEW_SETTLER=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --rpc-url)
            RPC_URL="$2"
            shift 2
            ;;
        --private-key)
            PRIVATE_KEY="$2"
            shift 2
            ;;
        --escrow-address)
            ESCROW_ADDRESS="$2"
            shift 2
            ;;
        --new-settler)
            NEW_SETTLER="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--escrow-address ADDRESS] [--new-settler ADDRESS] [--rpc-url RPC_URL] [--private-key PRIVATE_KEY]"
            exit 1
            ;;
    esac
done

# Check if private key is provided
if [ -z "$PRIVATE_KEY" ]; then
    if [ -z "$PRIVATE_KEY_ENV" ]; then
        echo "Error: Private key must be provided via --private-key or PRIVATE_KEY environment variable"
        exit 1
    fi
    PRIVATE_KEY="$PRIVATE_KEY_ENV"
fi

# Check if RPC URL is provided
if [ -z "$RPC_URL" ]; then
    if [ -z "$RPC_URL_ENV" ]; then
        echo "Error: RPC URL must be provided via --rpc-url or RPC_URL environment variable"
        exit 1
    fi
    RPC_URL="$RPC_URL_ENV"
fi

# Check if escrow address is provided
if [ -z "$ESCROW_ADDRESS" ]; then
    if [ -z "$ESCROW_ADDRESS_ENV" ]; then
        echo "Error: Escrow contract address must be provided via --escrow-address or ESCROW_ADDRESS environment variable"
        exit 1
    fi
    ESCROW_ADDRESS="$ESCROW_ADDRESS_ENV"
fi

# Check if new settler address is provided
if [ -z "$NEW_SETTLER" ]; then
    if [ -z "$NEW_SETTLER_ENV" ]; then
        echo "Error: New settler address must be provided via --new-settler or NEW_SETTLER environment variable"
        exit 1
    fi
    NEW_SETTLER="$NEW_SETTLER_ENV"
fi

# Validate addresses (basic check - must start with 0x)
if [[ ! "$ESCROW_ADDRESS" =~ ^0x[a-fA-F0-9]{40}$ ]]; then
    echo "Error: Invalid escrow address format. Must be a valid Ethereum address (0x followed by 40 hex characters)"
    exit 1
fi

if [[ ! "$NEW_SETTLER" =~ ^0x[a-fA-F0-9]{40}$ ]]; then
    echo "Error: Invalid new settler address format. Must be a valid Ethereum address (0x followed by 40 hex characters)"
    exit 1
fi

# Export environment variables for forge script
export PRIVATE_KEY
export RPC_URL
export ESCROW_ADDRESS
export NEW_SETTLER

# Get the script directory and change to onchain directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ONCHAIN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ONCHAIN_DIR"

# Run the update script
echo "Updating settler address on Escrow contract..."
echo "Escrow contract: $ESCROW_ADDRESS"
echo "New settler: $NEW_SETTLER"
echo "RPC URL: $RPC_URL"
echo ""

forge script script/UpdateSettler.s.sol:UpdateSettler \
    --rpc-url "$RPC_URL" \
    --private-key "$PRIVATE_KEY" \
    --broadcast

echo ""
echo "Settler update complete!"

