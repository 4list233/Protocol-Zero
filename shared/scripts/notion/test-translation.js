#!/usr/bin/env node

/**
 * Test the translation utilities with sample Chinese text
 */

const { translateTitleSimple, translateVariantSimple } = require('./translate-utils');

console.log('🧪 Testing Translation Utilities\n');

// Test title translation
console.log('--- Title Translation Tests ---');
const titleTests = [
  '战术背心MOLLE系统多功能户外配件',
  '战术耳机转接器民用PTT按键',
  '手枪箱枪箱手雷玩具可爆炸水弹',
  '头盔护目镜手套腰带水壶弹匣',
  'Some English Title',  // Should pass through
];

titleTests.forEach(zh => {
  const en = translateTitleSimple(zh);
  console.log(`  ${zh}`);
  console.log(`  → ${en}\n`);
});

// Test variant translation
console.log('--- Variant Translation Tests ---');
const variantTests = [
  '黑色',
  '狼灰色',
  '游骑兵绿色',
  '暗夜迷彩MC',
  '建伍双插',
  '狼棕色/卡其',
  'Black',  // Should pass through
  '品牌科杜拉尼龙黑色',  // Should strip filler
];

variantTests.forEach(zh => {
  const en = translateVariantSimple(zh);
  console.log(`  ${zh}`);
  console.log(`  → ${en}\n`);
});

console.log('✅ Translation tests complete');
