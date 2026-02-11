# Scraper Technical Specifications

**Version:** 2.0  
**Date:** January 25, 2026  
**Target System:** Taobao → Supabase → Vercel

---

## 📖 Table of Contents

1. [Overview](#overview)
2. [Feature Requirements](#feature-requirements)
3. [Technical Architecture](#technical-architecture)
4. [API Specifications](#api-specifications)
5. [Image Processing Pipeline](#image-processing-pipeline)
6. [Translation System](#translation-system)
7. [Pricing Calculations](#pricing-calculations)
8. [Error Handling](#error-handling)
9. [Testing Requirements](#testing-requirements)

---

## 🎯 Overview

The scraper is a Python-based automation system that extracts product data from Taobao.com, processes images, translates content, calculates pricing, and seeds the data into a PostgreSQL database (Supabase) for consumption by the Next.js frontend.

### Key Objectives
- **Reliability:** Handle Taobao's dynamic content and anti-bot measures
- **Accuracy:** Extract all product variants with correct pricing
- **Efficiency:** Process 50+ products per hour
- **Maintainability:** Modular code, easy to update when Taobao changes

---

## 🔧 Feature Requirements

### 1. Scraping from Taobao

#### 1.1 Authentication
- **Persistent Login:** Use Chrome profile to maintain Taobao login session
- **Setup Command:** `python scraper.py --login-setup` (one-time)
- **Session Validation:** Detect when re-login is needed
- **Captcha Handling:** Pause for manual intervention if captcha appears

#### 1.2 URL Input
- **Input File:** `taobao_links.txt` (one URL per line)
- **URL Formats Supported:**
  - `https://item.taobao.com/item.htm?id=123456789`
  - `https://detail.tmall.com/item.htm?id=123456789`
  - `https://detail.tmall.hk/item.htm?id=123456789`
- **Validation:** Skip invalid URLs, log errors
- **Resume Capability:** Track completed URLs, skip on re-run

#### 1.3 Data Extraction

**Required Fields:**
```python
{
  "url": str,                  # Source URL
  "title_zh": str,             # Chinese title
  "price_cny": float,          # Base price (CNY)
  "main_images": List[str],    # Gallery images (URLs)
  "detail_images": List[str],  # Product detail images (URLs)
  "variants": List[Dict],      # See variant structure below
  "seller_id": str,            # Shop identifier
  "item_id": str,              # Product ID from URL
  "scraped_at": datetime,      # Timestamp
}
```

**Variant Structure:**
```python
{
  "option_type_1": str,        # e.g., "Color", "颜色分类"
  "option_value_1": str,       # e.g., "Black", "黑色"
  "option_type_2": str,        # e.g., "Size", "尺码" (optional)
  "option_value_2": str,       # e.g., "M", "中号" (optional)
  "price_cny": float,          # Variant-specific price
  "sku": str,                  # Taobao SKU ID
  "image_url": str,            # Variant thumbnail
  "stock": int,                # Availability (if visible)
}
```

#### 1.4 Selenium Configuration
```python
CHROME_OPTIONS = {
    "user_data_dir": "./chrome_profile_selenium",
    "headless": False,  # Must be False for login
    "window_size": "1920,1080",
    "disable_blink_features": "AutomationControlled",
    "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
}

WAIT_TIMES = {
    "page_load": 15,      # Wait for page load
    "click_delay": 0.6,   # Delay between clicks
    "image_load": 5,      # Wait for images to load
    "scroll_pause": 1,    # Pause during scrolling
}
```

#### 1.5 Extraction Strategy

**Tiered Approach:**
1. **Tier 1 (Best):** Parse embedded JSON in page source
   - Look for `g_config.idata` or similar data objects
   - Extract SKU map, pricing, variants
   
2. **Tier 2:** Intercept XHR/Network requests
   - Monitor network traffic for API calls
   - Extract variant data from AJAX responses
   
3. **Tier 3 (Fallback):** Selenium click enumeration
   - Click each variant option
   - Record price/image changes
   - Combine all permutations

**Example Tier 1 Code:**
```python
def extract_sku_data_from_source(driver):
    """Parse embedded JSON in page source"""
    html = driver.page_source
    
    # Look for data object
    match = re.search(r'g_config\.idata\s*=\s*(\{.*?\});', html, re.DOTALL)
    if match:
        try:
            data = json.loads(match.group(1))
            return parse_sku_map(data)
        except json.JSONDecodeError:
            pass
    
    return None  # Fall back to Tier 2
```

---

### 2. Image Processing

#### 2.1 Image Download
- **Download Strategy:** Direct URL download (primary), screenshot (fallback)
- **Supported Formats:** JPG, PNG, WebP
- **Max Size:** 10MB per image
- **Timeout:** 30 seconds per image
- **Retry Logic:** 3 attempts with exponential backoff

#### 2.2 Image Categories

**Main Images (Gallery):**
- Primary product photos shown on listing page
- Used for product carousel
- Naming: `{product-slug}_main_{index}.jpg`

**Variant Images:**
- Specific to each color/style option
- Shown when variant selected
- Naming: `{product-slug}_{variant-slug}_variant.jpg`

**Detail Images:**
- Product feature explanations
- Material close-ups, size charts
- Naming: `{product-slug}_detail_{index}.jpg`

#### 2.3 Image Stitching

**Purpose:** Create comparison grids of all color variants

**Requirements:**
- Input: List of variant images (same product, different colors)
- Output: Single stitched image with all variants side-by-side
- Max Columns: 4 variants per row
- Padding: 10px between images
- Background: White
- Format: JPG (80% quality)
- Output Name: `{product-slug}_stitch.jpg`

**Example Implementation:**
```python
from PIL import Image

def stitch_variant_images(image_paths: List[str], output_path: str):
    """Combine variant images into grid"""
    images = [Image.open(path) for path in image_paths]
    
    # Resize to uniform height
    target_height = 600
    images = [img.resize((int(img.width * target_height / img.height), target_height)) 
              for img in images]
    
    # Calculate grid dimensions
    cols = min(4, len(images))
    rows = (len(images) + cols - 1) // cols
    
    # Create canvas
    padding = 10
    width = sum(img.width for img in images[:cols]) + padding * (cols + 1)
    height = target_height * rows + padding * (rows + 1)
    canvas = Image.new('RGB', (width, height), 'white')
    
    # Paste images
    x, y = padding, padding
    for i, img in enumerate(images):
        if i > 0 and i % cols == 0:
            x = padding
            y += target_height + padding
        canvas.paste(img, (x, y))
        x += img.width + padding
    
    canvas.save(output_path, 'JPEG', quality=80)
```

#### 2.4 Image Upload (Supabase Storage)

**Bucket Configuration:**
```typescript
// Supabase bucket: "product-images"
// Structure:
// - products/{product-id}/main/{image-name}
// - products/{product-id}/variants/{variant-name}.jpg
// - products/{product-id}/details/{image-name}
```

**Upload Function:**
```python
def upload_to_supabase(local_path: str, remote_path: str) -> str:
    """
    Upload image to Supabase Storage
    Returns public URL
    """
    from supabase import create_client
    
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    with open(local_path, 'rb') as f:
        response = supabase.storage.from_('product-images').upload(
            remote_path,
            f,
            file_options={"content-type": "image/jpeg"}
        )
    
    # Get public URL
    public_url = supabase.storage.from_('product-images').get_public_url(remote_path)
    return public_url
```

#### 2.5 Unwanted Image Deletion

**Manual Review Process:**
1. After scraping, review `ai_scraper_output/media/{product-id}/`
2. Delete unwanted images (duplicates, watermarks, non-product images)
3. Keep only relevant images
4. Script will upload only remaining images

**Automated Detection (Future):**
- Detect watermarks using OCR
- Identify duplicate images via perceptual hashing
- Filter out size charts (low text-to-image ratio)

---

### 3. Translation System

#### 3.1 Google Gemini API

**Model:** `gemini-1.5-flash` (fast, cost-effective)

**Prompt Template:**
```python
TRANSLATION_PROMPT = """
You are a tactical military gear expert translator. Translate the following Chinese product title to English.

Requirements:
- Use tactical/military terminology where appropriate
- Keep it concise (5-10 words)
- Maintain brand names as-is
- Use title case

Chinese: {title_zh}

Examples:
战术背心 → Tactical Plate Carrier
特种兵手套 → Special Forces Tactical Gloves
户外迷彩背包 → Outdoor Camo Backpack

English:
"""
```

**API Call:**
```python
import google.generativeai as genai

def translate_title(title_zh: str) -> str:
    """Translate Chinese title using Gemini"""
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-1.5-flash')
    
    prompt = TRANSLATION_PROMPT.format(title_zh=title_zh)
    response = model.generate_content(prompt)
    
    return response.text.strip()
```

#### 3.2 Tactical Naming Rules

**Pattern Recognition:**
- "战术" (tactical) → "Tactical"
- "军用" (military) → "Military"
- "特种兵" (special forces) → "Special Forces"
- "突击" (assault) → "Assault"
- "作战" (combat) → "Combat"
- "户外" (outdoor) → "Outdoor"
- "迷彩" (camo) → "Camo"

**Product Type Mapping:**
```python
PRODUCT_TYPE_MAP = {
    "背心": "Vest",
    "背包": "Backpack",
    "手套": "Gloves",
    "护膝": "Knee Pads",
    "护肘": "Elbow Pads",
    "头盔": "Helmet",
    "护目镜": "Goggles",
    "战术靴": "Tactical Boots",
    "腰带": "Belt",
    "弹匣包": "Magazine Pouch",
    "水壶": "Canteen",
}
```

#### 3.3 Color Translation

**Predefined Dictionary:**
```python
COLOR_MAP = {
    '黑色': 'Black', '黑': 'Black',
    '白色': 'White', '白': 'White',
    '灰色': 'Grey', '灰': 'Grey',
    '狼灰色': 'Wolf Grey', '狼灰': 'Wolf Grey',
    '棕色': 'Brown', '土狼棕': 'Coyote Brown', '狼棕': 'Coyote Brown',
    '沙色': 'Sand', '泥色': 'Tan', '卡其': 'Khaki',
    '绿色': 'Green', '军绿': 'Army Green', '橄榄绿': 'Olive Drab',
    '游骑兵绿': 'Ranger Green',
    '红色': 'Red', '蓝色': 'Blue', '黄色': 'Yellow',
    '迷彩': 'Camo', 'MC迷彩': 'MultiCam', 'CP迷彩': 'CP Camo',
    '沙漠迷彩': 'Desert Camo', '丛林迷彩': 'Jungle Camo',
    '数码迷彩': 'Digital Camo', '暗夜迷彩': 'Night Camo',
}
```

**Fallback:** If color not in dictionary, use Gemini API for translation

#### 3.4 Variant Name Translation

**Format:** `{Color} / {Size}` or `{Style} / {Size}`

**Examples:**
- `黑色 / M` → `Black / M`
- `狼灰色 / 大号` → `Wolf Grey / L`
- `标准款 / 85-125cm` → `Standard / 85-125cm`

---

### 4. Pricing Calculations

#### 4.1 Formula

**Constants:**
```python
EXCHANGE_RATE = 0.19          # 1 CNY = 0.19 CAD
SHIPPING_CNY = 30             # Fixed shipping per item (¥30)
SALESPERSON_CUT = 0.10        # 10% of sale price
TARGET_MARGIN = 0.30          # 30% profit margin
PROMOTER_CUT = 0.10           # 10% if promo code used
```

**Calculation Steps:**
```python
def calculate_pricing(price_cny: float) -> Dict[str, float]:
    """
    Calculate all pricing fields from Taobao price
    
    Returns:
        {
            'cost_cny': float,
            'shipping_cny': float,
            'cost_cad': float,
            'price_cad': float,
            'margin_standard': float,  # percentage
            'margin_promo': float,     # percentage
        }
    """
    # Step 1: Calculate landed cost (CAD)
    cost_cny = price_cny + SHIPPING_CNY
    cost_cad = cost_cny * EXCHANGE_RATE
    
    # Step 2: Calculate sale price to achieve target margin
    # Formula: Price = Cost / (1 - salesperson% - margin%)
    divisor = 1 - SALESPERSON_CUT - TARGET_MARGIN
    sale_price_cad = cost_cad / divisor
    
    # Step 3: Apply retail pricing (.99 ending)
    sale_price_cad = round(sale_price_cad) - 0.01
    
    # Safety check: minimum 50% markup
    if sale_price_cad < cost_cad * 1.5:
        sale_price_cad = cost_cad * 1.5
    
    # Step 4: Calculate actual margins
    revenue_after_salesperson = sale_price_cad * (1 - SALESPERSON_CUT)
    margin_standard = ((revenue_after_salesperson - cost_cad) / sale_price_cad) * 100
    
    # Step 5: Calculate promo margin (10% discount + promoter cut)
    promo_price = sale_price_cad * 0.90  # 10% customer discount
    revenue_after_cuts = promo_price * (1 - SALESPERSON_CUT - PROMOTER_CUT)
    margin_promo = ((revenue_after_cuts - cost_cad) / promo_price) * 100
    
    return {
        'cost_cny': round(price_cny, 2),
        'shipping_cny': SHIPPING_CNY,
        'cost_cad': round(cost_cad, 2),
        'price_cad': round(sale_price_cad, 2),
        'margin_standard': round(margin_standard, 1),
        'margin_promo': round(margin_promo, 1),
    }
```

#### 4.2 Pricing Examples

| Taobao Price (CNY) | Landed Cost (CAD) | Sale Price (CAD) | Standard Margin | Promo Margin |
|--------------------|-------------------|------------------|-----------------|--------------|
| ¥100               | $24.70            | $49.99           | 25.6%           | 7.4%         |
| ¥200               | $43.70            | $87.99           | 25.6%           | 7.4%         |
| ¥500               | $100.70           | $202.99          | 25.6%           | 7.4%         |
| ¥1000              | $195.70           | $394.99          | 25.6%           | 7.4%         |

**Notes:**
- Standard margin after 10% salesperson cut
- Promo margin after 10% discount + 10% salesperson + 10% promoter

---

### 5. Database Seeding (Supabase)

#### 5.1 Supabase Integration

**Setup:**
```python
from supabase import create_client, Client

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY')  # Admin key

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
```

#### 5.2 Product Insertion

**Function:**
```python
def seed_product(product_data: Dict) -> str:
    """
    Insert product into Supabase
    Returns product ID
    """
    # Generate SKU
    sku = f"PZ-{product_data['item_id']}"
    
    # Prepare data
    payload = {
        'sku': sku,
        'title': product_data['title_en'],
        'titleOriginal': product_data['title_zh'],
        'url': product_data['url'],
        'status': 'draft',  # Start as draft
        'priceCadBase': product_data['pricing']['price_cad'],
        'primaryImage': product_data['images']['main'][0] if product_data['images']['main'] else None,
        'images': product_data['images']['main'],
        'detailImages': product_data['images']['details'],
    }
    
    # Insert
    response = supabase.table('Product').insert(payload).execute()
    product_id = response.data[0]['id']
    
    print(f"✅ Created product: {sku} (ID: {product_id})")
    return product_id
```

#### 5.3 Variant Insertion

**Function:**
```python
def seed_variants(product_id: str, variants: List[Dict]):
    """Insert all variants for a product"""
    for i, variant in enumerate(variants):
        # Generate variant SKU
        sku = f"PZ-{variant['item_id']}-{variant['sku_suffix']}"
        
        # Prepare data
        payload = {
            'productId': product_id,
            'sku': sku,
            'variantName': variant['name_en'],
            'sortOrder': i,
            
            # Pricing
            'priceCny': variant['pricing']['cost_cny'],
            'shippingCny': variant['pricing']['shipping_cny'],
            'costCad': variant['pricing']['cost_cad'],
            'priceCad': variant['pricing']['price_cad'],
            'marginStandard': variant['pricing']['margin_standard'],
            'marginPromo': variant['pricing']['margin_promo'],
            
            # Options
            'optionType1': variant.get('option_type_1'),
            'optionValue1': variant.get('option_value_1'),
            'optionType2': variant.get('option_type_2'),
            'optionValue2': variant.get('option_value_2'),
            
            # Stock & Status
            'stock': variant.get('stock', 0),
            'status': 'active',
        }
        
        # Insert
        supabase.table('Variant').insert(payload).execute()
        print(f"  ✅ Created variant: {sku}")
```

#### 5.4 Batch Processing

**Workflow:**
```python
def process_all_links():
    """Main workflow function"""
    with open('taobao_links.txt', 'r') as f:
        urls = [line.strip() for line in f if line.strip()]
    
    for url in urls:
        try:
            print(f"\n🔍 Scraping: {url}")
            
            # Step 1: Scrape
            raw_data = scrape_taobao_product(url)
            
            # Step 2: Translate
            translated = translate_product(raw_data)
            
            # Step 3: Process images
            images = process_images(raw_data)
            upload_images_to_supabase(images)
            
            # Step 4: Calculate pricing
            pricing = calculate_all_pricing(raw_data)
            
            # Step 5: Seed database
            product_id = seed_product({
                **translated,
                **images,
                **pricing,
            })
            seed_variants(product_id, raw_data['variants'])
            
            print(f"✅ Complete: {translated['title_en']}")
            
        except Exception as e:
            print(f"❌ Error: {url} - {str(e)}")
            continue
```

---

### 6. Error Handling

#### 6.1 Common Errors

**Taobao Changes:**
- CSS selectors break → Use multiple fallback selectors
- JSON structure changes → Graceful degradation to Tier 2/3

**Network Issues:**
- Timeout → Retry with exponential backoff
- Rate limiting → Pause 30 seconds, retry

**Translation Failures:**
- Gemini API error → Use dictionary-based fallback
- Invalid output → Sanitize and validate

**Database Errors:**
- Duplicate SKU → Update existing record
- Constraint violation → Log and skip

#### 6.2 Logging

**Log Levels:**
```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler('scraper.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)
```

**Usage:**
```python
logger.info(f"Starting scrape: {url}")
logger.warning(f"Retry attempt {retry}/3")
logger.error(f"Failed to extract variants: {e}")
```

#### 6.3 Retry Logic

```python
def retry_on_failure(func, max_retries=3, delay=2):
    """Decorator for retrying failed operations"""
    def wrapper(*args, **kwargs):
        for attempt in range(max_retries):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                if attempt == max_retries - 1:
                    raise
                logger.warning(f"Retry {attempt+1}/{max_retries}: {e}")
                time.sleep(delay * (2 ** attempt))  # Exponential backoff
    return wrapper
```

---

### 7. Testing Requirements

#### 7.1 Unit Tests

**Test Coverage:**
- [ ] Pricing calculations (all formulas)
- [ ] Color translation (dictionary lookup)
- [ ] SKU generation
- [ ] Image stitching
- [ ] Variant extraction

**Example:**
```python
def test_pricing_calculation():
    result = calculate_pricing(100.0)
    assert result['cost_cny'] == 100.0
    assert result['shipping_cny'] == 30.0
    assert result['cost_cad'] == 24.70
    assert result['price_cad'] == 49.99
```

#### 7.2 Integration Tests

**Test Scenarios:**
- [ ] Scrape test product (known URL)
- [ ] Upload image to Supabase
- [ ] Insert product + variants
- [ ] Verify data in database

#### 7.3 End-to-End Test

**Test Command:**
```bash
python scraper.py --test
```

**Expected Output:**
```
🔍 Scraping test product...
  ✅ Extracted title: Tactical Plate Carrier
  ✅ Found 4 variants (Black, Tan, Grey, OD Green)
  ✅ Downloaded 12 images
  ✅ Stitched variant comparison
  ✅ Uploaded images to Supabase
  ✅ Created product (ID: abc123)
  ✅ Created 4 variants

✅ Test passed!
```

---

## 🚀 Workflow Script

**File:** `workflow.sh`

```bash
#!/bin/bash
set -e

echo "🚀 Protocol Zero - Scraper Workflow"
echo "===================================="

# Check dependencies
echo "Checking dependencies..."
python3 -c "import selenium, supabase, PIL, google.generativeai" || {
    echo "❌ Missing dependencies. Run: pip install -r requirements.txt"
    exit 1
}

# Activate virtual environment
source .venv/bin/activate

# Check environment variables
if [ -z "$SUPABASE_URL" ]; then
    echo "❌ Missing SUPABASE_URL. Check .env file."
    exit 1
fi

# Count URLs
URL_COUNT=$(wc -l < taobao_links.txt)
echo "📝 Found $URL_COUNT URLs to scrape"

# Run scraper
echo "🔍 Starting scraper..."
python3 ai_scraper.py

# Summary
echo ""
echo "✅ Scraping complete!"
echo "📊 View results: https://app.supabase.io"
echo "🌐 Preview shop: http://localhost:3000"
```

---

**End of Specifications**  
**Version:** 2.0  
**Last Updated:** January 25, 2026
