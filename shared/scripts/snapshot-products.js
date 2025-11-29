#!/usr/bin/env node

const { Client } = require('@notionhq/client');
const fs = require('fs/promises');
const path = require('path');
// Load environment variables from root .env file
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const PRODUCTS_DB = process.env.NOTION_DATABASE_ID_PRODUCTS;
const VARIANTS_DB = process.env.NOTION_DATABASE_ID_VARIANTS;

function text(rt) {
  if (!rt || rt.length === 0) return '';
  return rt.map((t) => (t.plain_text || (t.text && t.text.content) || '')).join('');
}
function sel(s) { return s && s.name; }
function num(n) { return typeof n === 'number' ? n : 0; }

async function fetchAllProducts() {
  let start_cursor = undefined;
  const all = [];
  do {
    const res = await notion.databases.query({
      database_id: PRODUCTS_DB,
      filter: { property: 'Status', select: { equals: 'Active' } },
      page_size: 100,
      start_cursor,
    });
    all.push(...res.results);
    start_cursor = res.has_more ? res.next_cursor : undefined;
  } while (start_cursor);
  return all;
}

async function fetchVariantsForProduct(productPageId) {
  let start_cursor = undefined;
  const all = [];
  do {
    const res = await notion.databases.query({
      database_id: VARIANTS_DB,
      filter: { property: 'Product', relation: { contains: productPageId } },
      sorts: [{ property: 'Sort Order', direction: 'ascending' }],
      page_size: 100,
      start_cursor,
    });
    all.push(...res.results);
    start_cursor = res.has_more ? res.next_cursor : undefined;
  } while (start_cursor);
  return all.map((vp) => {
    const p = vp.properties;
    return {
      id: vp.id,
      variantName: text(p['Variant Name']?.title),
      sku: text(p['SKU']?.rich_text),
      price_cny: num(p['Price CNY']?.number),
      price_cad: p['Price CAD Override']?.number ?? undefined,
      stock: p['Stock']?.number ?? undefined,
      status: sel(p['Status']?.select),
      sortOrder: p['Sort Order']?.number ?? 0,
    };
  });
}

async function main() {
  if (!process.env.NOTION_API_KEY || !PRODUCTS_DB || !VARIANTS_DB) {
    console.error('❌ Missing NOTION_* env vars');
    process.exit(1);
  }

  const productPages = await fetchAllProducts();
  const results = [];

  for (const page of productPages) {
    const props = page.properties;
    const variants = await fetchVariantsForProduct(page.id);

    const imagePathsText = text(props['Image Paths']?.rich_text);
    let images = [];
    try { images = imagePathsText ? JSON.parse(imagePathsText) : []; } catch { images = []; }

    results.push({
      id: text(props['ID']?.rich_text),
      sku: text(props['SKU']?.rich_text),
      title: text(props['Title']?.title),
      title_original: text(props['Title Original']?.rich_text),
      price_cad: num(props['Price CAD (Base)']?.number),
      margin: num(props['Margin']?.number) || 0.5,
      primaryImage: images[0] || '',
      images,
      detailLongImage: text(props['Detail Image Path']?.rich_text) || undefined,
      category: sel(props['Category']?.select),
      description: text(props['Description']?.rich_text),
      status: sel(props['Status']?.select),
      stock: props['Stock']?.number ?? undefined,
      url: props['URL']?.url || undefined,
      variants: variants.length ? variants : undefined,
    });

    // small delay to be nice to API
    await new Promise((r) => setTimeout(r, 150));
  }

  const date = new Date();
  const stamp = `${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}`;
  const outDir = path.join(__dirname, '../data/backups');
  const outFile = path.join(outDir, `products-${stamp}.json`);

  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(outFile, JSON.stringify(results, null, 2));
  console.log(`✅ Snapshot saved: ${outFile}`);
}

main().catch((e) => {
  console.error('❌ Snapshot error:', e?.message || e);
  process.exit(1);
});
