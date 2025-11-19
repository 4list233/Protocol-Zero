# Regenerate Instructions

After making manual changes to the centralized data files, follow these steps to update the shop:

## 1. After Editing Product Data

If you modified `shared/data/products_manifest.json` or `shared/data/product_overrides.json`:

```zsh
cd ~/Documents/protocol-zero/shared/scripts && node generate-products.js
```

This regenerates `shop/lib/products.generated.ts` with the latest product data.

---

## 2. After Changing Images

If you added, renamed, or updated images in `scraper/media/`:

```zsh
cd ~/Documents/protocol-zero/shared/scripts && node sync-media.js
```

This copies images from `scraper/media` to `shop/public/images` with the correct naming convention.

---

## 3. After Editing Schedule

If you modified `shared/data/schedule_config.json`:

No regeneration needed — the shop reads this file directly at runtime.

Just refresh your browser or restart the dev server:

```zsh
cd ~/Documents/protocol-zero/shop && npm run dev
```

---

## 4. After Running the Scraper

If you re-scraped products from Taobao (which updates `shared/data/products_manifest.json`):

```zsh
# Step 1: Sync new images
cd ~/Documents/protocol-zero/shared/scripts && node sync-media.js

# Step 2: Regenerate products
node generate-products.js
```

---

## Quick Reference

| What Changed | Command |
|--------------|---------|
| `products_manifest.json` or `product_overrides.json` | `cd shared/scripts && node generate-products.js` |
| Images in `scraper/media/` | `cd shared/scripts && node sync-media.js` |
| `schedule_config.json` | Restart dev server (auto-reloads) |
| Ran scraper | Sync media → Regenerate products |

---

## Notes

- Always regenerate products after changing manifest or overrides
- Media sync is required if image filenames changed or new images were added
- Schedule changes take effect immediately (no regeneration needed)
- You can set a custom default margin: `DEFAULT_PRODUCT_MARGIN=0.3 node generate-products.js`
