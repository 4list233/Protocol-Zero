import csv
import time
import os
import re
import requests
import subprocess
import sys
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
# LLM translation will be added via OpenAI API
import json
from typing import List, Dict

# --- Optional OCR (pytesseract) Support ---
# We enable screenshot+OCR fallback for titles/prices when DOM text is unreliable.
_TESSERACT_READY = None  # lazy init flag

def _setup_tesseract_if_available():
    """Best-effort tesseract discovery. Returns True if pytesseract + binary usable."""
    global _TESSERACT_READY
    if _TESSERACT_READY is not None:
        return _TESSERACT_READY
    try:
        import pytesseract  # type: ignore
    except Exception:
        _TESSERACT_READY = False
        return False
    # Prefer explicit env var
    tcmd = os.environ.get('TESSERACT_CMD')
    common_paths = [
        tcmd,
        '/opt/homebrew/bin/tesseract',  # Apple Silicon Homebrew
        '/usr/local/bin/tesseract',     # Intel Homebrew
        '/usr/bin/tesseract',
    ]
    for p in common_paths:
        if p and os.path.exists(p):
            pytesseract.pytesseract.tesseract_cmd = p
            try:
                _ = pytesseract.get_tesseract_version()
                _TESSERACT_READY = True
                return True
            except Exception:
                pass
    # If not found, still try default resolution; pytesseract may find it in PATH
    try:
        _ = pytesseract.get_tesseract_version()
        _TESSERACT_READY = True
        return True
    except Exception:
        _TESSERACT_READY = False
        return False

def _seems_mojibake(s: str) -> bool:
    """Heuristic: detect common mojibake artifacts (e.g., 'Â', '¬•', odd symbol soup)."""
    if not s:
        return False
    weird_chars = 'Â¬•‰™∂ºËßØÈÎÊÁàãÃåÅéÉôÔ'
    if any(ch in s for ch in weird_chars):
        return True
    # Too many non-alnum symbols relative to letters/digits
    import string as _string
    letters_digits = sum(c.isalnum() for c in s)
    symbols = sum(c in _string.punctuation for c in s)
    return letters_digits > 0 and symbols > letters_digits

def _ocr_text_from_element(driver, element, *, lang_primary='eng', include_chi=True, psm=6) -> str:
    """Screenshot an element and OCR its text. Uses PIL-only preprocessing.
    Returns stripped text or empty string.
    """
    if not _setup_tesseract_if_available():
        return ''
    try:
        import io
        from PIL import Image, ImageOps, ImageFilter, ImageEnhance
        import pytesseract  # type: ignore

        png = element.screenshot_as_png
        img = Image.open(io.BytesIO(png))
        # Upscale for better OCR
        scale = 2
        img = img.convert('L')  # grayscale
        img = img.resize((max(1, img.width * scale), max(1, img.height * scale)), Image.Resampling.LANCZOS)
        img = ImageOps.autocontrast(img)
        img = ImageEnhance.Sharpness(img).enhance(1.5)

        lang = lang_primary
        if include_chi:
            # Prefer eng+chi_sim if installed; fall back to eng silently
            try:
                lang = f"{lang_primary}+chi_sim"
                _ = pytesseract.image_to_string(img, lang=lang, config=f"--oem 3 --psm {psm}")
            except Exception:
                lang = lang_primary

        text = pytesseract.image_to_string(img, lang=lang, config=f"--oem 3 --psm {psm}")
        return (text or '').strip()
    except Exception:
        return ''

def _ocr_price_from_element(driver, element) -> float:
    """OCR a price-like element and parse a CNY numeric value."""
    txt = _ocr_text_from_element(driver, element, lang_primary='eng', include_chi=False, psm=7)
    if not txt:
        return None
    # Normalize common OCR confusions
    txt = txt.replace(',', '').replace('O', '0').replace('o', '0').replace('S', '5').replace('¥', '')
    val = parse_cny_price(txt)
    return val

# --- Dynamic Configuration ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
LINK_FILE = os.path.join(SCRIPT_DIR, 'taobao_links.txt')
CSV_OUTPUT_FILE = os.path.join(SCRIPT_DIR, 'protocol_zero_variants.csv')
MEDIA_DIR = os.path.join(SCRIPT_DIR, 'media')
SCREENSHOTS_DIR = os.path.join(SCRIPT_DIR, 'screenshots')
SELENIUM_PROFILE_DIR = os.path.join(SCRIPT_DIR, 'chrome_profile_selenium')
SHARED_DATA_DIR = os.path.join(SCRIPT_DIR, '..', 'shared', 'data')

# --- REAL SELECTORS (FROM YOUR HTML) ---
TITLE_SELECTOR = 'span.mainTitle--R75fTcZL'
OPTION_BUTTONS_SELECTOR = 'div.valueItem--smR4pNt4'
PRICE_SELECTOR = 'span.Price--priceText--2nLbVda' # Note: Price is protected and may not be found
PRODUCT_IMAGE_AREA_SELECTOR = 'div.mainPicWrap--Ns5WQiHr'
MAIN_IMAGE_SELECTOR = 'img.mainPic--vMTLgVPN'  # Main product image (currently displayed) (fallbacks added below)
THUMBNAIL_CONTAINER_SELECTOR = 'ul.picLayout--masonryWrap--njZmY0n'  # Thumbnail container
THUMBNAIL_IMAGE_SELECTOR = 'img[src*="taobao"], img[src*="alicdn"]'  # All product images
DETAIL_SECTION_SELECTOR = 'div[class*="description"], div[class*="detail"]'  # Detail section
DETAIL_IMAGES_SELECTOR = 'img[src*="desc"], img[src*="detail"]'  # Detail images in description
# --- End Configuration ---

# --- Currency Conversion ---
# CNY->CAD rate with small markup for processing fees
CNY_TO_CAD_RATE = 0.202
FLAT_SHIPPING_CAD = 15.0

# --- LLM Translation Configuration ---
 # Removed heavy external translators; we'll use lightweight rule-based translations

def parse_cny_price(raw_text: str):
    """Parse a Taobao/Tmall price string like '¥88.00', '￥88-120', '88-120元' -> return float (use lower bound on ranges)."""
    if not raw_text:
        return None
    try:
        s = raw_text.replace(',', '')
        # Extract all numbers
        import re as _re
        nums = [_re.sub(r"[^0-9\.]", "", m) for m in _re.findall(r"[0-9]+(?:\.[0-9]+)?", s)]
        nums = [float(n) for n in nums if n]
        if not nums:
            return None
        return min(nums)  # choose lower bound for ranges
    except Exception:
        return None

def to_cad(amount_cny: float):
    return round(amount_cny * CNY_TO_CAD_RATE, 2) if amount_cny is not None else None

