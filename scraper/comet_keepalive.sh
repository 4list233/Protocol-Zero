#!/bin/bash
#
# Comet Browser Keep-Alive Script (macOS)
# =======================================
# Periodically checks for inactivity and sends "continue" to keep Comet working.
#
# Usage:
#   ./comet_keepalive.sh [timeout_seconds] [message]
#
# Examples:
#   ./comet_keepalive.sh              # Default: 90s timeout, "continue" message
#   ./comet_keepalive.sh 60           # 60s timeout
#   ./comet_keepalive.sh 60 "keep going"  # Custom message
#
# Press Ctrl+C to stop

# Configuration
TIMEOUT=${1:-90}        # Seconds of inactivity before prompting
MESSAGE=${2:-continue}  # Message to send
CHECK_INTERVAL=15       # Seconds between checks

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "=========================================="
echo -e "${BLUE}🚀 Comet Browser Keep-Alive Monitor${NC}"
echo "=========================================="
echo "  Timeout: ${TIMEOUT}s"
echo "  Message: \"${MESSAGE}\""
echo "  Check interval: ${CHECK_INTERVAL}s"
echo ""
echo -e "${YELLOW}⚠️  Press Ctrl+C to stop${NC}"
echo "=========================================="
echo ""

# Countdown before starting
echo "Starting in 3 seconds... switch to Comet Browser!"
sleep 3
echo ""

# Initialize
last_screenshot_hash=""
inactive_seconds=0
prompts_sent=0

# Function to get screen hash (using screencapture + md5)
get_screen_hash() {
    screencapture -x -t jpg /tmp/comet_screen.jpg 2>/dev/null
    if [ -f /tmp/comet_screen.jpg ]; then
        md5 -q /tmp/comet_screen.jpg
    else
        echo "error"
    fi
}

# Function to send continue message via AppleScript
send_continue() {
    echo -e "${GREEN}📤 Sending: \"${MESSAGE}\"${NC}"
    
    # Use AppleScript to type the message
    osascript <<EOF
        tell application "System Events"
            delay 0.3
            keystroke "${MESSAGE}"
            delay 0.2
            keystroke return
        end tell
EOF
    
    ((prompts_sent++))
    echo -e "${GREEN}✅ Message sent (total: ${prompts_sent})${NC}"
}

# Function to get timestamp
timestamp() {
    date "+%H:%M:%S"
}

# Cleanup function
cleanup() {
    echo ""
    echo -e "${BLUE}🛑 Stopping...${NC}"
    echo "  Total prompts sent: ${prompts_sent}"
    rm -f /tmp/comet_screen.jpg
    exit 0
}

# Set up trap for clean exit
trap cleanup SIGINT SIGTERM

# Main loop
while true; do
    current_hash=$(get_screen_hash)
    
    if [ "$current_hash" = "error" ]; then
        echo -e "[$(timestamp)] ${RED}⚠️ Screen capture failed${NC}"
        sleep $CHECK_INTERVAL
        continue
    fi
    
    if [ "$current_hash" != "$last_screenshot_hash" ]; then
        # Screen changed - activity detected
        if [ -n "$last_screenshot_hash" ]; then
            echo -e "[$(timestamp)] ${GREEN}🔄 Activity detected${NC}"
        fi
        last_screenshot_hash=$current_hash
        inactive_seconds=0
    else
        # No change
        ((inactive_seconds += CHECK_INTERVAL))
        remaining=$((TIMEOUT - inactive_seconds))
        
        if [ $remaining -gt 0 ]; then
            echo -e "[$(timestamp)] ${YELLOW}⏳ No change for ${inactive_seconds}s (prompt in ${remaining}s)${NC}"
        else
            # Time to prompt!
            echo ""
            echo -e "[$(timestamp)] ${RED}⚡ Inactivity detected! Sending prompt...${NC}"
            send_continue
            echo ""
            
            # Reset
            inactive_seconds=0
            last_screenshot_hash=""
            
            # Wait for browser to react
            sleep 3
        fi
    fi
    
    sleep $CHECK_INTERVAL
done







