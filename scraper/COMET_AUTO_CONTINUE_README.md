# Comet Browser Auto-Continue Scripts

These scripts monitor Comet Browser for inactivity and automatically prompt it to continue when it pauses.

## The Problem

Comet Browser (AI agent browser) sometimes pauses during long automation tasks, waiting for user input before continuing. This requires manual intervention to type "continue" or press Enter.

## Solutions

Three scripts are provided - choose the one that works best for you:

---

### Option 1: Simple Python Script (Recommended)

**File:** `comet_simple_continue.py`

Interactive script with easy setup.

```bash
# Run interactively
python comet_simple_continue.py

# Or with arguments
python comet_simple_continue.py --timeout 60 --message "keep going"
python comet_simple_continue.py -t 90 -e  # Just press Enter
```

**How it works:**
1. Takes a screenshot every 15 seconds
2. Compares to previous screenshot to detect changes
3. If no changes for N seconds (default: 90), sends a prompt
4. Types "continue" and presses Enter (or just Enter)

---

### Option 2: Shell Script (macOS, No Dependencies)

**File:** `comet_keepalive.sh`

Pure shell script using macOS built-in tools.

```bash
# Make executable (first time only)
chmod +x comet_keepalive.sh

# Run with defaults (90s timeout, "continue" message)
./comet_keepalive.sh

# Custom timeout (60 seconds)
./comet_keepalive.sh 60

# Custom message
./comet_keepalive.sh 60 "keep going"
```

**Pros:**
- No Python dependencies
- Uses native macOS screencapture
- Lightweight

---

### Option 3: Full-Featured Python Script

**File:** `comet_auto_continue.py`

More configurable version with logging.

```bash
# Install dependencies first
pip install pyautogui Pillow

# Basic usage
python comet_auto_continue.py

# With options
python comet_auto_continue.py --interval 20 --timeout 60 --prompt "continue"

# Test mode (won't actually send input)
python comet_auto_continue.py --dry-run
```

**Options:**
- `--interval, -i`: Seconds between checks (default: 30)
- `--timeout, -t`: Seconds before prompting (default: 120)
- `--prompt, -p`: Message to send (default: "continue")
- `--dry-run, -d`: Test without sending input
- `--quiet, -q`: Less verbose output

---

## Safety Features

All scripts include safety features:

1. **Failsafe (Python scripts):** Move mouse to top-left corner to stop
2. **Ctrl+C:** Press to gracefully stop
3. **Dry run mode:** Test without actually sending input

---

## Recommended Workflow

1. **Start Comet Browser** and begin your automation task
2. **Run the auto-continue script** in a terminal
3. **Switch to Comet Browser window** (script will type into active window)
4. **Let it run** - script will detect pauses and continue automatically

### Example Session

```bash
# Terminal 1: Start the monitor
cd /Users/5425855/Documents/protocol-zero/scraper
python comet_simple_continue.py

# When prompted:
#   Timeout: 90 (or your preference)
#   Action: 1 (type 'continue')
#
# Then switch to Comet Browser window

# The script will now:
# - Check screen every 15 seconds
# - If no change for 90 seconds, type "continue" and press Enter
# - Continue monitoring
```

---

## Troubleshooting

### Script not detecting Comet Browser pauses

- Make sure Comet Browser window is visible (not minimized)
- Reduce the timeout value (e.g., 60 seconds instead of 90)
- Try the shell script if Python isn't working

### Messages not being sent

- Ensure Comet Browser has focus when running
- Check that there's an input field active in Comet
- Try `--dry-run` first to verify detection

### Screen capture permissions (macOS)

If screen capture fails, grant permissions:
1. Go to System Preferences → Privacy & Security → Screen Recording
2. Enable permission for Terminal (or iTerm)

### pyautogui errors

```bash
# Install/reinstall pyautogui
pip install --upgrade pyautogui Pillow
```

---

## Log Files

- `comet_monitor.log` - Full Python script logs (comet_auto_continue.py)
- Console output - Both scripts print activity to terminal

---

## Configuration for Knack Price Input

Based on your workflow with the Knack Airsoft Database:

1. Set timeout to match your typical pause frequency (start with 90 seconds)
2. Use "continue" as the prompt message (or whatever Comet expects)
3. If Comet needs specific input, customize the message:
   ```bash
   python comet_simple_continue.py -m "yes, continue to the next variant"
   ```

The script will keep Comet processing variants without manual intervention!