def get_price_cny(driver, debug=False):
    """Robustly get current product price in CNY as float from the page."""
    
    if debug:
        print(f"        [DEBUG] === Starting price extraction ===")
    
    # CRITICAL: Scope search to product info area ONLY (not sidebar recommendations)
    product_area = None
    try:
        # Try to find the main product info container
        product_area_selectors = [
            'div[class*="BasicInfo"]',  # Taobao product info block
            'div[class*="itemInfo"]',
            'div[class*="productInfo"]',
            'div[class*="priceView"]',
        ]
        for sel in product_area_selectors:
            try:
                product_area = driver.find_element(By.CSS_SELECTOR, sel)
                if debug:
                    print(f"        [DEBUG] Using product area: {sel}")
                break
            except:
                continue
    except:
        pass
    
    search_scope = product_area if product_area else driver
    
    # PRIORITY 1: Look for 优惠前 (original price) or 券后 (coupon price)
    # Example: "券后 ¥ 215 优惠前 ¥ 235 · 已售 5"
    # Strategy: Find label elements, then get parent container with full price text
    try:
        import re
        # Find label elements (券后 or 优惠前)
        label_elements = search_scope.find_elements(By.XPATH, ".//*[contains(text(),'券后') or contains(text(),'优惠前')]")
        
        for label_el in label_elements:
            # Get parent container that should have the full price block
            try:
                parent = label_el.find_element(By.XPATH, './parent::*')
                txt = (parent.text or '').strip()
            except:
                txt = (label_el.text or '').strip()
            
            # Skip if text is too long (likely not the price block)
            if len(txt) > 500 or len(txt) < 3:
                continue
            
            if debug:
                print(f"        [DEBUG] Price container text: '{txt[:200]}'")
            
            # BEST: Look for 优惠前 (original price before discount)
            match_original = re.search(r'优惠前[^¥]*¥\s*(\d+(?:\.\d+)?)', txt)
            if match_original:
                val = float(match_original.group(1))
                if 1 <= val <= 10000:
                    if debug:
                        print(f"        [DEBUG] ✓ Found 优惠前 (original price): {val} CNY")
                    return val
            
            # FALLBACK: Use 券后 (coupon price)
            match_coupon = re.search(r'券后[^¥]*¥\s*(\d+(?:\.\d+)?)', txt)
            if match_coupon:
                val = float(match_coupon.group(1))
                if 1 <= val <= 10000:
                    if debug:
                        print(f"        [DEBUG] ✓ Found 券后 (coupon price): {val} CNY")
                    return val
    except Exception as e:
        if debug:
            print(f"        [DEBUG] Price search error: {e}")
    
    # PRIORITY 2: Try preferred selector (within product area)
    try:
        el = search_scope.find_element(By.CSS_SELECTOR, PRICE_SELECTOR)
        txt = el.text.strip()
        if debug:
            print(f"        [DEBUG] PRICE_SELECTOR: '{txt}'")
        val = parse_cny_price(txt)
        if val is not None and val > 0:
            if debug:
                print(f"        [DEBUG] ✓ Found price via PRICE_SELECTOR: {val} CNY")
            return val
    except Exception:
        pass
    
    # Try to find actual product price (not shipping/promo)
    # Look for elements with specific price-related classes that typically show product price
    priority_selectors = [
        'span[class*="mainPrice"]',  # Main product price
        'span[class*="originalPrice"]',  # Original price before discount
        'span[class*="realPrice"]',  # Real/actual price
        'div[class*="priceView"] span[class*="price"]',  # Price view container
        'strong[class*="price"]',  # Bold price text
    ]
    
    for sel in priority_selectors:
        try:
            els = driver.find_elements(By.CSS_SELECTOR, sel)
            for el in els:
                txt = (el.text or '').strip()
                # Skip if it contains "免费" (free) or other non-price text
                if '免费' in txt or '运费' in txt or '邮费' in txt:
                    continue
                if '¥' in txt or '￥' in txt or any(ch.isdigit() for ch in txt):
                    val = parse_cny_price(txt)
                    if val is not None and val > 0:  # Must be positive
                        if debug:
                            print(f"        [DEBUG] Found price via priority selector '{sel}': {val} CNY (text: '{txt}')")
                        return val
        except Exception:
            continue
    
    # PRIORITY 3: Common alternative selectors (within product area) - collect and pick reasonable price
    alt_selectors = [
        'span[class*="mainPrice"]',  # Main product price
        'span[class*="Price"]',  # Capital P for newer Taobao
        'span[class*="price"]', 'div[class*="price"]',
        'span[class*="tm-price"]', 'span[class*="tm-promo-price"]',
        'span[class*="price-now"]', 'span[class*="real"]',
        'span.price-original', 'span.price-current'
    ]
    
    found_prices = []
    for sel in alt_selectors:
        try:
            els = search_scope.find_elements(By.CSS_SELECTOR, sel)
            for el in els:
                txt = (el.text or '').strip()
                # Skip free shipping labels, zero prices, and people count (人购买/人付款)
                if '免费' in txt or '运费' in txt or '邮费' in txt or '人购买' in txt or '人付款' in txt:
                    continue
                if '¥' in txt or '￥' in txt or any(ch.isdigit() for ch in txt):
                    val = parse_cny_price(txt)
                    # Filter unrealistic prices (too high suggests sidebar recommendation)
                    if val is not None and 1 < val < 10000:  # Reasonable product range
                        found_prices.append((val, txt, sel))
                        if debug:
                            print(f"        [DEBUG] Found price via '{sel}': {val} CNY (text: '{txt[:50]}')")
        except Exception:
            continue
    
    # Pick highest reasonable price (main price, not deep discount)
    if found_prices:
        found_prices.sort(reverse=True)  # Sort by value descending
        # Take first that's not absurdly high
        for price_val, txt, sel in found_prices:
            if price_val < 5000:  # Exclude extremely high sidebar prices
                if debug:
                    print(f"        [DEBUG] ✓ Selected price: {price_val} CNY from {len(found_prices)} candidates")
                return price_val
        # If all are high, take highest anyway
        best_price = found_prices[0][0]
        if debug:
            print(f"        [DEBUG] ✓ Selected highest: {best_price} CNY")
        return best_price
    
    # PRIORITY 4: Fallback - any element containing yuan symbol (collect all, pick highest)
    try:
        candidates = driver.find_elements(By.XPATH, "//*[contains(text(),'¥') or contains(text(),'￥')]")
        xpath_prices = []
        for el in candidates:
            txt = (el.text or '').strip()
            if '免费' in txt or '运费' in txt or '邮费' in txt or '券' in txt:
                continue
            val = parse_cny_price(txt)
            if val is not None and val > 0:
                xpath_prices.append((val, txt))
                if debug:
                    print(f"        [DEBUG] XPath yuan symbol: {val} CNY (text: '{txt}')")
        
        if xpath_prices:
            xpath_prices.sort(reverse=True)
            best_price = xpath_prices[0][0]
            if debug:
                print(f"        [DEBUG] ✓ Selected highest XPath price: {best_price} CNY")
            return best_price
    except Exception:
        pass
    # OCR fallback: try visible price-like elements
    try:
        candidates_css = [PRICE_SELECTOR,
                          'span[class*="mainPrice"]',
                          'span[class*="Price"]',
                          'span[class*="price"]',
                          'div[class*="price"]']
        seen = set()
        for sel in candidates_css:
            try:
                els = driver.find_elements(By.CSS_SELECTOR, sel)
                for el in els:
                    if el._id in seen:
                        continue
                    seen.add(el._id)
                    # Must be displayed and reasonably sized
                    try:
                        if not el.is_displayed():
                            continue
                        sz = el.size
                        if (sz.get('width', 0) < 40) or (sz.get('height', 0) < 12):
                            continue
                    except Exception:
                        pass
                    val = _ocr_price_from_element(driver, el)
                    if val is not None and val > 0:
                        if debug:
                            print(f"        [DEBUG] OCR price: {val} CNY")
                        return val
            except Exception:
                continue
    except Exception:
        pass
    if debug:
        print(f"        [DEBUG] No price found after trying selectors and OCR")
    return None

def get_price_cny_with_wait(driver, timeout_sec: float = 6.0, poll: float = 0.5, debug=False):
    """Poll the page for a price in CNY for up to timeout_sec seconds."""
    end = time.time() + timeout_sec
    last_val = None
    attempts = 0
    while time.time() < end:
        val = get_price_cny(driver, debug=debug)
        attempts += 1
        if val is not None and val > 0:  # Must be positive price
            # If a price actually appears and is stable for two polls, accept
            if last_val is not None and abs(val - last_val) < 0.001:
                if debug:
                    print(f"        [DEBUG] Price stabilized at {val} CNY after {attempts} attempts")
                return val
            last_val = val
        time.sleep(poll)
    
    # If no price found via DOM, try to extract from page data/script tags as last resort
    if last_val is None and debug:
        try:
            # Look for price data in script tags or data attributes
            scripts = driver.find_elements(By.TAG_NAME, 'script')
            for script in scripts[:10]:  # Check first 10 scripts only
                content = script.get_attribute('innerHTML') or ''
                if 'price' in content.lower() and ('¥' in content or '"price"' in content):
                    # Try to extract numeric price from JSON-like structures
                    import re
                    matches = re.findall(r'"price[^"]*":\s*"?(\d+\.?\d*)"?', content, re.IGNORECASE)
                    if matches:
                        try:
                            price_val = float(matches[0])
                            if price_val > 0:
                                print(f"        [DEBUG] Found price in page data: {price_val} CNY")
                                return price_val
                        except:
                            pass
        except Exception as e:
            if debug:
                print(f"        [DEBUG] Failed to parse page data: {e}")
    
    if debug and last_val is None:
        print(f"        [DEBUG] No price found after {attempts} attempts over {timeout_sec}s")
    return last_val

