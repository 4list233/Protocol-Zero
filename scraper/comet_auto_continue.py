#!/usr/bin/env python3
"""
Comet Browser Auto-Continue Script
===================================
Monitors Comet Browser for inactivity and automatically prompts it to continue
when it appears to have paused.

Usage:
    python comet_auto_continue.py [--interval 30] [--timeout 120] [--dry-run]

Requirements:
    pip install pyautogui pygetwindow pillow
"""

import argparse
import hashlib
import os
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

# Check for required packages and provide installation instructions
try:
    import pyautogui
except ImportError:
    print("❌ Missing required package: pyautogui")
    print("   Install with: pip install pyautogui")
    sys.exit(1)

try:
    from PIL import ImageGrab
except ImportError:
    print("❌ Missing required package: Pillow")
    print("   Install with: pip install Pillow")
    sys.exit(1)

# For macOS window management
IS_MACOS = sys.platform == "darwin"

# Configure pyautogui safety features
pyautogui.FAILSAFE = True  # Move mouse to corner to abort
pyautogui.PAUSE = 0.5  # Add small delay between actions


class CometAutoMonitor:
    """Monitor Comet Browser and auto-continue when it pauses."""

    # Common prompts that indicate the browser wants to continue
    CONTINUE_PROMPTS = [
        "continue",
        "keep going",
        "proceed",
        "yes",
        "ok",
    ]

    # Pause indicators (patterns that suggest the browser is waiting)
    PAUSE_INDICATORS = [
        "waiting for input",
        "paused",
        "shall i continue",
        "should i continue",
        "do you want me to",
        "press enter to continue",
        "click to continue",
    ]

    def __init__(
        self,
        check_interval: int = 30,
        inactivity_timeout: int = 120,
        continue_prompt: str = "continue",
        dry_run: bool = False,
        verbose: bool = True,
    ):
        """
        Initialize the monitor.

        Args:
            check_interval: Seconds between activity checks
            inactivity_timeout: Seconds of inactivity before prompting
            continue_prompt: Text to type when prompting continuation
            dry_run: If True, don't actually send input
            verbose: Print detailed logs
        """
        self.check_interval = check_interval
        self.inactivity_timeout = inactivity_timeout
        self.continue_prompt = continue_prompt
        self.dry_run = dry_run
        self.verbose = verbose

        self.last_screen_hash = None
        self.last_activity_time = time.time()
        self.prompt_count = 0
        self.running = True

        # Log file
        self.log_file = Path(__file__).parent / "comet_monitor.log"

    def log(self, message: str, level: str = "INFO"):
        """Log a message with timestamp."""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_entry = f"[{timestamp}] [{level}] {message}"

        if self.verbose:
            print(log_entry)

        with open(self.log_file, "a") as f:
            f.write(log_entry + "\n")

    def get_screen_hash(self) -> str:
        """Capture screen and return a hash to detect changes."""
        try:
            # Capture the screen
            screenshot = ImageGrab.grab()

            # Resize to small size for faster hashing (we just need change detection)
            screenshot = screenshot.resize((100, 100))

            # Convert to bytes and hash
            img_bytes = screenshot.tobytes()
            return hashlib.md5(img_bytes).hexdigest()
        except Exception as e:
            self.log(f"Error capturing screen: {e}", "ERROR")
            return None

    def get_comet_window_title(self) -> str:
        """Try to find Comet Browser window title (macOS)."""
        if not IS_MACOS:
            return None

        try:
            # Use AppleScript to get window list
            script = '''
            tell application "System Events"
                set windowList to {}
                repeat with proc in (every process whose visible is true)
                    repeat with win in (every window of proc)
                        set end of windowList to name of win
                    end repeat
                end repeat
                return windowList
            end tell
            '''
            result = subprocess.run(
                ["osascript", "-e", script],
                capture_output=True,
                text=True
            )
            windows = result.stdout.strip()

            # Look for Comet in window titles
            for word in ["comet", "Comet", "COMET"]:
                if word.lower() in windows.lower():
                    return windows
            return windows
        except Exception as e:
            self.log(f"Error getting window titles: {e}", "ERROR")
            return None

    def focus_comet_window(self) -> bool:
        """Try to bring Comet Browser to front (macOS)."""
        if not IS_MACOS:
            return False

        try:
            # Try to activate Comet Browser
            script = '''
            tell application "System Events"
                set procList to name of every process whose visible is true
                repeat with procName in procList
                    if procName contains "Comet" or procName contains "comet" then
                        tell process procName
                            set frontmost to true
                        end tell
                        return true
                    end if
                end repeat
            end tell
            return false
            '''
            result = subprocess.run(
                ["osascript", "-e", script],
                capture_output=True,
                text=True
            )
            return "true" in result.stdout.lower()
        except Exception as e:
            self.log(f"Error focusing window: {e}", "ERROR")
            return False

    def send_continue_prompt(self):
        """Send a continue prompt to the browser."""
        if self.dry_run:
            self.log(f"[DRY RUN] Would send: '{self.continue_prompt}'", "ACTION")
            return

        self.log(f"Sending continue prompt: '{self.continue_prompt}'", "ACTION")

        # Try to focus Comet window first
        if IS_MACOS:
            self.focus_comet_window()
            time.sleep(0.5)

        # Click in the center of the screen to ensure focus
        screen_width, screen_height = pyautogui.size()
        center_x = screen_width // 2
        center_y = screen_height // 2

        # Click to focus (in case there's an input field)
        pyautogui.click(center_x, center_y)
        time.sleep(0.3)

        # Type the continue prompt
        pyautogui.typewrite(self.continue_prompt, interval=0.05)
        time.sleep(0.2)

        # Press Enter to submit
        pyautogui.press("enter")

        self.prompt_count += 1
        self.log(f"Prompt sent (total: {self.prompt_count})", "ACTION")

    def detect_activity(self) -> bool:
        """
        Check if the browser is active (screen changing).

        Returns:
            True if activity detected, False if appears paused
        """
        current_hash = self.get_screen_hash()

        if current_hash is None:
            return True  # Assume active if we can't check

        if self.last_screen_hash is None:
            self.last_screen_hash = current_hash
            return True

        # Compare hashes
        has_changed = current_hash != self.last_screen_hash
        self.last_screen_hash = current_hash

        return has_changed

    def run(self):
        """Main monitoring loop."""
        self.log("=" * 60)
        self.log("Comet Browser Auto-Continue Monitor Started")
        self.log(f"  Check interval: {self.check_interval}s")
        self.log(f"  Inactivity timeout: {self.inactivity_timeout}s")
        self.log(f"  Continue prompt: '{self.continue_prompt}'")
        self.log(f"  Dry run: {self.dry_run}")
        self.log("=" * 60)
        self.log("Press Ctrl+C to stop, or move mouse to top-left corner")
        self.log("")

        consecutive_unchanged = 0
        checks_needed = self.inactivity_timeout // self.check_interval

        try:
            while self.running:
                # Check for activity
                if self.detect_activity():
                    if consecutive_unchanged > 0:
                        self.log("Activity detected - browser is active")
                    consecutive_unchanged = 0
                    self.last_activity_time = time.time()
                else:
                    consecutive_unchanged += 1
                    elapsed = consecutive_unchanged * self.check_interval
                    self.log(
                        f"No screen change detected ({elapsed}s / {self.inactivity_timeout}s)",
                        "WARN"
                    )

                    # Check if we've hit the inactivity threshold
                    if consecutive_unchanged >= checks_needed:
                        self.log(
                            f"Inactivity threshold reached ({self.inactivity_timeout}s)",
                            "WARN"
                        )
                        self.send_continue_prompt()
                        consecutive_unchanged = 0
                        self.last_activity_time = time.time()

                        # Wait a bit for the browser to react
                        time.sleep(5)

                # Wait for next check
                time.sleep(self.check_interval)

        except KeyboardInterrupt:
            self.log("\nMonitor stopped by user", "INFO")
        except pyautogui.FailSafeException:
            self.log("\nMonitor stopped - mouse moved to corner (failsafe)", "WARN")
        finally:
            self.log(f"Total prompts sent: {self.prompt_count}")
            self.log("Monitor shutdown complete")


