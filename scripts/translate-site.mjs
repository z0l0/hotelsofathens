import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const dataDir = path.join(rootDir, 'data');
const siteUrl = 'https://hotelsofathens.com';
const model = process.env.OPENROUTER_MODEL || 'qwen/qwen3-235b-a22b-2507';
const cacheDir = path.join(rootDir, '.translation-cache');

const languages = {
  de: {
    name: 'German',
    htmlLang: 'de',
    nativeName: 'Deutsch',
    instruction: 'Translate into natural German for travelers from Germany. Use idiomatic travel-guide German, not literal machine-translation phrasing.'
  },
  el: {
    name: 'Greek',
    htmlLang: 'el',
    nativeName: 'Ελληνικά',
    instruction: 'Translate into natural modern Greek for travelers searching for Athens hotels. Use idiomatic Greek, not stiff machine-translation phrasing.'
  }
};

const languageLabels = {
  en: 'English',
  de: 'Deutsch',
  el: 'Ελληνικά'
};

function readEnvValue(name) {
  if (process.env[name]) return process.env[name];
  const envPath = path.join(rootDir, '.env');
  if (!fs.existsSync(envPath)) return '';
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match?.[1] === name) return match[2].replace(/^["']|["']$/g, '').trim();
  }
  return '';
}

const apiKey = readEnvValue('OPENROUTER_API_KEY');
if (!apiKey) {
  throw new Error('OPENROUTER_API_KEY not found in environment or .env');
}

function walkHtmlFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'de' || entry.name === 'el') continue;
      files.push(...walkHtmlFiles(full));
    } else if (entry.name.endsWith('.html')) {
      files.push(full);
    }
  }
  return files;
}

function urlPathForFile(file) {
  const rel = path.relative(distDir, file).replaceAll(path.sep, '/');
  if (rel === 'index.html') return '/';
  return `/${rel.replace(/\.html$/, '')}`;
}

function localizedPath(lang, urlPath) {
  const clean = urlPath === '/' ? '/' : `/${urlPath.replace(/^\/+/, '')}`;
  if (lang === 'en') return clean;
  return clean === '/' ? `/${lang}/` : `/${lang}${clean}`;
}

function localizedFilePath(lang, file) {
  const rel = path.relative(distDir, file);
  return path.join(distDir, lang, rel);
}

function buildLanguageSelector(urlPath, activeLang) {
  return `<div class="language-selector" aria-label="Language selector">
        ${Object.entries(languageLabels).map(([lang, label]) => {
          const active = lang === activeLang ? ' aria-current="true"' : '';
          return `<a href="${localizedPath(lang, urlPath)}" hreflang="${lang}" lang="${lang}"${active}>${label}</a>`;
        }).join('')}
      </div>`;
}

function buildHreflangLinks(urlPath) {
  const links = ['en', 'de', 'el'].map(lang => (
    `<link rel="alternate" hreflang="${lang}" href="${siteUrl}${localizedPath(lang, urlPath)}">`
  ));
  links.push(`<link rel="alternate" hreflang="x-default" href="${siteUrl}${localizedPath('en', urlPath)}">`);
  return links.join('\n  ');
}

function htmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function shouldTranslate(text) {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (!/[A-Za-zΑ-Ωα-ω]/.test(trimmed)) return false;
  if (/^https?:\/\//.test(trimmed)) return false;
  if (/^[€$]?\d+([.,]\d+)?\s*[%+]?$/u.test(trimmed)) return false;
  return true;
}

function maskedBlocks(html) {
  const masks = [];
  const masked = html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, block => {
    const token = `%%MASKED_BLOCK_${masks.length}%%`;
    masks.push(block);
    return token;
  });
  return { masked, masks };
}

function restoreMaskedBlocks(html, masks) {
  return html.replace(/%%MASKED_BLOCK_(\d+)%%/g, (_, index) => masks[Number(index)]);
}

function collectStrings(html, set) {
  const { masked } = maskedBlocks(html);
  const parts = masked.split(/(<[^>]+>)/g);
  for (const part of parts) {
    if (!part || part.startsWith('<')) continue;
    const trimmed = part.trim();
    if (shouldTranslate(trimmed)) set.add(trimmed);
  }

  const attrPatterns = [
    /(<meta\s+(?:name|property)="(?:description|og:title|og:description|twitter:title|twitter:description)"\s+content=")([^"]*)(")/gi,
    /(\s(?:aria-label|alt|title)=")([^"]*)(")/gi
  ];
  for (const pattern of attrPatterns) {
    for (const match of masked.matchAll(pattern)) {
      if (shouldTranslate(match[2])) set.add(match[2].trim());
    }
  }
}