# Naming convention:
# {product-slug}_main_{index}.jpg - Main product photos (front page)
# {product-slug}_{variant-slug}_variant_{index}.jpg - Variant-specific photos (color/size)
# {product-slug}_detail_{index}.jpg - Detail photos (from description section)

def slugify(text):
    """Convert text to URL-friendly slug"""
    text = text.lower()
    text = re.sub(r'[\s_]+', '-', text)
    text = re.sub(r'[^a-z0-9\-]', '', text)
    return text

def contains_chinese(s: str) -> bool:
    if not s:
        return False
    return any('\u4e00' <= ch <= '\u9fff' for ch in s)

def get_product_title(driver):
    """Robustly extract the product title. Prefer DOM text; OCR fallback if mojibake/empty."""
    # 1) Try configured selector
    try:
        el = driver.find_element(By.CSS_SELECTOR, TITLE_SELECTOR)
        txt = (el.text or '').strip() or (el.get_attribute('title') or '').strip()
        if not txt or _seems_mojibake(txt):
            ocr_txt = _ocr_text_from_element(driver, el, lang_primary='eng', include_chi=True, psm=6)
            if ocr_txt:
                return ocr_txt
        if txt:
            return txt
    except Exception:
        pass
    # 2) Common alternatives
    alt_selectors = [
        'h1',
        'div[class*="title"] h1',
        'div[class*="title"] span',
        'div[class*="item-title"]',
    ]
    for sel in alt_selectors:
        try:
            el = driver.find_element(By.CSS_SELECTOR, sel)
            txt = (el.text or '').strip()
            if not txt or _seems_mojibake(txt):
                ocr_txt = _ocr_text_from_element(driver, el, lang_primary='eng', include_chi=True, psm=6)
                if ocr_txt:
                    return ocr_txt
            if txt:
                return txt
        except Exception:
            continue
    # 3) Fallback to document.title
    try:
        return (driver.title or '').strip()
    except Exception:
        return ''

def download_image(url, save_path):
    """Download image from URL to save_path"""
    try:
        # Handle protocol-relative URLs
        if url.startswith('//'):
            url = 'https:' + url
        
        response = requests.get(url, timeout=10, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        response.raise_for_status()
        
        with open(save_path, 'wb') as f:
            f.write(response.content)
        print(f"      -> Downloaded: {os.path.basename(save_path)}")
        return True
    except Exception as e:
        print(f"      -> Failed to download {url}: {e}")
        return False

def ensure_uniform_margin(image_path, margin_px: int = 20, background=(255, 255, 255)):
    """Add a uniform margin around the saved image to ensure consistent framing."""
    try:
        from PIL import Image
        with Image.open(image_path) as im:
            # Convert to RGB to avoid mode issues
            if im.mode in ("RGBA", "P"):
                im = im.convert("RGB")
            new_im = Image.new("RGB", (im.width + margin_px * 2, im.height + margin_px * 2), background)
            new_im.paste(im, (margin_px, margin_px))
            new_im.save(image_path, quality=92)
        return True
    except Exception as e:
        print(f"      -> Failed to add margin to {os.path.basename(image_path)}: {e}")
        return False

def stitch_images_vertically(image_paths, output_path, max_width=1200, spacing=0):
    """Stitch multiple images vertically into one long image for scrollable detail view."""
    try:
        from PIL import Image
        
        if not image_paths:
            print("      -> No images to stitch")
            return False
        
        # Load all images and resize if needed
        images = []
        for path in image_paths:
            if not os.path.exists(path):
                continue
            try:
                img = Image.open(path)
                # Convert to RGB if needed
                if img.mode in ("RGBA", "P", "LA"):
                    img = img.convert("RGB")
                # Resize if wider than max_width
                if img.width > max_width:
                    ratio = max_width / img.width
                    new_height = int(img.height * ratio)
                    img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)
                images.append(img)
            except Exception as e:
                print(f"      -> Failed to load {os.path.basename(path)}: {e}")
                continue
        
        if not images:
            print("      -> No valid images loaded for stitching")
            return False
        
        # Calculate total height
        total_height = sum(img.height for img in images) + spacing * (len(images) - 1)
        max_img_width = max(img.width for img in images)
        
        # Create the long canvas
        stitched = Image.new("RGB", (max_img_width, total_height), (255, 255, 255))
        
        # Paste images vertically
        y_offset = 0
        for img in images:
            # Center horizontally if image is narrower than canvas
            x_offset = (max_img_width - img.width) // 2
            stitched.paste(img, (x_offset, y_offset))
            y_offset += img.height + spacing
        
        # Save with high quality
        stitched.save(output_path, "JPEG", quality=95, optimize=True)
        print(f"      -> Stitched {len(images)} images into {os.path.basename(output_path)} ({max_img_width}x{total_height}px)")
        return True
        
    except ImportError:
        print("      -> PIL/Pillow not available, cannot stitch images")
        return False
    except Exception as e:
        print(f"      -> Error stitching images: {e}")
        return False

def is_video_element(element):
    """Check if an element or its URL indicates a video."""
    try:
        tag = element.tag_name.lower()
        if tag == 'video':
            return True
        
        # Check src for video indicators
        src = element.get_attribute('src') or ''
        if any(vid in src.lower() for vid in ['video', 'mp4', 'webm', '.mov', 'play', '.avi']):
            return True
        
        # Check class/id for video indicators
        class_attr = element.get_attribute('class') or ''
        id_attr = element.get_attribute('id') or ''
        if 'video' in class_attr.lower() or 'video' in id_attr.lower():
            return True
        
        return False
    except:
        return False

