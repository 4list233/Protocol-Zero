"""
Price Resolver Module for Protocol Zero Taobao Scraper

This module provides tiered price extraction:
  Tier 1: Extract from SKU map data (already parsed by variant_engine)
  Tier 2: DOM extraction after selecting SKU
  Tier 3: OCR on cropped price element (last resort)

The resolver prioritizes accuracy and reliability over speed.
"""

import re
import logging
from dataclasses import dataclass
from typing import Optional, Tuple, List
from decimal import Decimal, InvalidOperation

from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class PriceResult:
    """Result from price resolution attempt."""
    price: Optional[float]  # None if extraction failed
    currency: str  # Default to CNY (¥)
    confidence: float  # 0.0 to 1.0
    method: str  # 'sku_map', 'dom', 'ocr', 'fallback'
    raw_text: Optional[str] = None  # Original price text for debugging


# Common price selectors on Taobao/Tmall pages
# Order matters - more specific selectors first
PRICE_SELECTORS = [
    # CRITICAL: Selected variant price (when you click a variant, price updates here)
    '[class*="highlightPrice"]',
    '[class*="normalPrice"]',

    # Main price display area (most common)
    'span.Price--priceInt--ZlsSi_M',
    'span[class*="Price--priceInt"]',
    'span[class*="priceInt"]',

    # Price container with int/decimal parts
    'div.Price--priceWrap--Md7ViEX span',
    'div[class*="priceWrap"] span',

    # Tmall-specific selectors
    '.tm-price',
    '.tm-promo-price',
    'span[class*="tm-price"]',

    # SKU-selected price display (legacy)
    'span.tb-rmb-num',
    'em.tb-rmb-num',

    # Alternative price selectors
    'div.tb-property-container span.price',
    'span[data-spm*="price"]',

    # Generic price class (last resort)
    '[class*="Price"]',
]

# Regex patterns for extracting price values
PRICE_PATTERNS = [
    # ¥123.45 or ￥123.45
    r'[¥￥]\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)',
    # 123.45元
    r'(\d+(?:,\d{3})*(?:\.\d{1,2})?)\s*元',
    # Plain number with optional decimal
    r'(\d+(?:,\d{3})*(?:\.\d{1,2})?)',
]


