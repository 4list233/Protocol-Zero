#!/usr/bin/env python3
"""
Comet Browser Simple Auto-Continue
==================================
Monitors for Comet Browser pauses and sends continuation prompts.

This version uses similarity thresholds to ignore minor screen changes
like cursor blinking, clock updates, and animations.

Usage:
    python3 comet_simple_continue.py

Requirements:
    pip3 install pyautogui pillow
"""

import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

# Attempt imports
try:
    import pyautogui
    pyautogui.FAILSAFE = True
except ImportError:
    print("Installing pyautogui...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pyautogui"])
    import pyautogui
    pyautogui.FAILSAFE = True

try:
    from PIL import ImageGrab, ImageChops, ImageFilter
except ImportError:
    print("Installing Pillow...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
    from PIL import ImageGrab, ImageChops, ImageFilter

import hashlib

# Store selected monitor bounds globally
MONITOR_BOUNDS = None


def get_monitors():
    """Get list of available monitors with their bounds."""
    try:
        # Try using screeninfo library if available
        from screeninfo import get_monitors as get_mon
        monitors = []
        for i, m in enumerate(get_mon()):
            monitors.append({
                'index': i,
                'name': m.name or f"Monitor {i}",
                'x': m.x,
                'y': m.y,
                'width': m.width,
                'height': m.height,
                'is_primary': m.is_primary if hasattr(m, 'is_primary') else (i == 0)
            })
        return monitors
    except ImportError:
        pass
    
    # Fallback: Use AppKit on macOS
    try:
        from AppKit import NSScreen
        monitors = []
        screens = NSScreen.screens()
        for i, screen in enumerate(screens):
            frame = screen.frame()
            monitors.append({
                'index': i,
                'name': f"Display {i + 1}" + (" (Main)" if i == 0 else " (Extended)"),
                'x': int(frame.origin.x),
                'y': int(frame.origin.y),
                'width': int(frame.size.width),
                'height': int(frame.size.height),
                'is_primary': i == 0
            })
        return monitors
    except ImportError:
        pass
    
    # Last fallback: Just return full screen
    try:
        img = ImageGrab.grab()
        return [{
            'index': 0,
            'name': "Full Screen",
            'x': 0,
            'y': 0,
            'width': img.width,
            'height': img.height,
            'is_primary': True
        }]
    except:
        return []


def select_monitor():
    """Let user select which monitor to watch."""
    monitors = get_monitors()
    
    if not monitors:
        print("  Could not detect monitors, using full screen")
        return None
    
    if len(monitors) == 1:
        print(f"  Only one display detected: {monitors[0]['name']}")
        return None
    
    print("\n📺 SELECT MONITOR TO WATCH")
    print("   Which display is Comet Browser on?\n")
    
    for m in monitors:
        primary = " ⭐" if m.get('is_primary') else ""
        print(f"   {m['index'] + 1}. {m['name']} ({m['width']}x{m['height']}){primary}")
    
    print(f"\n   0. Full screen (all monitors)")
    
    try:
        choice = input("\n   > ").strip()
        if not choice or choice == "0":
            print("   Using full screen")
            return None
        
        idx = int(choice) - 1
        if 0 <= idx < len(monitors):
            m = monitors[idx]
            bounds = (m['x'], m['y'], m['x'] + m['width'], m['y'] + m['height'])
            print(f"   ✅ Watching: {m['name']}")
            return bounds
        else:
            print("   Invalid choice, using full screen")
            return None
    except ValueError:
        print("   Invalid input, using full screen")
        return None


def get_screen_image(monitor_bounds=None):
    """Capture screen (or specific monitor) and return processed image for comparison."""
    global MONITOR_BOUNDS
    bounds = monitor_bounds or MONITOR_BOUNDS
    
    try:
        # Capture specific region or full screen
        if bounds:
            img = ImageGrab.grab(bbox=bounds)
        else:
            img = ImageGrab.grab()
        
        # Resize to reduce noise from small changes
        img = img.resize((200, 150))
        # Convert to grayscale to reduce color noise
        img = img.convert('L')
        # Apply slight blur to reduce noise from cursor/animations
        img = img.filter(ImageFilter.GaussianBlur(radius=2))
        return img
    except Exception as e:
        print(f"Screen capture error: {e}")
        return None


def calculate_difference(img1, img2):
    """
    Calculate the percentage difference between two images.
    Returns a value from 0 (identical) to 100 (completely different).
    """
    if img1 is None or img2 is None:
        return 100  # Assume different if capture failed

    try:
        # Calculate difference
        diff = ImageChops.difference(img1, img2)
        
        # Get histogram and calculate total difference
        histogram = diff.histogram()
        
        # Sum of all pixel differences weighted by intensity
        total_diff = sum(i * count for i, count in enumerate(histogram))
        
        # Maximum possible difference
        max_diff = img1.size[0] * img1.size[1] * 255
        
        # Return percentage
        return (total_diff / max_diff) * 100
    except Exception as e:
        print(f"Comparison error: {e}")
        return 100


# Simple continue messages to avoid spam detection (rotate through these)
SIMPLE_CONTINUE_MESSAGES = [
    "continue",
    "keep going",
    "proceed",
    "next",
    "go ahead",
    "carry on",
    "keep working",
    "continue processing",
    "move forward",
    "keep it up"
]

def send_continue_message(message="continue", chatbox_position=None, is_full_instructions=False):
    """Send a continue message to the active window."""
    # Show preview of message (first 50 chars)
    preview = message[:50] + "..." if len(message) > 50 else message
    preview = preview.replace('\n', ' ')
    msg_type = "📋 FULL INSTRUCTIONS" if is_full_instructions else "💬 Simple message"
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg_type} 📤 Sending: '{preview}'")

    # If we have a saved chatbox position, click there first to ensure focus
    if chatbox_position:
        x, y = chatbox_position
        print(f"[{datetime.now().strftime('%H:%M:%S')}] 🖱️  Clicking chatbox at ({x}, {y})")
        pyautogui.click(x, y)
        time.sleep(0.3)

    # Small delay before action
    time.sleep(0.2)

    # For long messages, use clipboard paste (much faster and more reliable)
    if len(message) > 20:
        try:
            import pyperclip
            pyperclip.copy(message)
            time.sleep(0.1)
            # Cmd+V on macOS, Ctrl+V on others
            if sys.platform == "darwin":
                pyautogui.hotkey('command', 'v')
            else:
                pyautogui.hotkey('ctrl', 'v')
            time.sleep(0.2)
        except ImportError:
            # Fallback to typing if pyperclip not available
            print(f"[{datetime.now().strftime('%H:%M:%S')}] ⚠️  pyperclip not installed, typing instead...")
            pyautogui.typewrite(message, interval=0.01)
    else:
        # For short messages, type character by character
        for char in message:
            pyautogui.press(char)
            time.sleep(0.02)
    
    time.sleep(0.1)

    # Press Enter
    pyautogui.press('enter')

    print(f"[{datetime.now().strftime('%H:%M:%S')}] ✅ Message sent")