def capture_full_image_screenshot(driver, img_element, save_path, max_attempts=3):
    """
    Intelligently capture a full screenshot of an image element.
    Ensures the image is fully visible in the viewport with proper margins.
    """
    try:
        from PIL import Image
        import io
        
        # Get image dimensions
        img_height = img_element.size['height']
        img_width = img_element.size['width']
        
        # Get viewport dimensions
        viewport_height = driver.execute_script("return window.innerHeight;")
        
        # If image is taller than viewport, we need special handling
        if img_height > viewport_height * 0.8:
            print(f"      -> Image is tall ({img_height}px), using element screenshot...")
            # For tall images, take element screenshot directly
            img_element.screenshot(save_path)
            if os.path.exists(save_path) and os.path.getsize(save_path) > 1000:
                # Add uniform margin for consistency
                try:
                    ensure_uniform_margin(save_path)
                except:
                    pass
                return True
        
        # Otherwise, position image in center of viewport with margins
        for attempt in range(max_attempts):
            try:
                # Scroll so image is centered in viewport
                driver.execute_script("""
                    var element = arguments[0];
                    var elementRect = element.getBoundingClientRect();
                    var absoluteElementTop = elementRect.top + window.pageYOffset;
                    var middle = absoluteElementTop - (window.innerHeight / 2) + (elementRect.height / 2);
                    window.scrollTo(0, middle);
                """, img_element)
                
                time.sleep(1.5)  # Wait for scroll to complete
                
                # Verify image is fully in viewport
                is_fully_visible = driver.execute_script("""
                    var element = arguments[0];
                    var rect = element.getBoundingClientRect();
                    return (
                        rect.top >= 0 &&
                        rect.left >= 0 &&
                        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
                    );
                """, img_element)
                
                # Take screenshot
                img_element.screenshot(save_path)
                
                # Verify screenshot is valid
                if os.path.exists(save_path) and os.path.getsize(save_path) > 1000:
                    # Check if image looks complete (not cut off)
                    try:
                        with Image.open(save_path) as img:
                            img_ratio = img.width / img.height
                            # Basic validation: image should have reasonable aspect ratio
                            if 0.1 < img_ratio < 10:  # Not too thin/wide
                                # Add margin for uniform framing
                                try:
                                    ensure_uniform_margin(save_path)
                                except:
                                    pass
                                return True
                            else:
                                print(f"      -> Unusual aspect ratio, retrying...")
                    except:
                        pass
                
                # If we got here, try adjusting position
                if attempt < max_attempts - 1:
                    # Micro-adjust: scroll up or down slightly
                    adjustment = 50 if attempt == 0 else -50
                    driver.execute_script(f"window.scrollBy(0, {adjustment});")
                    time.sleep(0.5)
                    
            except Exception as e:
                if attempt == max_attempts - 1:
                    print(f"      -> Screenshot attempt {attempt+1} failed: {e}")
                continue
        
        return False
        
    except ImportError:
        # PIL not available, fall back to basic screenshot
        print(f"      -> PIL not available, using basic screenshot...")
        img_element.screenshot(save_path)
        ok = os.path.exists(save_path) and os.path.getsize(save_path) > 1000
        if ok:
            try:
                ensure_uniform_margin(save_path)
            except:
                pass
        return ok
    except Exception as e:
        print(f"      -> Error capturing full image: {e}")
        return False

def detect_and_record_video(driver, element, save_path, duration=10):
    """Detect if element is a video and record it using screenshot method"""
    try:
        # Check if it's a video element
        tag_name = element.tag_name.lower()
        
        # Check if it's a video tag
        if tag_name == 'video':
            print(f"      -> Detected <video> tag, attempting to download source...")
            try:
                # Try to get video source URL
                video_src = element.get_attribute('src')
                if not video_src:
                    # Try finding source tag inside video
                    sources = element.find_elements(By.TAG_NAME, 'source')
                    if sources:
                        video_src = sources[0].get_attribute('src')
                
                if video_src:
                    if video_src.startswith('//'):
                        video_src = 'https:' + video_src
                    
                    print(f"      -> Downloading video from: {video_src[:60]}...")
                    response = requests.get(video_src, timeout=30, stream=True, headers={
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    })
                    response.raise_for_status()
                    
                    with open(save_path, 'wb') as f:
                        for chunk in response.iter_content(chunk_size=8192):
                            f.write(chunk)
                    
                    if os.path.exists(save_path) and os.path.getsize(save_path) > 10000:
                        print(f"      -> Video downloaded: {os.path.basename(save_path)}")
                        return True
            except Exception as e:
                print(f"      -> Failed to download video source: {e}")
        
        # Check if element has video-related attributes or classes
        class_attr = element.get_attribute('class') or ''
        style_attr = element.get_attribute('style') or ''
        
        if 'video' in class_attr.lower() or 'video' in style_attr.lower():
            print(f"      -> Element appears to be video-related, taking screenshot...")
            element.screenshot(save_path)
            if os.path.exists(save_path) and os.path.getsize(save_path) > 1000:
                print(f"      -> Video screenshot captured: {os.path.basename(save_path)}")
                return True
        
        return False
        
    except Exception as e:
        print(f"      -> Error detecting/recording video: {e}")
        return False

def get_taobao_urls(file_path):
    if not os.path.exists(file_path):
        print(f"ERROR: Input file '{file_path}' not found. Please create it.")
        return []
    with open(file_path, 'r') as file:
        urls = [line.strip() for line in file if line.strip() and not line.startswith('#')]
    return urls