class PriceResolver:
    """
    Multi-tier price resolver for Taobao/Tmall products.
    
    Usage:
        resolver = PriceResolver()
        result = resolver.resolve_price_for_selection(driver)
        if result.price:
            print(f"Price: ¥{result.price:.2f}")
    """
    
    def __init__(self, timeout: float = 5.0, disable_ocr: bool = False):
        """
        Initialize the price resolver.
        
        Args:
            timeout: Maximum wait time for DOM elements in seconds
            disable_ocr: If True, skip OCR tier even if dependencies are available
        """
        self.timeout = timeout
        self.disable_ocr = disable_ocr
    
    def resolve_price_for_selection(
        self, 
        driver: WebDriver, 
        sku_price: Optional[float] = None
    ) -> PriceResult:
        """
        Resolve the price for the currently selected SKU.
        
        This is the main entry point. It uses a tiered approach:
        1. Use SKU map price if provided (highest confidence)
        2. Extract from DOM elements
        3. Fall back to OCR if needed
        
        Args:
            driver: Selenium WebDriver with page loaded
            sku_price: Pre-extracted price from SKU map (if available)
            
        Returns:
            PriceResult with extracted price and metadata
        """
        # Tier 1: Use SKU map price if available
        if sku_price is not None and sku_price > 0:
            logger.info(f"Using SKU map price: {sku_price}")
            return PriceResult(
                price=sku_price,
                currency='CNY',
                confidence=0.95,
                method='sku_map',
                raw_text=str(sku_price)
            )
        
        # Tier 2: Try DOM extraction
        dom_result = self._extract_from_dom(driver)
        if dom_result.price is not None:
            logger.info(f"DOM extraction successful: {dom_result.price}")
            return dom_result
        
        # Tier 3: Try OCR on price element (if not disabled)
        if not self.disable_ocr:
            ocr_result = self._extract_with_ocr(driver)
            if ocr_result.price is not None:
                logger.info(f"OCR extraction successful: {ocr_result.price}")
                return ocr_result
        else:
            logger.debug("OCR tier disabled, skipping")
        
        # All methods failed
        logger.warning("All price extraction methods failed")
        return PriceResult(
            price=None,
            currency='CNY',
            confidence=0.0,
            method='failed',
            raw_text=None
        )
    
    def _extract_from_dom(self, driver: WebDriver) -> PriceResult:
        """
        Tier 2: Extract price from DOM elements.

        Tries JavaScript execution first (most reliable), then CSS selectors.
        """
        # JavaScript extraction scripts (more reliable than CSS selectors)
        js_scripts = [
            # Script 1: highlightPrice (selected variant price)
            """
            var el = document.querySelector('[class*="highlightPrice"]');
            if (el) {
                var text = el.textContent;
                var nums = text.match(/[0-9]+\\.?[0-9]*/g);
                if (nums && nums.length > 0) {
                    var num = parseFloat(nums[0]);
                    if (num >= 5 && num <= 5000) return num;
                }
            }
            return 0;
            """,
            # Script 2: normalPrice
            """
            var el = document.querySelector('[class*="normalPrice"]');
            if (el) {
                var text = el.textContent;
                var nums = text.match(/[0-9]+\\.?[0-9]*/g);
                if (nums && nums.length > 0) {
                    var num = parseFloat(nums[0]);
                    if (num >= 5 && num <= 5000) return num;
                }
            }
            return 0;
            """,
            # Script 3: priceInt
            """
            var el = document.querySelector('[class*="priceInt"]');
            if (el) {
                var text = el.textContent;
                var nums = text.match(/[0-9]+/g);
                if (nums && nums.length > 0) {
                    var num = parseFloat(nums[0]);
                    if (num >= 5 && num <= 5000) return num;
                }
            }
            return 0;
            """,
            # Script 4: Tmall price
            """
            var el = document.querySelector('.tm-price, [class*="tm-price"]');
            if (el) {
                var text = el.textContent;
                var nums = text.match(/[0-9]+\\.?[0-9]*/g);
                if (nums && nums.length > 0) {
                    var num = parseFloat(nums[0]);
                    if (num >= 5 && num <= 5000) return num;
                }
            }
            return 0;
            """,
            # Script 5: Generic Price elements
            """
            var els = document.querySelectorAll('[class*="Price"], [class*="price"]');
            for (var i = 0; i < els.length; i++) {
                var text = els[i].textContent;
                if (text.indexOf('¥') >= 0 || text.match(/^[0-9]+\\.?[0-9]*$/)) {
                    var nums = text.match(/[0-9]+\\.?[0-9]*/g);
                    if (nums && nums.length > 0) {
                        var num = parseFloat(nums[0]);
                        if (num >= 5 && num <= 5000) return num;
                    }
                }
            }
            return 0;
            """,
        ]

        # Try JavaScript execution first
        for script in js_scripts:
            try:
                price = driver.execute_script(script)
                if price and price > 0:
                    return PriceResult(
                        price=float(price),
                        currency='CNY',
                        confidence=0.85,
                        method='dom_js',
                        raw_text=str(price)
                    )
            except Exception as e:
                logger.debug(f"JS script failed: {e}")
                continue

        # Fallback to CSS selectors
        for selector in PRICE_SELECTORS:
            try:
                elements = driver.find_elements(By.CSS_SELECTOR, selector)
                for element in elements:
                    text = element.text.strip()
                    if not text:
                        continue

                    # Try to parse the price
                    price = self._parse_price_text(text)
                    if price is not None and price > 0:
                        return PriceResult(
                            price=price,
                            currency='CNY',
                            confidence=0.8,
                            method='dom',
                            raw_text=text
                        )
            except Exception as e:
                logger.debug(f"Selector {selector} failed: {e}")
                continue

        # Try extracting from page source with regex
        try:
            page_source = driver.page_source
            price = self._extract_price_from_html(page_source)
            if price is not None and price > 0:
                return PriceResult(
                    price=price,
                    currency='CNY',
                    confidence=0.6,
                    method='dom_regex',
                    raw_text=None
                )
        except Exception as e:
            logger.debug(f"Page source extraction failed: {e}")
        
        return PriceResult(
            price=None,
            currency='CNY',
            confidence=0.0,
            method='dom',
            raw_text=None
        )
    
    def _extract_with_ocr(self, driver: WebDriver) -> PriceResult:
        """
        Tier 3: Extract price using OCR on cropped price element.
        
        This is the fallback method when DOM extraction fails.
        Requires pytesseract and PIL to be installed.
        """
        try:
            # Try to find and screenshot the price element
            for selector in PRICE_SELECTORS[:5]:  # Try main selectors only
                try:
                    element = driver.find_element(By.CSS_SELECTOR, selector)
                    if not element.is_displayed():
                        continue
                    
                    # Take screenshot of the element
                    screenshot_png = element.screenshot_as_png
                    
                    # Import PIL and pytesseract here to avoid hard dependency
                    try:
                        from PIL import Image
                        import pytesseract
                        import io
                        
                        # Load image from screenshot
                        image = Image.open(io.BytesIO(screenshot_png))
                        
                        # Preprocess: convert to grayscale, increase contrast
                        image = image.convert('L')
                        
                        # Run OCR with Chinese language support
                        ocr_text = pytesseract.image_to_string(
                            image, 
                            lang='chi_sim+eng',
                            config='--psm 7'  # Single text line mode
                        )
                        
                        # Parse the OCR result
                        price = self._parse_price_text(ocr_text)
                        if price is not None and price > 0:
                            return PriceResult(
                                price=price,
                                currency='CNY',
                                confidence=0.5,
                                method='ocr',
                                raw_text=ocr_text
                            )
                    except ImportError:
                        logger.warning("pytesseract or PIL not installed, skipping OCR")
                        break
                        
                except NoSuchElementException:
                    continue
                except Exception as e:
                    logger.debug(f"OCR failed for selector {selector}: {e}")
                    continue
                    
        except Exception as e:
            logger.debug(f"OCR extraction failed: {e}")
        
        return PriceResult(
            price=None,
            currency='CNY',
            confidence=0.0,
            method='ocr',
            raw_text=None
        )
    
    def _parse_price_text(self, text: str) -> Optional[float]:
        """
        Parse price from text string.
        
        Handles various formats:
        - ¥123.45
        - 123.45元
        - 123,456.78
        - Plain numbers
        """
        if not text:
            return None
        
        # Clean up the text
        text = text.strip()
        
        for pattern in PRICE_PATTERNS:
            match = re.search(pattern, text)
            if match:
                price_str = match.group(1)
                # Remove commas from number
                price_str = price_str.replace(',', '')
                try:
                    price = float(price_str)
                    # Sanity check: prices should be reasonable
                    if 0 < price < 1000000:
                        return price
                except (ValueError, InvalidOperation):
                    continue
        
        return None
    
    def _extract_price_from_html(self, html: str) -> Optional[float]:
        """
        Extract price from HTML source using regex.
        
        Looks for common patterns in Taobao/Tmall page source.
        """
        # Patterns for price in JSON/JavaScript
        patterns = [
            # "price":"123.45" or "price":123.45
            r'"price"\s*:\s*["\']?(\d+(?:\.\d{1,2})?)["\']?',
            # "promotionPrice":"123.45"
            r'"promotionPrice"\s*:\s*["\']?(\d+(?:\.\d{1,2})?)["\']?',
            # "originalPrice":"123.45"
            r'"originalPrice"\s*:\s*["\']?(\d+(?:\.\d{1,2})?)["\']?',
            # data-price="123.45"
            r'data-price\s*=\s*["\'](\d+(?:\.\d{1,2})?)["\']',
        ]
        
        prices = []
        for pattern in patterns:
            matches = re.findall(pattern, html)
            for match in matches:
                try:
                    price = float(match)
                    if 0 < price < 1000000:
                        prices.append(price)
                except (ValueError, InvalidOperation):
                    continue
        
        # Return the most common price (likely the displayed one)
        if prices:
            from collections import Counter
            price_counts = Counter(prices)
            most_common = price_counts.most_common(1)
            if most_common:
                return most_common[0][0]
        
        return None
    
    def resolve_price_range(
        self, 
        driver: WebDriver,
        sku_prices: Optional[List[float]] = None
    ) -> Tuple[Optional[float], Optional[float]]:
        """
        Get the price range for a product (min and max prices).
        
        Args:
            driver: Selenium WebDriver with page loaded
            sku_prices: List of prices from SKU map (if available)
            
        Returns:
            Tuple of (min_price, max_price), or (None, None) if extraction failed
        """
        if sku_prices:
            valid_prices = [p for p in sku_prices if p is not None and p > 0]
            if valid_prices:
                return (min(valid_prices), max(valid_prices))
        
        # Try to extract price range from DOM
        try:
            page_source = driver.page_source
            
            # Look for price range patterns
            range_patterns = [
                # ¥123-456 or ¥123~456
                r'[¥￥]\s*(\d+(?:\.\d{1,2})?)\s*[-~]\s*(\d+(?:\.\d{1,2})?)',
                # "priceRange":["123","456"]
                r'"priceRange"\s*:\s*\[\s*["\']?(\d+(?:\.\d{1,2})?)["\']?\s*,\s*["\']?(\d+(?:\.\d{1,2})?)["\']?\s*\]',
            ]
            
            for pattern in range_patterns:
                match = re.search(pattern, page_source)
                if match:
                    try:
                        min_price = float(match.group(1))
                        max_price = float(match.group(2))
                        if 0 < min_price <= max_price < 1000000:
                            return (min_price, max_price)
                    except (ValueError, IndexError):
                        continue
                        
        except Exception as e:
            logger.debug(f"Price range extraction failed: {e}")
        
        return (None, None)


def resolve_price_for_selection(driver: WebDriver, sku_price: Optional[float] = None) -> float:
    """
    Convenience function to resolve price for current selection.
    
    This is the main public API for the price resolver.
    Returns 0.0 if price extraction fails.
    
    Args:
        driver: Selenium WebDriver with page loaded
        sku_price: Pre-extracted price from SKU map (if available)
        
    Returns:
        Extracted price as float, or 0.0 if extraction failed
    """
    resolver = PriceResolver()
    result = resolver.resolve_price_for_selection(driver, sku_price)
    return result.price if result.price is not None else 0.0


# For testing
if __name__ == '__main__':
    # Example usage
    print("Price Resolver Module")
    print("=" * 40)
    print("This module provides tiered price extraction:")
    print("  Tier 1: SKU map data (highest confidence)")
    print("  Tier 2: DOM element extraction")
    print("  Tier 3: OCR fallback (requires pytesseract)")
    print()
    print("Usage:")
    print("  from price_resolver import resolve_price_for_selection")
    print("  price = resolve_price_for_selection(driver)")
    print("  # or with SKU map price:")
    print("  price = resolve_price_for_selection(driver, sku_price=123.45)")
