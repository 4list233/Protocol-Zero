Process my Knack Airsoft Database variants at:
https://ibm-securegateway-client.topme.ca/airsoft#home/

For each variant with Status "Active", do the following:

1. OPEN the variant's Taobao URL and get the price (look for "券后¥XXX" - the after-coupon price in CNY, if not found, look for ¥XXX for original price)

2. SEARCH for the cheapest similar product in Canada using the product title (e.g., "L4G24 NVG ")

3. FILL IN the variant fields:
   - Price CNY: [Taobao price, e.g., 215]
   - Competitor Products: [URL of the cheapest Canadian product found]
   - Competitor Price (CAD): price of the product found
   - Margins: [Calculate using formula below]
   - Status: Change to "Margins Added"

4. SUBMIT and move to the next variant

MARGIN FORMULA:
- Reference Price = Canadian Price × 0.85
- Cost = (CNY Price + 65)/5.2 - (reference price *0.1)
- Margins = (Reference Price - Cost) ÷ reference price
- Round to 2 decimal places (e.g., 0.82)

RULES:
- Use the CHEAPEST Canadian competitor URL (not a description)
- If same Taobao URL, reuse the same price/competitor/margin for efficiency
- Skip variants already marked "Margins Added"
- Process all variants until complete

No confirmation needed - proceed automatically.