def scrape_product_variants(driver, url, product_index):
    """Scrape product variants and download all associated media"""
    driver.get(url)
    print(f"Scraping variants from: {url}")
    product_variants = []
    
    try:
        WebDriverWait(driver, 15).until(EC.presence_of_element_located((By.CSS_SELECTOR, TITLE_SELECTOR)))
    except TimeoutException:
        print(f" -> ERROR: Timed out. The page is likely stuck on a login/CAPTCHA page.")
        return []

    try:
        product_title = get_product_title(driver)
        print(f" -> Found product: {product_title}")
        
        slug_title = slugify(product_title)[:50]
        product_media_dir = os.path.join(MEDIA_DIR, f"product_{product_index}_{slug_title}")
        os.makedirs(product_media_dir, exist_ok=True)
        
        # Collect all media URLs with deduplication
        media_files = []
        downloaded_urls = set()  # Track URLs to avoid duplicates
        
        # STEP 1 (M2): Get HERO image - first image unless it's a video (then second)
        print("    -> Collecting hero image...")
        main_folder = os.path.join(product_media_dir, 'Main')
        os.makedirs(main_folder, exist_ok=True)
        
        main_captured = False
        
        try:
            time.sleep(2)
            gallery_images = []
            
            # Try to find gallery/thumbnail images
            try:
                thumbnail_container = driver.find_element(By.CSS_SELECTOR, THUMBNAIL_CONTAINER_SELECTOR)
                gallery_images = thumbnail_container.find_elements(By.CSS_SELECTOR, 'img')
            except:
                try:
                    image_area = driver.find_element(By.CSS_SELECTOR, PRODUCT_IMAGE_AREA_SELECTOR)
                    parent = image_area.find_element(By.XPATH, './ancestor::div[contains(@class, "pic")]')
                    gallery_images = parent.find_elements(By.CSS_SELECTOR, THUMBNAIL_IMAGE_SELECTOR)
                except:
                    gallery_images = driver.find_elements(By.CSS_SELECTOR, THUMBNAIL_IMAGE_SELECTOR)
                    gallery_images = [img for img in gallery_images if img.location['y'] < 500][:15]
            
            print(f"      -> Found {len(gallery_images)} gallery items")
            
            # M2: Hero selection - skip videos, take first valid image
            hero_index = -1
            for idx, thumb in enumerate(gallery_images[:10]):
                try:
                    # Check if this is a video (OMIT ALL VIDEOS)
                    if is_video_element(thumb):
                        print(f"      -> Item {idx+1} is video, skipping")
                        continue
                    
                    thumb_url = thumb.get_attribute('src') or ''
                    if any(vid in thumb_url.lower() for vid in ['video', 'mp4', 'webm', '.mov', 'play']):
                        print(f"      -> Item {idx+1} is video (by URL), skipping")
                        continue
                    
                    # Skip gifs and tiny images
                    if thumb_url.lower().endswith('.gif'):
                        continue
                    try:
                        size = thumb.size
                        if size['width'] < 80 or size['height'] < 80:
                            continue
                    except:
                        pass
                    
                    # This is our hero - click to load in main area
                    hero_index = idx
                    print(f"      -> Hero is item {idx+1} (first non-video image)")
                    thumb.click()
                    time.sleep(2)  # Wait for main image to load
                    break
                    
                except Exception as e:
                    continue
            
            if hero_index >= 0:
                # Capture high-quality screenshot from main display area
                try:
                    image_area = driver.find_element(By.CSS_SELECTOR, PRODUCT_IMAGE_AREA_SELECTOR)
                    # Try specific main image selector; fallback to any visible img within the area
                    try:
                        main_img = image_area.find_element(By.CSS_SELECTOR, MAIN_IMAGE_SELECTOR)
                    except Exception:
                        imgs = image_area.find_elements(By.TAG_NAME, 'img')
                        main_img = None
                        for im in imgs:
                            try:
                                sz = im.size
                                if sz and sz.get('width', 0) >= 200 and sz.get('height', 0) >= 200:
                                    main_img = im
                                    break
                            except Exception:
                                continue
                        # As last resort, screenshot the whole image area
                        if main_img is None:
                            filepath = os.path.join(main_folder, 'Main.jpg')
                            image_area.screenshot(filepath)
                            if os.path.exists(filepath) and os.path.getsize(filepath) > 5000:
                                try:
                                    ensure_uniform_margin(filepath)
                                except Exception:
                                    pass
                                downloaded_urls.add(f"hero_area_{hero_index}")
                                media_files.append({'type': 'Main', 'filename': 'Main.jpg'})
                                main_captured = True
                                print(f"      -> ✓ Hero captured via area screenshot")
                                raise StopIteration  # break out to skip further hero logic
                    
                    filepath = os.path.join(main_folder, 'Main.jpg')
                    
                    # Try download first
                    main_url = main_img.get_attribute('src') or ''
                    download_success = False
                    if main_url and not main_url.startswith('data:'):
                        download_success = download_image(main_url, filepath)
                    
                    # Fallback to HQ screenshot
                    if not download_success or not (os.path.exists(filepath) and os.path.getsize(filepath) > 5000):
                        print(f"      -> Using high-quality screenshot for hero")
                        if capture_full_image_screenshot(driver, main_img, filepath):
                            download_success = True
                    
                    if download_success and os.path.exists(filepath):
                        try:
                            ensure_uniform_margin(filepath)
                        except:
                            pass
                        downloaded_urls.add(main_url if main_url else f"hero_{hero_index}")
                        media_files.append({'type': 'Main', 'filename': 'Main.jpg'})
                        main_captured = True
                        print(f"      -> ✓ Hero captured")
                        
                except Exception as e:
                    if isinstance(e, StopIteration):
                        pass
                    else:
                        print(f"      -> Error capturing hero from main area: {e}")
            
            if not main_captured:
                print("      -> Warning: Could not capture hero image")
                    
        except Exception as e:
            print(f"    -> Error collecting hero image: {e}")
        
        # STEP 1b (M2): Capture other gallery images (Catalogue)
        print("    -> Collecting gallery images...")
        catalogue_folder = os.path.join(product_media_dir, 'Catalogue')
        os.makedirs(catalogue_folder, exist_ok=True)
        
        catalogue_count = 0
        try:
            # Capture remaining gallery images (skip videos and hero)
            for idx, thumb in enumerate(gallery_images):
                if idx == hero_index:  # Skip hero, already captured
                    continue
                
                try:
                    # Skip videos
                    if is_video_element(thumb):
                        continue
                    
                    thumb_url = thumb.get_attribute('src') or ''
                    if any(vid in thumb_url.lower() for vid in ['video', 'mp4', 'webm', '.mov', 'play']):
                        continue
                    
                    if thumb_url in downloaded_urls or not thumb_url:
                        continue
                    
                    # Skip gifs and tiny
                    if thumb_url.lower().endswith('.gif'):
                        continue
                    try:
                        size = thumb.size
                        if size['width'] < 80 or size['height'] < 80:
                            continue
                    except:
                        pass
                    
                    # Click and capture
                    thumb.click()
                    time.sleep(1.5)
                    
                    try:
                        image_area = driver.find_element(By.CSS_SELECTOR, PRODUCT_IMAGE_AREA_SELECTOR)
                        # Try to find main image; fallback to screenshotting the area
                        try:
                            main_img = image_area.find_element(By.CSS_SELECTOR, MAIN_IMAGE_SELECTOR)
                        except Exception:
                            main_img = None
                        
                        catalogue_count += 1
                        filename = f"Catalogue_{catalogue_count:02d}.jpg"
                        filepath = os.path.join(catalogue_folder, filename)
                        
                        # Try download
                        cat_url = ''
                        if main_img is not None:
                            cat_url = main_img.get_attribute('src') or ''
                        success = False
                        if cat_url and not cat_url.startswith('data:'):
                            success = download_image(cat_url, filepath)
                        
                        # Fallback screenshot
                        if not success or not (os.path.exists(filepath) and os.path.getsize(filepath) > 2000):
                            if main_img is not None:
                                if capture_full_image_screenshot(driver, main_img, filepath):
                                    success = True
                            else:
                                # Screenshot the area directly
                                image_area.screenshot(filepath)
                                if os.path.exists(filepath) and os.path.getsize(filepath) > 2000:
                                    success = True
                        
                        if success and os.path.exists(filepath):
                            try:
                                ensure_uniform_margin(filepath)
                            except:
                                pass
                            downloaded_urls.add(cat_url if cat_url else f"cat_{idx}")
                            media_files.append({'type': 'Catalogue', 'filename': filename})
                            print(f"      -> ✓ Catalogue {catalogue_count}")
                        else:
                            catalogue_count -= 1
                            
                    except Exception as e:
                        catalogue_count -= 1
                        continue
                    
                    if catalogue_count >= 10:  # Limit gallery captures
                        break
                        
                except Exception as e:
                    continue
            
            print(f"      -> Collected {catalogue_count} gallery images")
            
        except Exception as e:
            print(f"    -> Error collecting gallery: {e}")

        # STEP 2 (M3): Get DETAIL images and stitch into long image
        print("    -> Collecting detail images from product description...")
        details_folder = os.path.join(product_media_dir, 'Details')
        os.makedirs(details_folder, exist_ok=True)
        
        detail_count = 0
        detail_image_paths = []
        try:
            # Scroll gradually to load detail section and trigger lazy loading
            print("      -> Scrolling to load detail section...")
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight / 3);")
            time.sleep(2)
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight / 2);")
            time.sleep(2)
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight * 0.75);")
            time.sleep(2)
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(3)  # Extra wait at bottom to ensure all images trigger loading
            
            # Try to find detail section with more specific selectors
            detail_images = []
            try:
                # Try multiple specific detail section selectors
                detail_selectors = [
                    'div[id*="description"]',
                    'div[class*="description"]',
                    'div[id*="detail"]',
                    'div[class*="detail"]',
                    'div[class*="descContent"]',
                    'div[id*="attributes"]'
                ]
                
                detail_section = None
                for selector in detail_selectors:
                    try:
                        detail_section = driver.find_element(By.CSS_SELECTOR, selector)
                        if detail_section:
                            # Verify it's actually the detail section (not navigation)
                            section_text = detail_section.text[:100].lower()
                            if len(detail_section.find_elements(By.CSS_SELECTOR, 'img')) > 0:
                                print(f"      -> Using detail selector: {selector}")
                                break
                    except:
                        continue
                
                if detail_section:
                    detail_images = detail_section.find_elements(By.CSS_SELECTOR, 'img')
                    print(f"      -> Found {len(detail_images)} images in detail section")
            except Exception as e:
                pass
            
            # If no detail section found, don't use fallback position filter
            # This prevents capturing recommended products
            if not detail_images:
                print(f"      -> No detail section found, skipping detail images")
            
            for img in detail_images:
                try:
                    # Scroll the image into view to trigger lazy loading
                    driver.execute_script("arguments[0].scrollIntoView({behavior: 'smooth', block: 'center'});", img)
                    time.sleep(1.5)  # Increased wait for lazy load to trigger
                    
                    # Try multiple attribute names for the image URL
                    # Taobao uses various lazy loading attributes
                    img_url = (img.get_attribute('src') or 
                              img.get_attribute('data-src') or 
                              img.get_attribute('data-lazy-src') or
                              img.get_attribute('data-original'))
                    
                    # If still no src, wait more and try again
                    if not img_url or img_url.startswith('data:'):
                        time.sleep(2)
                        img_url = (img.get_attribute('src') or 
                                  img.get_attribute('data-src') or 
                                  img.get_attribute('data-lazy-src') or
                                  img.get_attribute('data-original'))
                    
                    # One more retry for stubborn images
                    if not img_url or img_url.startswith('data:'):
                        time.sleep(1.5)
                        img_url = (img.get_attribute('src') or 
                                  img.get_attribute('data-src') or 
                                  img.get_attribute('data-lazy-src') or
                                  img.get_attribute('data-original'))
                    
                    # Debug: print what we found
                    if not img_url or img_url.startswith('data:'):
                        # Try to get ANY attribute that looks like a URL
                        all_attrs = driver.execute_script(
                            """
                            var attrs = arguments[0].attributes;
                            var result = {};
                            for (var i = 0; i < attrs.length; i++) {
                                if (attrs[i].value && (attrs[i].value.includes('http') || attrs[i].value.includes('img'))) {
                                    result[attrs[i].name] = attrs[i].value;
                                }
                            }
                            return result;
                            """, img
                        )
                        if all_attrs:
                            # Use the first URL we find
                            img_url = list(all_attrs.values())[0]
                            print(f"      -> Found URL in attribute: {list(all_attrs.keys())[0]}")
                    
                    if not img_url or img_url.startswith('data:') or img_url in downloaded_urls:
                        continue
                    
                    # Skip videos
                    if any(vid in img_url.lower() for vid in ['video', 'mp4', 'webm', '.mov']):
                        continue
                    
                    # Skip small images
                    try:
                        size = img.size
                        if size['width'] < 100 or size['height'] < 100:
                            continue
                    except:
                        pass
                    
                    # Skip gifs
                    if img_url.lower().endswith('.gif'):
                        continue
                    
                    detail_count += 1
                    filename = f"Detail_{detail_count:02d}.jpg"
                    filepath = os.path.join(details_folder, filename)
                    
                    # Try to download first
                    download_success = False
                    if img_url and not img_url.startswith('data:'):
                        download_success = download_image(img_url, filepath)
                        if download_success and os.path.exists(filepath) and os.path.getsize(filepath) > 1000:
                            downloaded_urls.add(img_url)
                            media_files.append({'type': 'Details', 'filename': filename})
                            detail_image_paths.append(filepath)
                            print(f"      -> ✓ Saved {filename}")
                    
                    # If download failed, use smart screenshot capture
                    if not download_success:
                        print(f"      -> Download failed, using smart screenshot for {filename}...")
                        if capture_full_image_screenshot(driver, img, filepath):
                            if os.path.exists(filepath) and os.path.getsize(filepath) > 1000:
                                downloaded_urls.add(img_url if img_url else f"screenshot_{detail_count}")
                                media_files.append({'type': 'Details', 'filename': filename})
                                detail_image_paths.append(filepath)
                                print(f"      -> ✓ Screenshot saved: {filename}")
                        else:
                            detail_count -= 1  # Don't count failed captures
                    
                    if detail_count >= 30:  # Limit to 30 detail images
                        break
                        
                except Exception as e:
                    continue
            
            print(f"      -> Collected {detail_count} detail images")
            print(f"      -> ⚠️  Manual review needed: Delete unwanted images from Details/ folder")
            print(f"      -> Then run: python3 stitch-details.py product_{product_index}_{slug_title}")
            
            # Note: Stitching disabled - run stitch-details.py after manual filtering
            # if detail_image_paths:
            #     long_image_path = os.path.join(details_folder, 'Details_Long.jpg')
            #     print(f"      -> Stitching {len(detail_image_paths)} images into Details_Long.jpg...")
            #     if stitch_images_vertically(detail_image_paths, long_image_path, max_width=1200, spacing=0):
            #         media_files.append({'type': 'Details', 'filename': 'Details_Long.jpg'})
            #         print(f"      -> ✓ Long detail image created")
            
            driver.execute_script("window.scrollTo(0, 0);")
            time.sleep(1)
            
        except Exception as e:
            print(f"    -> Error collecting detail images: {e}")

        # STEP 3: CATALOGUE fallback - removed (already handled in step 1b)
        # Skip old catalogue logic
        catalogue_count_old = 0
        if False and detail_count == 0:
            print("    -> No details found, collecting catalogue images from variants...")
            catalogue_folder = os.path.join(product_media_dir, 'Catalogue')
            os.makedirs(catalogue_folder, exist_ok=True)
            
            try:
                # Collect all gallery images (deduplicated)
                driver.execute_script("window.scrollTo(0, 0);")
                time.sleep(1)
                
                gallery_images = []
                try:
                    thumbnail_container = driver.find_element(By.CSS_SELECTOR, THUMBNAIL_CONTAINER_SELECTOR)
                    gallery_images = thumbnail_container.find_elements(By.CSS_SELECTOR, 'img')
                except:
                    try:
                        image_area = driver.find_element(By.CSS_SELECTOR, PRODUCT_IMAGE_AREA_SELECTOR)
                        parent = image_area.find_element(By.XPATH, './ancestor::div[contains(@class, "pic")]')
                        gallery_images = parent.find_elements(By.CSS_SELECTOR, THUMBNAIL_IMAGE_SELECTOR)
                    except:
                        gallery_images = driver.find_elements(By.CSS_SELECTOR, THUMBNAIL_IMAGE_SELECTOR)
                        gallery_images = [img for img in gallery_images if img.location['y'] < 600][:15]
                
                for img in gallery_images:
                    try:
                        img_url = img.get_attribute('src')
                        if not img_url or img_url in downloaded_urls:
                            continue
                        
                        # Skip videos, gifs, small images
                        if any(vid in img_url.lower() for vid in ['video', 'mp4', 'webm', '.mov', 'play']):
                            continue
                        if img_url.lower().endswith('.gif'):
                            continue
                        
                        try:
                            size = img.size
                            if size['width'] < 100 or size['height'] < 100:
                                continue
                        except:
                            pass
                        
                        catalogue_count += 1
                        filename = f"Catalogue_{catalogue_count:02d}.jpg"
                        filepath = os.path.join(catalogue_folder, filename)
                        
                        if download_image(img_url, filepath):
                            if os.path.exists(filepath) and os.path.getsize(filepath) > 1000:
                                downloaded_urls.add(img_url)
                                media_files.append({'type': 'Catalogue', 'filename': filename})
                        
                        if catalogue_count >= 20:
                            break
                    except:
                        continue
                
                print(f"      -> Collected {catalogue_count} catalogue images")
            except Exception as e:
                print(f"    -> Error collecting catalogue images: {e}")
        else:
            print(f"    -> Skipping catalogue (found {detail_count} detail images)")

        # 3. Process variants (for CSV data only, no more image capture)
        option_buttons = driver.find_elements(By.CSS_SELECTOR, OPTION_BUTTONS_SELECTOR)
        if not option_buttons:
            print(" -> No option buttons found.")
            # Create a default entry
            row = {
                'URL': url,
                'Product Title': product_title,
                'Product Title ZH': product_title if contains_chinese(product_title) else product_title,
                'Option Name': 'Default',
                'Option Name ZH': '默认',
                'Price': 'N/A',
                'Media Folder': os.path.basename(product_media_dir),
                'Main Images': len([m for m in media_files if m['type'] == 'Main']),
                'Detail Images': len([m for m in media_files if m['type'] == 'Details']),
                'Catalogue Images': len([m for m in media_files if m['type'] == 'Catalogue'])
            }
            # Try to compute pricing for default if available on page
            price_cny_val = get_price_cny(driver)
            row['Price'] = f"¥{price_cny_val:.2f}" if price_cny_val is not None else ''
            row['Price CNY'] = round(price_cny_val, 2) if price_cny_val is not None else ''
            row['Price CAD'] = to_cad(price_cny_val) if price_cny_val is not None else ''
            row['Shipping CAD'] = FLAT_SHIPPING_CAD if price_cny_val is not None else ''
            row['Final CAD'] = round((row['Price CAD'] or 0) + (row['Shipping CAD'] or 0), 2) if price_cny_val is not None else ''

            product_variants.append(row)
            return product_variants

        print(f" -> Found {len(option_buttons)} options.")

        for i in range(len(option_buttons)):
            buttons = driver.find_elements(By.CSS_SELECTOR, OPTION_BUTTONS_SELECTOR)
            if i >= len(buttons):
                break
            button = buttons[i]

            option_name = button.text.strip()
            if not option_name:
                continue

            print(f"    -> Recording variant: {option_name}")
            try:
                # Click the variant and wait for price to update
                button.click()
                time.sleep(0.6)
                # Enable debug for ALL variants to diagnose price issues
                debug_price = True
                price_cny_val = get_price_cny_with_wait(driver, timeout_sec=6.0, debug=debug_price)
                current_price = f"¥{price_cny_val:.2f}" if price_cny_val is not None else ''
                if price_cny_val is None:
                    print(f"        ⚠️  No price found for variant: {option_name}")
                else:
                    print(f"        💰 Price: ¥{price_cny_val:.2f}")


                row = {
                    'URL': url,
                    'Product Title': product_title,
                    'Product Title ZH': product_title if contains_chinese(product_title) else product_title,
                    'Option Name': option_name,  # keep readable (translated later)
                    'Option Name ZH': option_name,  # raw option label (often Chinese)
                    'Price': current_price,
                    'Media Folder': os.path.basename(product_media_dir),
                    'Main Images': len([m for m in media_files if m['type'] == 'Main']),
                    'Detail Images': len([m for m in media_files if m['type'] == 'Details']),
                    'Catalogue Images': len([m for m in media_files if m['type'] == 'Catalogue'])
                }
                # Add computed pricing columns
                row['Price CNY'] = round(price_cny_val, 2) if price_cny_val is not None else ''
                row['Price CAD'] = to_cad(price_cny_val) if price_cny_val is not None else ''
                row['Shipping CAD'] = FLAT_SHIPPING_CAD if price_cny_val is not None else ''
                row['Final CAD'] = round((row['Price CAD'] or 0) + (row['Shipping CAD'] or 0), 2) if price_cny_val is not None else ''

                product_variants.append(row)
            except Exception as e:
                print(f"      -> Error processing variant '{option_name}': {e}")
                
    except NoSuchElementException:
        print(f" -> Error: A key selector was not found. Please re-check them.")
        return []
        
    return product_variants