def main():
    """Parse arguments and run the monitor."""
    parser = argparse.ArgumentParser(
        description="Monitor Comet Browser and auto-continue when it pauses",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Basic usage with defaults
    python comet_auto_continue.py

    # Check every 20 seconds, prompt after 60 seconds of inactivity
    python comet_auto_continue.py --interval 20 --timeout 60

    # Use custom continue message
    python comet_auto_continue.py --prompt "keep going"

    # Test without actually sending input
    python comet_auto_continue.py --dry-run

Safety:
    - Move your mouse to the top-left corner to immediately stop the script
    - Press Ctrl+C to gracefully stop
        """
    )

    parser.add_argument(
        "--interval", "-i",
        type=int,
        default=30,
        help="Seconds between activity checks (default: 30)"
    )

    parser.add_argument(
        "--timeout", "-t",
        type=int,
        default=120,
        help="Seconds of inactivity before prompting (default: 120)"
    )

    parser.add_argument(
        "--prompt", "-p",
        type=str,
        default="continue",
        help="Text to send when prompting (default: 'continue')"
    )

    parser.add_argument(
        "--dry-run", "-d",
        action="store_true",
        help="Test mode - don't actually send input"
    )

    parser.add_argument(
        "--quiet", "-q",
        action="store_true",
        help="Reduce output verbosity"
    )

    args = parser.parse_args()

    # Validate arguments
    if args.interval < 5:
        print("Warning: Very short intervals may cause high CPU usage")

    if args.timeout < args.interval:
        print("Error: Timeout must be greater than interval")
        sys.exit(1)

    # Create and run monitor
    monitor = CometAutoMonitor(
        check_interval=args.interval,
        inactivity_timeout=args.timeout,
        continue_prompt=args.prompt,
        dry_run=args.dry_run,
        verbose=not args.quiet,
    )

    monitor.run()


if __name__ == "__main__":
    main()