function applyTranslations(html, translations, lang, urlPath) {
  const { masked, masks } = maskedBlocks(html);
  const parts = masked.split(/(<[^>]+>)/g).map(part => {
    if (!part || part.startsWith('<')) return part;
    const leading = part.match(/^\s*/)[0];
    const trailing = part.match(/\s*$/)[0];
    const trimmed = part.trim();
    if (!shouldTranslate(trimmed)) return part;
    return `${leading}${translations[trimmed] || trimmed}${trailing}`;
  });
  let out = restoreMaskedBlocks(parts.join(''), masks);

  out = out.replace(/(<meta\s+(?:name|property)="(?:description|og:title|og:description|twitter:title|twitter:description)"\s+content=")([^"]*)(")/gi, (full, pre, value, post) => {
    const translated = translations[value.trim()] || value;
    return `${pre}${htmlEscape(translated)}${post}`;
  });
  out = out.replace(/(\s(?:aria-label|alt|title)=")([^"]*)(")/gi, (full, pre, value, post) => {
    const translated = translations[value.trim()] || value;
    return `${pre}${htmlEscape(translated)}${post}`;
  });

  out = out.replace(/<html lang="[^"]*"/, `<html lang="${languages[lang].htmlLang}"`);
  out = out.replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${siteUrl}${localizedPath(lang, urlPath)}">`);
  out = out.replace(/(?:\s*<link rel="alternate" hreflang="[^"]+" href="[^"]+">)+/, `\n  ${buildHreflangLinks(urlPath)}`);
  out = out.replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${siteUrl}${localizedPath(lang, urlPath)}">`);
  out = out.replace(/<div class="language-selector"[\s\S]*?<\/div>/, buildLanguageSelector(urlPath, lang));

  out = out.replace(/\s(href|src)="\/(?!\/|css\/|images\/|favicon\.ico|de\/|el\/|#)([^"]*)"/g, (match, attr, target) => {
    if (/^(mailto:|tel:)/.test(target)) return match;
    return ` ${attr}="/${lang}/${target}"`;
  });

  return out;
}

function protectTerms() {
  const terms = new Set(['Hotels of Athens']);
  const allHotelsPath = path.join(dataDir, 'all-hotels.json');
  const neighborhoodsPath = path.join(dataDir, 'neighborhoods.json');
  if (fs.existsSync(allHotelsPath)) {
    const hotels = JSON.parse(fs.readFileSync(allHotelsPath, 'utf8')).hotels || [];
    for (const hotel of hotels) terms.add(hotel.name);
  }
  if (fs.existsSync(neighborhoodsPath)) {
    const neighborhoods = JSON.parse(fs.readFileSync(neighborhoodsPath, 'utf8')).neighborhoods || [];
    for (const hood of neighborhoods) terms.add(hood.name);
  }
  return [...terms].sort();
}

function cachePath(lang) {
  return path.join(cacheDir, `${lang}.json`);
}

function loadCache(lang) {
  const file = cachePath(lang);
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveCache(lang, cache) {
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(cachePath(lang), JSON.stringify(cache, null, 2));
}

function parseJsonResponse(text) {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  return JSON.parse(trimmed);
}

async function translateBatch(lang, items) {
  const protectedTerms = protectTerms().slice(0, 80).join(', ');
  const prompt = [
    languages[lang].instruction,
    'Return ONLY a JSON array of translated strings in the exact same order as the input array.',
    'Preserve hotel names, brand names, prices, numbers, URLs, HTML entities, and short labels when they are proper nouns.',
    `Protected names: ${protectedTerms}`,
    'Do not add notes. Do not wrap the JSON in markdown.',
    '',
    JSON.stringify(items)
  ].join('\n');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.TRANSLATE_TIMEOUT_MS || 45000));
  const maxTokens = Math.min(
    Number(process.env.TRANSLATE_MAX_TOKENS || 9000),
    Math.max(1200, Math.ceil(items.join('\n').length * (lang === 'el' ? 2.2 : 1.8)))
  );

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    signal: controller.signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': siteUrl,
      'X-Title': 'Hotels of Athens translation build'
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: maxTokens,
      messages: [
        {
          role: 'system',
          content: 'You are a careful professional website translator. You preserve meaning, tone, HTML-adjacent entities, and proper nouns.'
        },
        { role: 'user', content: prompt }
      ]
    })
  }).finally(() => clearTimeout(timeout));

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`OpenRouter error ${response.status}: ${JSON.stringify(data).slice(0, 800)}`);
  }
  const content = data.choices?.[0]?.message?.content || '';
  const parsed = parseJsonResponse(content);
  if (!Array.isArray(parsed) || parsed.length !== items.length) {
    throw new Error(`Translation response length mismatch for ${lang}: expected ${items.length}, got ${Array.isArray(parsed) ? parsed.length : 'non-array'}`);
  }
  return parsed;
}