def export_products_manifest(all_scraped_data):
    """Export shop-compatible products_manifest.json for integration."""
    try:
        os.makedirs(SHARED_DATA_DIR, exist_ok=True)
        manifest_path = os.path.join(SHARED_DATA_DIR, 'products_manifest.json')
        
        def _media_slug(media_folder: str) -> str:
            if not media_folder:
                return ''
            return re.sub(r'^product_\d+_', '', media_folder)

        # Group variants by URL (product)
        products_map = {}
        for row in all_scraped_data:
            url = row.get('URL', '')
            if not url:
                continue
            
            if url not in products_map:
                title_original = (row.get('Product Title', '') or '').strip()
                title_en = (row.get('Translated Title', '') or '').strip()
                # Ensure manifest title is the translated English when available
                display_title = title_en or title_original
                media_folder = row.get('Media Folder', '')
                media_slug = _media_slug(media_folder)
                
                products_map[url] = {
                    "id": slugify(display_title)[:50] or f"product-{len(products_map)+1}",
                    # Title is the translated English for shop consumption
                    "title": display_title,
                    # Keep original Chinese for reference only
                    "title_original": title_original if title_original else None,
                    "url": url,
                    "images": [],
                    "detailLongImage": None,
                    "price_cny": row.get('Price CNY'),
                    "price_cad": row.get('Price CAD'),
                    "variants": []
                }
                
                # Build image paths
                if media_slug:
                    # Hero
                    products_map[url]["images"].append(f"/images/{media_slug}-Main.jpg")
                    
                    # Catalogue images
                    catalogue_count = row.get('Catalogue Images', 0) or 0
                    for i in range(1, int(catalogue_count) + 1):
                        products_map[url]["images"].append(f"/images/{media_slug}-Catalogue_{i:02d}.jpg")
                    
                    # Long detail image
                    detail_count = row.get('Detail Images', 0) or 0
                    if detail_count > 0:
                        products_map[url]["detailLongImage"] = f"/images/{media_slug}-Details_Long.jpg"
            
            # Add variant
            option = row.get('Option Name', '')
            price_cny = row.get('Price CNY')
            price_cad = row.get('Price CAD')
            
            if option:
                products_map[url]["variants"].append({
                    "option": option,
                    "price_cny": price_cny,
                    "price_cad": price_cad
                })
        
        # Create manifest
        manifest = {
            "last_updated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "products": list(products_map.values())
        }
        
        with open(manifest_path, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, ensure_ascii=False, indent=2)
        
        print(f"\n✅ Exported products manifest: {manifest_path}")
        print(f"   Total products: {len(products_map)}")
        return True
        
    except Exception as e:
        print(f"\n❌ Error exporting manifest: {e}")
        return False

