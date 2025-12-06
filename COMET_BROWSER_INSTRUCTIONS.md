Process my Knack Airsoft Database variants at:
https://ibm-securegateway-client.topme.ca/airsoft#home/

For each variant in the list:

1. CLICK into the variant edit page

2. CHECK the Product Title dropdown:
   - If Product Title is already in English → SKIP to Step 4
   - If Product Title is in Chinese → DO Step 3

3. UPDATE PRODUCT (separate form):
   - Click to open the Product update form
   - Translate Chinese product name to English:
     * Remove brands (WOSPORT, FMA, TMC, etc.)
     * Keep military designations (PVS-14, AN/PEQ-15, MICH 2000)
     * Keep standard models (6094, JPC, AVS)
   - Fill in Product Title with translated English name
   - SUBMIT the Product update form
   - Return to variant edit page

4. OPEN the variant's Taobao URL and extract:
   - Chinese variant name (from selected option buttons/text)
   - Price CNY (look for "券后¥XXX" - after-coupon price, or ¥XXX for original price)
   - Option categories visible (Color, Size, Style/Material)

5. SEARCH for the cheapest similar product in Canada using the product title (e.g., "L4G24 NVG")

6. TRANSLATE and PARSE the variant:
   - Variant Name: Translate Chinese → English:
     * Colors: "黑色" → "Black", "狼灰色" → "Wolf Grey", "狼棕色" → "Coyote Brown", "游骑兵绿" → "Ranger Green"
     * Sizes: Keep codes "M", "L" or translate "均码" → "One Size"
     * Styles: Keep technical terms "CNC", translate "金属" → "Metal"
     * Combined: "黑色 / BK - M" → "Black / BK - M"
   - Parse options:
     * Option Type 1: "Color" if color, OR "Size" if no color, OR "Style" if only style
     * Option Value 1: Normalized English value ("Black", "M", "CNC")
     * Option Type 2: "Size" if Type 1 is Color and size found, OR "Style", OR leave empty
     * Option Value 2: Normalized value, OR leave empty

7. CALCULATE margins:
   - Reference Price = Canadian Price × 0.85
   - Cost = (CNY Price + 65) / 5.2 - (Reference Price × 0.1)
   - Margins = (Reference Price - Cost) ÷ Reference Price
   - Round to 2 decimal places (e.g., 0.82)

8. EDIT VARIANT (separate form):
   - Scroll down to variant fields
   - Fill in:
     * Variant Name: [Translated English variant name]
     * Description: [Translated variant name - same as Variant Name]
     * Option Type 1: [Color/Size/Style or empty]
     * Option Value 1: [Normalized value or empty]
     * Option Type 2: [Size/Style or empty]
     * Option Value 2: [Normalized value or empty]
     * Price CNY: [Taobao price, e.g., 215]
     * Competitor Products: [URL of cheapest Canadian product found]
     * Competitor Price (CAD): [Price of competitor product]
     * Margins: [Calculated value, e.g., 0.82]
     * Status: Change to "Margins Added"
   - SUBMIT the Variant edit form

9. VARIANT DISAPPEARS from catalog list - move to next variant

10. REPEAT until list is empty

COLOR REFERENCE:
- 黑色/黑 → Black | 白色/白 → White | 灰色/灰 → Grey
- 狼灰色/狼灰 → Wolf Grey | 狼棕色/狼棕/土狼棕 → Coyote Brown
- 沙色 → Sand | 泥色 → Tan | 卡其 → Khaki
- 绿色/绿 → Green | 军绿色/军绿 → Army Green | 游骑兵绿 → Ranger Green
- 红色/红 → Red | 粉色 → Pink | 蓝色/蓝 → Blue
- 金色/金 → Gold | 银色/银 → Silver | 消光黑 → Matte Black
- CP迷彩 → CP Camo | 暗夜迷彩 → Black Camo | 废墟迷彩 → Ruins Camo | MultiCam → MultiCam

SIZE REFERENCE:
- XXS, XS, S, M, L, XL, XXL, XXXL → Keep as-is
- 均码 → One Size | 大款 → Large | 小款 → Small | 短款 → Short | 矮款 → Low Profile
- 85-125cm, 90-130cm → Keep measurement format

STYLE REFERENCE:
- CNC → CNC | 金属 → Metal | 铝合金 → Aluminum | 尼龙 → Nylon
- 考度拉 → Cordura | 标准 → Standard | 升级版 → Upgraded | 套装 → Set

OPTION PARSING:
- Color found → Type 1 = "Color", Value 1 = color name
- Size found (no color) → Type 1 = "Size", Value 1 = size
- Style found (no color/size) → Type 1 = "Style", Value 1 = style
- Color + Size → Type 1 = "Color", Type 2 = "Size"
- Color + Style → Type 1 = "Color", Type 2 = "Style"
- Leave Type 2/Value 2 empty if only one dimension

RULES:
- Use the CHEAPEST Canadian competitor URL (not a description)
- If same Taobao URL, reuse same price/competitor/margin/translations for efficiency
- Product update is a SEPARATE form from variant edit - submit each separately
- Product only needs updating ONCE per product (subsequent variants skip Step 3)
- Process all variants until list is empty

No confirmation needed - proceed automatically.