def send_enter_key(chatbox_position=None):
    """Just press Enter to continue."""
    # If we have a saved chatbox position, click there first to ensure focus
    if chatbox_position:
        x, y = chatbox_position
        print(f"[{datetime.now().strftime('%H:%M:%S')}] 🖱️  Clicking chatbox at ({x}, {y})")
        pyautogui.click(x, y)
        time.sleep(0.3)
    
    print(f"[{datetime.now().strftime('%H:%M:%S')}] ⏎ Pressing Enter")
    pyautogui.press('enter')


def get_chatbox_position():
    """Let user click to set the chatbox position."""
    print("\n🖱️  CHATBOX POSITION SETUP")
    print("   Move your mouse to the Comet chatbox input field")
    print("   and press ENTER when ready (or 's' to skip)...")
    
    choice = input("   > ").strip().lower()
    if choice == 's':
        print("   Skipping - will type without clicking")
        return None
    
    pos = pyautogui.position()
    print(f"   ✅ Saved position: ({pos.x}, {pos.y})")
    return (pos.x, pos.y)


def run_monitor(
    inactivity_seconds=60,
    check_interval=10,
    message="continue",
    just_enter=False,
    sensitivity=1.0,  # Percentage threshold - changes below this are ignored
    chatbox_position=None,  # (x, y) tuple to click before typing
    monitor_bounds=None,  # (x1, y1, x2, y2) tuple for specific monitor
    simple_only=False  # If True, only use simple messages (no full instructions)
):
    """
    Main monitoring loop.

    Args:
        inactivity_seconds: Seconds without significant change before prompting
        check_interval: Seconds between checks
        message: Message to type (ignored if just_enter=True)
        just_enter: If True, just press Enter instead of typing
        sensitivity: Percentage difference threshold (0-100). Lower = more sensitive.
                    Default 2.0 means changes less than 2% are considered "no change"
    """
    # Set global monitor bounds for get_screen_image
    global MONITOR_BOUNDS
    MONITOR_BOUNDS = monitor_bounds
    
    print("=" * 50)
    print("🚀 Comet Browser Auto-Continue Monitor")
    print("=" * 50)
    print(f"  Inactivity threshold: {inactivity_seconds}s")
    print(f"  Check interval: {check_interval}s")
    print(f"  Sensitivity: {sensitivity}% (changes below this are ignored)")
    if just_enter:
        print(f"  Action: Press Enter")
    else:
        print(f"  Action: Alternate simple messages + full instructions every 4 cycles")
        print(f"    - Cycles 1-3: Simple messages (continue, keep going, etc.)")
        print(f"    - Cycle 4: Full instructions from file")
    if chatbox_position:
        print(f"  Chatbox position: ({chatbox_position[0]}, {chatbox_position[1]})")
    else:
        print("  Chatbox position: Not set (typing to active window)")
    if monitor_bounds:
        w = monitor_bounds[2] - monitor_bounds[0]
        h = monitor_bounds[3] - monitor_bounds[1]
        print(f"  Monitor: Watching specific display ({w}x{h})")
    else:
        print("  Monitor: Full screen (all displays)")
    print()
    print("⚠️  Move mouse to TOP-LEFT CORNER to stop")
    print("⚠️  Press Ctrl+C to stop")
    print("=" * 50)
    print()

    last_image = None
    last_significant_change = time.time()
    prompts_sent = 0
    cycle_count = 0  # Track cycles for alternating messages
    
    # Load full instructions file if it exists (unless simple_only mode)
    instructions_file = Path(__file__).parent.parent / "COMET_BROWSER_INSTRUCTIONS.md"
    full_instructions = None
    if not simple_only:
        if instructions_file.exists():
            full_instructions = instructions_file.read_text().strip()
            print(f"  ✅ Loaded instructions file ({len(full_instructions)} chars)")
        else:
            print(f"  ⚠️  Instructions file not found: {instructions_file}")
    else:
        print(f"  ℹ️  Simple messages only mode (full instructions disabled)")
    
    # Track recent differences for debugging
    recent_diffs = []

    try:
        while True:
            current_image = get_screen_image()
            current_time = time.time()

            if last_image is not None:
                # Calculate difference percentage
                diff_percent = calculate_difference(last_image, current_image)
                recent_diffs.append(diff_percent)
                if len(recent_diffs) > 10:
                    recent_diffs.pop(0)
                
                # Check if this is a significant change
                if diff_percent > sensitivity:
                    # Significant change detected
                    print(
                        f"[{datetime.now().strftime('%H:%M:%S')}] "
                        f"🔄 Activity: {diff_percent:.1f}% change"
                    )
                    last_significant_change = current_time
                else:
                    # No significant change
                    inactive_duration = current_time - last_significant_change
                    remaining = inactivity_seconds - inactive_duration

                    if remaining > 0:
                        avg_diff = sum(recent_diffs) / len(recent_diffs) if recent_diffs else 0
                        print(
                            f"[{datetime.now().strftime('%H:%M:%S')}] "
                            f"⏳ Static for {int(inactive_duration)}s "
                            f"(diff: {diff_percent:.2f}%, avg: {avg_diff:.2f}%) "
                            f"- prompt in {int(remaining)}s"
                        )
                    else:
                        # Time to prompt!
                        print()
                        print(f"[{datetime.now().strftime('%H:%M:%S')}] ⚡ Inactivity detected!")

                        if just_enter:
                            send_enter_key(chatbox_position)
                        else:
                            # Alternate between simple messages and full instructions
                            cycle_count += 1
                            
                            # Every 4th cycle, send full instructions (unless simple_only mode)
                            if cycle_count % 4 == 0 and full_instructions and not simple_only:
                                send_continue_message(full_instructions, chatbox_position, is_full_instructions=True)
                            else:
                                # Use simple message, rotating through the list
                                simple_msg_index = (cycle_count - 1) % len(SIMPLE_CONTINUE_MESSAGES)
                                simple_msg = SIMPLE_CONTINUE_MESSAGES[simple_msg_index]
                                send_continue_message(simple_msg, chatbox_position, is_full_instructions=False)

                        prompts_sent += 1
                        last_significant_change = current_time
                        last_image = None  # Reset to detect new changes

                        print()
                        # Wait a bit for browser to react
                        time.sleep(3)
                        continue

            last_image = current_image
            time.sleep(check_interval)

    except KeyboardInterrupt:
        print("\n\n🛑 Stopped by user")
    except pyautogui.FailSafeException:
        print("\n\n🛑 Stopped (mouse moved to corner)")
    finally:
        print(f"\n📊 Total prompts sent: {prompts_sent}")
        print(f"📊 Cycles completed: {cycle_count}")
        if cycle_count > 0:
            full_instructions_count = cycle_count // 4
            simple_messages_count = cycle_count - full_instructions_count
            print(f"   - Full instructions: {full_instructions_count}")
            print(f"   - Simple messages: {simple_messages_count}")