def main():
    os.makedirs(MEDIA_DIR, exist_ok=True)
    os.makedirs(SCREENSHOTS_DIR, exist_ok=True)
    
    TAOBAO_URLS = get_taobao_urls(LINK_FILE)
    if not TAOBAO_URLS:
        return

    # M1: Simplified startup - always use Selenium Manager with persistent profile
    options = webdriver.ChromeOptions()
    options.page_load_strategy = 'normal'
    options.add_argument('--disable-blink-features=AutomationControlled')
    options.add_argument(f"--user-data-dir={SELENIUM_PROFILE_DIR}")
    options.add_argument('--start-maximized')
    options.add_argument('--disable-popup-blocking')
    options.add_argument('--no-first-run')
    options.add_argument('--disable-extensions')
    options.add_argument('--window-size=1920,1080')  # High-res for better screenshots
    
    print("🚀 Starting Chrome with persistent profile (Selenium Manager)...")
    print(f"   Profile: {SELENIUM_PROFILE_DIR}")
    
    driver = webdriver.Chrome(options=options)
    driver.set_page_load_timeout(60)
    
    print("✓ Chrome started successfully")
    print(f"   Note: Session persists in {SELENIUM_PROFILE_DIR}")
    all_scraped_data = []
    
    # Lightweight rule-based translations will be applied later without external API

    for idx, link in enumerate(TAOBAO_URLS, 1):
        print(f"\n{'='*60}")
        print(f"Processing product {idx}/{len(TAOBAO_URLS)}")
        print(f"{'='*60}")
        try:
            # Navigate directly in the same window instead of opening new tabs to avoid session issues
            variants = scrape_product_variants(driver, link, idx)
            all_scraped_data.extend(variants)
        except Exception as e:
            print(f"ERROR processing {link}: {e}")
        time.sleep(2)

    if not all_scraped_data:
        print("\nNo data was scraped. Please check your URLs and CSS selectors.")
        return

    print("\nTranslating titles...")
    # Apply lightweight translations for titles and variants (rule-based)
    def _clean_text(s: str) -> str:
        return (s or '').strip()

    def translate_title_simple(zh: str) -> str:
        if not zh:
            return ''
        # Common tactical gear term mappings
        mapping = [
            (r"战术背心", "Tactical Vest"), (r"通用型", "Universal"),
            (r"MOLLE系统|MOLLE 系统", "MOLLE System"),
            (r"手机导航面板", "Phone Navigation Panel"),
            (r"胸口PDA包|胸包|胸前包", "Chest Bag"),
            (r"多功能", "Multi-Function"), (r"户外", "Outdoor"), (r"配件", "Accessories"),
            (r"战术耳机", "Tactical Headset"), (r"转接器", "Adapter"),
            (r"民用", "Civilian"), (r"PTT按键", "PTT Button"), (r"发射", "Transmit"),
            (r"对讲机", "Radio"), (r"建伍", "Kenwood"), (r"接口", "Interface"),
            (r"支持", "Compatible"), (r"手枪箱", "Pistol Case"), (r"枪箱", "Gun Case"),
            (r"手雷", "Grenade"), (r"玩具", "Toy"), (r"可爆炸水弹", "Water Bomb"),
            (r"弹射烟雾", "Smoke Ejection"), (r"手榴弹模型", "Grenade Model"),
            (r"男孩生日礼物", "Boys Birthday Gift"), (r"儿童", "Kids"),
            (r"头盔", "Helmet"), (r"护目镜", "Goggles"), (r"手套", "Gloves"),
            (r"腰带", "Belt"), (r"水壶", "Canteen"), (r"弹匣", "Magazine"),
        ]
        out = zh
        for pat, rep in mapping:
            out = re.sub(pat, rep, out)
        # Remove decorative symbols/brackets
        out = re.sub(r"[【】\[\]（）()]+", " ", out)
        out = re.sub(r"\s+", " ", out).strip()
        # Compact phrasing - keep only main phrases and remove duplicated words
        parts = out.split()
        seen = set()
        compact = []
        for w in parts:
            lw = w.lower()
            if lw not in seen:
                compact.append(w)
                seen.add(lw)
        result = " ".join(compact)[:120]
        # If still mostly Chinese, return original
        if len([c for c in result if '\u4e00' <= c <= '\u9fff']) > len(result) * 0.5:
            return zh
        return result

    def translate_variant_simple(zh: str) -> str:
        if not zh:
            return ''
        s = re.sub(r"[【】\[\]（）()]", " ", zh)  # remove decorative brackets
        s = re.sub(r"品牌|考度拉|科杜拉|尼龙|原厂|正品|仅支持|伯莱塔|SIG印字|M9A3印字|M9A4印字|加大款|小号|无LOGO|通用款|专用|空箱|带海绵内衬", " ", s)  # remove brand/filler
        # Known color/pattern mappings
        term_map = {
            '黑色': 'Black', '狼灰色': 'Wolf Grey', '灰色': 'Grey', '灰': 'Grey',
            '游骑兵绿色': 'Ranger Green', '军绿色': 'Army Green', '绿色': 'Green',
            '狼棕色': 'Coyote Brown', '棕色': 'Brown', '卡其': 'Khaki',
            '白色': 'White', '红色': 'Red', '蓝色': 'Blue', '黄色': 'Yellow',
            '暗夜迷彩': 'Black Camouflage Pattern', '迷彩': 'Camouflage', '丛林迷彩': 'Jungle Camouflage',
            '沙色': 'Sand', '土狼棕': 'Coyote Brown', '土狼': 'Coyote',
            '建伍': 'Kenwood', '摩托罗拉': 'Motorola', '单插': 'Single', '双插': 'Dual',
        }
        # Split into chunks and translate
        chunks = re.split(r"[\s,/，、]+", s)
        out_chunks = []
        for ch in chunks:
            if not ch:
                continue
            # Keep codes like MC/BK/RG/CB/WG/BCP if present
            code = None
            m = re.search(r"\b(MC|CP|BK|RG|CB|WG|BCP|M1|M2|KEN)\b", ch, flags=re.IGNORECASE)
            if m:
                code = m.group(1).upper()
            # Replace known Chinese terms
            trans = ch
            for k, v in term_map.items():
                trans = trans.replace(k, v)
            # If result still Chinese, drop it unless it has code
            if re.search(r"[\u4e00-\u9fff]", trans):
                if code:
                    trans = code
                else:
                    continue
            # Normalize like "MC Camouflage"
            if code and 'Camouflage' in trans and code not in trans:
                trans = f"{code} Camouflage"
            # Skip pure English filler words
            if trans.lower() in ['the', 'of', 'and', 'or', 'only', 'with', 'for']:
                continue
            out_chunks.append(trans)
        # Join with separator for combos
        result = " / ".join(dict.fromkeys([c.strip() for c in out_chunks if c.strip()]))
        # If empty after translation, return simplified original
        if not result:
            result = re.sub(r"[【】\[\]（）()]", "", zh).strip()
        return result

    # Cache title translations by Chinese title
    title_cache = {}
    print("\n🔤 Translating titles and variant names...")
    for idx, row in enumerate(all_scraped_data):
        zh_title = _clean_text(row.get('Product Title'))
        if zh_title not in title_cache:
            en_title = translate_title_simple(zh_title)
            title_cache[zh_title] = en_title
            # Show first 3 translations for debugging
            if len(title_cache) <= 3:
                print(f"  Title {len(title_cache)}: {zh_title[:60]}... → {en_title[:60]}...")
        row['Translated Title'] = title_cache[zh_title]
        # Translate variant option name
        zh_opt = _clean_text(row.get('Option Name'))
        en_opt = translate_variant_simple(zh_opt)
        row['Option Name'] = en_opt
        # Show first 5 variant translations for debugging
        if idx < 5:
            print(f"  Variant {idx+1}: {zh_opt} → {en_opt}")

    fieldnames = [
        'URL',
        'Product Title',
        'Product Title ZH',
        'Translated Title',
        'Option Name',
        'Option Name ZH',
        'Price',
        'Price CNY',
        'Price CAD',
        'Shipping CAD',
        'Final CAD',
        'Media Folder',
        'Main Images',
        'Detail Images',
        'Catalogue Images'
    ]
    with open(CSV_OUTPUT_FILE, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_scraped_data)

    print(f"\n✅ Scraping complete. {len(all_scraped_data)} variants saved to {CSV_OUTPUT_FILE}")
    print(f"📁 Media files saved to {MEDIA_DIR}")
    print("\n📂 Folder structure:")
    print("  - Main/Main.jpg = Hero image (first non-video image)")
    print("  - Catalogue/Catalogue_XX.jpg = Other gallery images")
    print("  - Details/Detail_XX.jpg = Individual detail images")
    print("  - Details/Details_Long.jpg = Stitched long scrollable image")
    
    # M5: Export products manifest for shop integration
    export_products_manifest(all_scraped_data)

