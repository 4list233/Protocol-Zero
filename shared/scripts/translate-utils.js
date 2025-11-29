/**
 * Simple rule-based Chinese → English translation for tactical gear
 * Ported from scraper.py translate_title_simple and translate_variant_simple
 */

function translateTitleSimple(zh) {
  if (!zh) return '';
  
  // Common tactical gear term mappings
  const mapping = [
    [/战术背心/g, "Tactical Vest"],
    [/通用型/g, "Universal"],
    [/MOLLE系统|MOLLE 系统/g, "MOLLE System"],
    [/手机导航面板/g, "Phone Navigation Panel"],
    [/胸口PDA包|胸包|胸前包/g, "Chest Bag"],
    [/多功能/g, "Multi-Function"],
    [/户外/g, "Outdoor"],
    [/配件/g, "Accessories"],
    [/战术耳机/g, "Tactical Headset"],
    [/转接器/g, "Adapter"],
    [/民用/g, "Civilian"],
    [/PTT按键/g, "PTT Button"],
    [/发射/g, "Transmit"],
    [/对讲机/g, "Radio"],
    [/建伍/g, "Kenwood"],
    [/接口/g, "Interface"],
    [/支持/g, "Compatible"],
    [/手枪箱/g, "Pistol Case"],
    [/枪箱/g, "Gun Case"],
    [/手雷/g, "Grenade"],
    [/玩具/g, "Toy"],
    [/可爆炸水弹/g, "Water Bomb"],
    [/弹射烟雾/g, "Smoke Ejection"],
    [/手榴弹模型/g, "Grenade Model"],
    [/男孩生日礼物/g, "Boys Birthday Gift"],
    [/儿童/g, "Kids"],
    [/头盔/g, "Helmet"],
    [/护目镜/g, "Goggles"],
    [/手套/g, "Gloves"],
    [/腰带/g, "Belt"],
    [/水壶/g, "Canteen"],
    [/弹匣/g, "Magazine"],
  ];

  let out = zh;
  for (const [pattern, replacement] of mapping) {
    out = out.replace(pattern, ` ${replacement} `);
  }

  // Remove decorative symbols/brackets
  out = out.replace(/[【】\[\]（）()]+/g, " ");
  out = out.replace(/\s+/g, " ").trim();

  // Compact phrasing - keep only main phrases and remove duplicated words
  const parts = out.split(/\s+/);
  const seen = new Set();
  const compact = [];
  for (const w of parts) {
    const lw = w.toLowerCase();
    if (!seen.has(lw)) {
      compact.push(w);
      seen.add(lw);
    }
  }
  let result = compact.join(" ").slice(0, 120);

  // If still mostly Chinese, return original
  const chineseChars = (result.match(/[\u4e00-\u9fff]/g) || []).length;
  if (chineseChars > result.length * 0.5) {
    return zh;
  }

  return result;
}

function translateVariantSimple(zh) {
  if (!zh) return '';

  // Remove decorative brackets
  let s = zh.replace(/[【】\[\]（）()]/g, " ");
  
  // Remove brand/filler terms
  s = s.replace(/品牌|考度拉|科杜拉|尼龙|原厂|正品|仅支持|伯莱塔|SIG印字|M9A3印字|M9A4印字|加大款|小号|无LOGO|通用款|专用|空箱|带海绵内衬/g, " ");

  // Known color/pattern mappings
  const termMap = {
    '黑色': 'Black',
    '狼灰色': 'Wolf Grey',
    '灰色': 'Grey',
    '灰': 'Grey',
    '游骑兵绿色': 'Ranger Green',
    '军绿色': 'Army Green',
    '绿色': 'Green',
    '狼棕色': 'Coyote Brown',
    '棕色': 'Brown',
    '卡其': 'Khaki',
    '白色': 'White',
    '红色': 'Red',
    '蓝色': 'Blue',
    '黄色': 'Yellow',
    '暗夜迷彩': 'Black Camouflage Pattern',
    '迷彩': 'Camouflage',
    '丛林迷彩': 'Jungle Camouflage',
    '沙色': 'Sand',
    '土狼棕': 'Coyote Brown',
    '土狼': 'Coyote',
    '建伍': 'Kenwood',
    '摩托罗拉': 'Motorola',
    '单插': 'Single',
    '双插': 'Dual',
  };

  // Split into chunks
  const chunks = s.split(/[\s,/，、]+/);
  const outChunks = [];

  for (let ch of chunks) {
    if (!ch) continue;

    // Keep codes like MC/BK/RG/CB/WG/BCP if present
    let code = null;
    const codeMatch = ch.match(/\b(MC|CP|BK|RG|CB|WG|BCP|M1|M2|KEN)\b/i);
    if (codeMatch) {
      code = codeMatch[1].toUpperCase();
    }

    // Replace known Chinese terms
    let trans = ch;
    for (const [k, v] of Object.entries(termMap)) {
      trans = trans.replace(new RegExp(k, 'g'), v);
    }

    // If result still contains Chinese, drop it unless it has code
    if (/[\u4e00-\u9fff]/.test(trans)) {
      if (code) {
        trans = code;
      } else {
        continue;
      }
    }

    // Normalize like "MC Camouflage"
    if (code && trans.includes('Camouflage') && !trans.includes(code)) {
      trans = `${code} Camouflage`;
    }

    // Skip pure English filler words
    if (['the', 'of', 'and', 'or', 'only', 'with', 'for'].includes(trans.toLowerCase())) {
      continue;
    }

    // Ensure spacing around concatenated translations
    trans = trans.replace(/([a-z])([A-Z])/g, '$1 $2');

    outChunks.push(trans);
  }

  // Join with separator for combos, remove duplicates
  const uniqueChunks = [...new Map(outChunks.map(c => [c.trim(), c.trim()])).values()];
  let result = uniqueChunks.filter(c => c).join(" / ");

  // If empty after translation, return simplified original
  if (!result) {
    result = zh.replace(/[【】\[\]（）()]/g, "").trim();
  }

  return result;
}

module.exports = {
  translateTitleSimple,
  translateVariantSimple,
};