def main():
    """Interactive setup and run."""
    print("\n🎯 Comet Browser Auto-Continue Setup\n")

    # Select which monitor to watch
    monitor_bounds = select_monitor()

    # Ask for configuration
    print("\nHow long should I wait before prompting? (seconds)")
    print("  [Default: 60 seconds - reduced from 90 for better detection]")
    try:
        timeout_input = input("  > ").strip()
        timeout = int(timeout_input) if timeout_input else 60
    except ValueError:
        timeout = 60
        print("  Using default: 60 seconds")

    print("\nSensitivity (% screen change to count as 'activity'):")
    print("  When Comet is working: ~1.5-2% change (pages loading, scrolling)")
    print("  When Comet is paused: <1% change (truly static)")
    print("  [Default: 1.0% - triggers prompt only when Comet is truly paused]")
    try:
        sens_input = input("  > ").strip()
        sensitivity = float(sens_input) if sens_input else 1.0
    except ValueError:
        sensitivity = 1.0
        print("  Using default: 1.0%")

    print("\nMessage strategy:")
    print("  Automatic alternating (recommended):")
    print("    - Cycles 1-3: Simple messages (continue, keep going, etc.)")
    print("    - Cycle 4: Full instructions from COMET_BROWSER_INSTRUCTIONS.md")
    print("    - Repeats every 4 cycles to avoid spam detection")
    print("\n  1. Use automatic alternating (recommended)")
    print("  2. Just press Enter (no messages)")
    print("  3. Use only simple messages (no full instructions)")

    try:
        choice = input("  > ").strip() or "1"
    except:
        choice = "1"

    just_enter = False
    message = "continue"  # Not used in auto mode, but kept for compatibility

    simple_only = False
    if choice == "1":
        # Automatic alternating mode (default)
        print("  ✅ Using automatic alternating mode")
        print("  📋 Will load instructions from COMET_BROWSER_INSTRUCTIONS.md")
    elif choice == "2":
        just_enter = True
        print("  ✅ Will just press Enter")
    elif choice == "3":
        simple_only = True
        print("  ✅ Using only simple messages (no full instructions)")

    # Get chatbox position
    chatbox_position = get_chatbox_position()

    print("\nStarting monitor in 3 seconds...")
    print("(Switch to Comet Browser window now!)")
    time.sleep(3)

    run_monitor(
        inactivity_seconds=timeout,
        check_interval=10,
        message=message,
        just_enter=just_enter,
        sensitivity=sensitivity,
        chatbox_position=chatbox_position,
        monitor_bounds=monitor_bounds,
        simple_only=simple_only
    )


if __name__ == "__main__":
    # Check if running with arguments
    if len(sys.argv) > 1:
        # Quick mode with arguments
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--timeout", "-t", type=int, default=60)
        parser.add_argument("--message", "-m", type=str, default="continue")
        parser.add_argument("--enter-only", "-e", action="store_true")
        parser.add_argument("--sensitivity", "-s", type=float, default=1.0,
                          help="Percentage threshold for significant change (default: 1.0)")
        args = parser.parse_args()

        print("\nStarting in 3 seconds... Switch to Comet Browser!")
        time.sleep(3)

        run_monitor(
            inactivity_seconds=args.timeout,
            message=args.message,
            just_enter=args.enter_only,
            sensitivity=args.sensitivity
        )
    else:
        main()