if __name__ == "__main__":
    # Allow a login-setup mode to help users log into Taobao once and persist session
    if '--login-setup' in sys.argv:
        print("\nLogin setup mode: launching Selenium-managed Chrome with a persistent profile...")
        print(f"Profile directory: {SELENIUM_PROFILE_DIR}")
        os.makedirs(SELENIUM_PROFILE_DIR, exist_ok=True)

        # Minimal options for a normal visible session with persistent profile
        login_options = webdriver.ChromeOptions()
        login_options.page_load_strategy = 'normal'
        login_options.add_argument('--disable-blink-features=AutomationControlled')
        login_options.add_argument(f"--user-data-dir={SELENIUM_PROFILE_DIR}")
        login_options.add_argument('--start-maximized')
        login_options.add_argument('--disable-popup-blocking')
        login_options.add_argument('--no-first-run')
        login_options.add_argument('--disable-extensions')
        
        driver = webdriver.Chrome(options=login_options)
        mode = 'Selenium Manager'
        try:
            print(f"Launched Chrome via: {mode}")
            # Open Taobao homepage/login
            driver.get('https://www.taobao.com/')
            print("\nPlease complete Taobao login in the opened browser window (QR code or password).")
            print("After you see you're logged in (e.g., user avatar visible), return here and press Enter to save cookies...")
            try:
                input()
            except EOFError:
                # In case the environment doesn't support input, wait 60 seconds
                print("No console input available; waiting 60 seconds before saving cookies...")
                time.sleep(60)
            # Save cookies as a backup (profile will also persist)
            cookies = driver.get_cookies()
            cookie_path = os.path.join(SCRIPT_DIR, 'taobao_cookies.json')
            with open(cookie_path, 'w', encoding='utf-8') as f:
                json.dump(cookies, f, ensure_ascii=False, indent=2)
            print(f"✅ Saved cookies backup to {cookie_path}")
            print(f"✅ Persistent Chrome profile will remain at: {SELENIUM_PROFILE_DIR}")
        finally:
            try:
                driver.quit()
            except Exception:
                pass
        sys.exit(0)
    else:
        main()