async function translateItemsSafely(lang, items) {
  try {
    return await translateBatch(lang, items);
  } catch (error) {
    if (items.length <= 10) throw error;
    console.warn(`${lang}: splitting ${items.length}-item batch after error: ${error.message}`);
    const middle = Math.ceil(items.length / 2);
    const first = await translateItemsSafely(lang, items.slice(0, middle));
    const second = await translateItemsSafely(lang, items.slice(middle));
    return first.concat(second);
  }
}

function chunkItems(items, maxChars = Number(process.env.TRANSLATE_MAX_CHARS || 8000), maxItems = Number(process.env.TRANSLATE_MAX_ITEMS || 60)) {
  const chunks = [];
  let chunk = [];
  let size = 0;
  for (const item of items) {
    const itemSize = item.length + 8;
    if (chunk.length && (chunk.length >= maxItems || size + itemSize > maxChars)) {
      chunks.push(chunk);
      chunk = [];
      size = 0;
    }
    chunk.push(item);
    size += itemSize;
  }
  if (chunk.length) chunks.push(chunk);
  return chunks;
}

function updateEnglishPages(files) {
  for (const file of files) {
    const urlPath = urlPathForFile(file);
    let html = fs.readFileSync(file, 'utf8');
    html = html.replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${siteUrl}${localizedPath('en', urlPath)}">`);
    html = html.replace(/(?:\s*<link rel="alternate" hreflang="[^"]+" href="[^"]+">)+/, `\n  ${buildHreflangLinks(urlPath)}`);
    html = html.replace(/<div class="language-selector"[\s\S]*?<\/div>/, buildLanguageSelector(urlPath, 'en'));
    fs.writeFileSync(file, html);
  }
}

function updateSitemap(files) {
  const today = new Date().toISOString().split('T')[0];
  const urls = [];
  for (const file of files) {
    const urlPath = urlPathForFile(file);
    for (const lang of ['en', 'de', 'el']) {
      const priority = urlPath === '/' && lang === 'en' ? '1.0' : lang === 'en' ? '0.8' : '0.64';
      urls.push({ loc: `${siteUrl}${localizedPath(lang, urlPath)}`, priority });
    }
  }
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;
  fs.writeFileSync(path.join(distDir, 'sitemap.xml'), sitemap);
}

async function main() {
  fs.rmSync(path.join(distDir, 'de'), { recursive: true, force: true });
  fs.rmSync(path.join(distDir, 'el'), { recursive: true, force: true });

  const files = walkHtmlFiles(distDir);
  updateEnglishPages(files);

  const allStrings = new Set();
  for (const file of files) collectStrings(fs.readFileSync(file, 'utf8'), allStrings);
  const strings = [...allStrings].sort((a, b) => a.length - b.length || a.localeCompare(b));

  console.log(`Translating ${strings.length} unique strings across ${files.length} pages with ${model}`);

  for (const lang of Object.keys(languages)) {
    const cache = loadCache(lang);
    const missing = strings.filter(item => !cache[item]);
    const chunks = chunkItems(missing);
    console.log(`${lang}: ${missing.length} missing strings in ${chunks.length} batches`);
    for (let i = 0; i < chunks.length; i += 1) {
      console.log(`${lang}: batch ${i + 1}/${chunks.length}`);
      const translated = await translateItemsSafely(lang, chunks[i]);
      chunks[i].forEach((item, index) => {
        cache[item] = translated[index];
      });
      saveCache(lang, cache);
    }

    for (const file of files) {
      const urlPath = urlPathForFile(file);
      const html = fs.readFileSync(file, 'utf8');
      const translatedHtml = applyTranslations(html, cache, lang, urlPath);
      const outFile = localizedFilePath(lang, file);
      fs.mkdirSync(path.dirname(outFile), { recursive: true });
      fs.writeFileSync(outFile, translatedHtml);
    }
  }

  updateSitemap(files);
  console.log('Translation build complete.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
