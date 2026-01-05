#!/bin/bash
#
# MCP Server TypeScript - Add Snippet
#
# Usage:
#   ./add.sh <snippet-name>              # Copy snippet to ./src
#   ./add.sh <snippet-name> <dest-dir>   # Copy to custom directory
#   ./add.sh --list                      # Show available snippets
#   ./add.sh --update                    # Refresh snippets from GitHub
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
SNIPPETS_DIR="$SKILL_DIR/snippets"
MANIFEST_FILE="$SKILL_DIR/manifest.json"

# Check manifest exists
if [ ! -f "$MANIFEST_FILE" ]; then
    echo -e "${RED}Error: manifest.json not found at $MANIFEST_FILE${NC}"
    exit 1
fi

# Check for jq
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is required${NC}"
    echo "Install with: brew install jq (macOS) or apt-get install jq (Linux)"
    exit 1
fi

# Function to update snippets from GitHub
update_snippets() {
    echo -e "${BLUE}Updating snippets from GitHub...${NC}"

    if ! command -v curl &> /dev/null; then
        echo -e "${RED}Error: curl is required for --update${NC}"
        exit 1
    fi

    REMOTE_BASE_URL=$(jq -r '.remoteBaseUrl' "$MANIFEST_FILE")
    REPO_URL=$(jq -r '.repoUrl' "$MANIFEST_FILE")
    SNIPPETS=$(jq -r '.snippets | keys[]' "$MANIFEST_FILE")

    for snippet in $SNIPPETS; do
        local_file=$(jq -r ".snippets[\"$snippet\"].localFile" "$MANIFEST_FILE")
        remote_files=$(jq -r ".snippets[\"$snippet\"].remoteFiles[]" "$MANIFEST_FILE")

        dest_path="$SNIPPETS_DIR/$local_file"
        mkdir -p "$(dirname "$dest_path")"

        # Use first remote file as source
        first_remote=$(echo "$remote_files" | head -1)
        raw_url="$REMOTE_BASE_URL/$first_remote"
        source_url="$REPO_URL/$first_remote"

        echo -e "  Fetching: ${YELLOW}$snippet${NC}"

        content=$(curl -sL "$raw_url")
        if [ -z "$content" ]; then
            echo -e "${RED}  Error: Failed to fetch $first_remote${NC}"
            continue
        fi

        # Create header comment
        header="/**
 * Source: $source_url
 *
 * This snippet was fetched from the MCP Everything reference server.
 * Customize as needed for your use case.
 */

"
        echo "$header$content" > "$dest_path"
        echo -e "  ${GREEN}Updated:${NC} $local_file"
    done

    echo -e "${GREEN}Snippets updated!${NC}"
}

# Function to list available snippets
show_snippets() {
    echo ""
    echo -e "${GREEN}Available snippets:${NC}"
    echo ""

    SNIPPETS=$(jq -r '.snippets | keys[]' "$MANIFEST_FILE")
    for snippet in $SNIPPETS; do
        desc=$(jq -r ".snippets[\"$snippet\"].description // \"\"" "$MANIFEST_FILE")
        category=$(jq -r ".snippets[\"$snippet\"].category // \"\"" "$MANIFEST_FILE")
        echo -e "  ${YELLOW}$snippet${NC} ${BLUE}[$category]${NC}"
        echo "      $desc"
        echo ""
    done

    echo -e "${CYAN}Usage: ./add.sh <snippet-name> [dest-dir]${NC}"
}

# Parse arguments
SNIPPET=""
DEST_DIR="./src"

case "$1" in
    --list|-l)
        show_snippets
        exit 0
        ;;
    --update|-u)
        update_snippets
        exit 0
        ;;
    --help|-h)
        echo "Usage: ./add.sh <snippet-name> [dest-dir]"
        echo "       ./add.sh --list"
        echo "       ./add.sh --update"
        exit 0
        ;;
    "")
        echo -e "${RED}Error: Snippet name required${NC}"
        show_snippets
        exit 1
        ;;
    *)
        SNIPPET="$1"
        if [ -n "$2" ]; then
            DEST_DIR="$2"
        fi
        ;;
esac

# Validate snippet exists
LOCAL_FILE=$(jq -r ".snippets[\"$SNIPPET\"].localFile // empty" "$MANIFEST_FILE")
if [ -z "$LOCAL_FILE" ]; then
    echo -e "${RED}Error: Unknown snippet '$SNIPPET'${NC}"
    show_snippets
    exit 1
fi

SOURCE_PATH="$SNIPPETS_DIR/$LOCAL_FILE"

if [ ! -f "$SOURCE_PATH" ]; then
    echo -e "${RED}Error: Snippet file not found at $SOURCE_PATH${NC}"
    echo "Run with --update to fetch snippets from GitHub"
    exit 1
fi

# Create destination if it doesn't exist
mkdir -p "$DEST_DIR"

# Get just the filename
filename=$(basename "$LOCAL_FILE")
dest_path="$DEST_DIR/$filename"

# Copy the file
cp "$SOURCE_PATH" "$dest_path"
echo -e "${GREEN}Copied:${NC} $SNIPPET -> $dest_path"
