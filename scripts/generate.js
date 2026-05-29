import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const dataDir = path.join(rootDir, 'data');
const templatesDir = path.join(rootDir, 'templates');
const distDir = path.join(rootDir, 'dist');
const siteUrl = 'https://hotelsofathens.com';

// Ensure dist directories exist
const dirs = ['dist', 'dist/athens-hotels', 'dist/hotel', 'dist/css', 'dist/images'];
dirs.forEach(dir => {
  const fullPath = path.join(rootDir, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

// Load templates
const layoutTemplate = fs.readFileSync(path.join(templatesDir, 'layout.html'), 'utf8');
const homeTemplate = fs.readFileSync(path.join(templatesDir, 'home.html'), 'utf8');
const neighborhoodTemplate = fs.readFileSync(path.join(templatesDir, 'neighborhood.html'), 'utf8');
const hotelTemplate = fs.readFileSync(path.join(templatesDir, 'hotel.html'), 'utf8');
const contactTemplate = fs.readFileSync(path.join(templatesDir, 'contact.html'), 'utf8');
const thankYouTemplate = fs.readFileSync(path.join(templatesDir, 'thank-you.html'), 'utf8');

// Load data
const allHotelsData = JSON.parse(fs.readFileSync(path.join(dataDir, 'all-hotels.json'), 'utf8'));
const neighborhoodsData = JSON.parse(fs.readFileSync(path.join(dataDir, 'neighborhoods.json'), 'utf8'));
const currentYear = new Date().getFullYear();
const lastUpdated = allHotelsData.lastUpdated || new Date().toISOString().split('T')[0];

// Helper: Wrap content in layout
function wrapInLayout(content, title, description, url, options = {}) {
  const fullTitle = title.includes('Hotels of Athens') ? title : `${title} | Hotels of Athens`;
  const schema = buildStructuredData(options.schema || []);

  return layoutTemplate
    .replace(/\{\{PAGE_TITLE\}\}/g, title)
    .replace(/\{\{FULL_PAGE_TITLE\}\}/g, fullTitle)
    .replace(/\{\{PAGE_DESCRIPTION\}\}/g, description)
    .replace(/\{\{PAGE_URL\}\}/g, url)
    .replace(/\{\{OG_TYPE\}\}/g, options.ogType || 'website')
    .replace('{{STRUCTURED_DATA}}', schema)
    .replace('{{CONTENT}}', content);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildStructuredData(extraSchemas) {
  const base = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Hotels of Athens',
      url: siteUrl,
      description: 'Compare Athens hotels by neighborhood, price, Acropolis views, rooftop bars, and traveler fit.'
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Hotels of Athens',
      url: siteUrl,
      logo: `${siteUrl}/images/og.jpg`
    }
  ];

  return JSON.stringify(base.concat(extraSchemas), null, 2);
}

function breadcrumbSchema(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url
    }))
  };
}

function faqSchema(faqs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer
      }
    }))
  };
}

function itemListSchema(name, hotels, url) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    url,
    numberOfItems: hotels.length,
    itemListElement: hotels.map((hotel, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `${siteUrl}/hotel/${hotel.slug}`,
      name: hotel.name
    }))
  };
}

function pageSchema(type, name, description, url) {
  return {
    '@context': 'https://schema.org',
    '@type': type,
    name,
    description,
    url,
    dateModified: lastUpdated
  };
}

// Helper: Generate star rating
function generateStars(rating) {
  return '★'.repeat(rating) + '☆'.repeat(5 - rating);
}

// Helper: Get price tier
function getPriceTier(price) {
  if (price < 80) return 'budget';
  if (price < 150) return 'mid';
  if (price < 250) return 'upscale';
  return 'luxury';
}

function priceTierLabel(price) {
  const tier = getPriceTier(price);
  return {
    budget: 'Budget',
    mid: 'Mid-range',
    upscale: 'Upscale',
    luxury: 'Luxury'
  }[tier];
}

function uniqueHotels(hotels) {
  const seen = new Set();
  return hotels.filter(hotel => {
    if (seen.has(hotel.slug)) return false;
    seen.add(hotel.slug);
    return true;
  });
}

function hotelUrl(hotel) {
  return `/hotel/${hotel.slug}`;
}

function hotelsForNeighborhood(neighborhoodId) {
  return uniqueHotels(allHotelsData.hotels).filter(hotel => hotel.neighborhood === neighborhoodId);
}

function hotelFitLabel(hotel) {
  if (hotel.hasAcropolisView && hotel.hasRooftopBar) return 'Acropolis-view rooftop stay';
  if (hotel.hasAcropolisView) return 'Acropolis-view base';
  if (hotel.hasRooftopBar) return 'Rooftop bar stay';
  if (hotel.pricePerNight < 80) return 'Budget-friendly base';
  if (hotel.starRating >= 5) return 'Luxury city stay';
  return `${hotel.neighborhoodName || hotel.neighborhood} hotel`;
}

function chooseTopHotels(hotels, limit = 8) {
  return uniqueHotels(hotels)
    .sort((a, b) => {
      const score = h => (h.starRating * 8) + (h.hasAcropolisView ? 9 : 0) + (h.hasRooftopBar ? 8 : 0) + ((h.rooftopRating || 0) * 2) - (h.pricePerNight / 80);
      return score(b) - score(a);
    })
    .slice(0, limit);
}

function renderComparisonTable(rows, columns, caption) {
  return `
    <div class="table-wrap">
      <table class="comparison-table">
        <caption>${escapeHtml(caption)}</caption>
        <thead>
          <tr>${columns.map(col => `<th scope="col">${escapeHtml(col.label)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              ${columns.map((col, index) => `<td ${index === 0 ? 'data-label="' + escapeHtml(col.label) + '"' : 'data-label="' + escapeHtml(col.label) + '"'}>${row[col.key]}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderHotelComparisonTable(hotels, caption) {
  const rows = hotels.map(hotel => ({
    hotel: `<a href="${hotelUrl(hotel)}">${escapeHtml(hotel.name)}</a>`,
    neighborhood: `<a href="/athens-hotels/${hotel.neighborhood}">${escapeHtml(hotel.neighborhoodName || hotel.neighborhood)}</a>`,
    fit: escapeHtml(hotelFitLabel(hotel)),
    price: `€${hotel.pricePerNight} <span class="muted">/night signal</span>`,
    features: [
      `${hotel.starRating} star`,
      hotel.hasAcropolisView ? 'Acropolis view' : '',
      hotel.hasRooftopBar ? 'Rooftop bar' : ''
    ].filter(Boolean).map(escapeHtml).join('<br>')
  }));

  return renderComparisonTable(rows, [
    { key: 'hotel', label: 'Hotel' },
    { key: 'neighborhood', label: 'Area' },
    { key: 'fit', label: 'Best fit' },
    { key: 'price', label: 'Price' },
    { key: 'features', label: 'Visible signals' }
  ], caption);
}

function renderNeighborhoodMatrix() {
  const rows = neighborhoodsData.neighborhoods.map(hood => {
    const hotels = hotelsForNeighborhood(hood.id);
    return {
      area: `<a href="/athens-hotels/${hood.id}">${escapeHtml(hood.name)}</a>`,
      best: escapeHtml(hood.bestFor.join(', ')),
      price: `€${hood.avgPrice}`,
      count: `${hotels.length}`,
      signals: `${hotels.filter(h => h.hasAcropolisView).length} view / ${hotels.filter(h => h.hasRooftopBar).length} rooftop`
    };
  });

  return renderComparisonTable(rows, [
    { key: 'area', label: 'Area' },
    { key: 'best', label: 'Best for' },
    { key: 'price', label: 'Avg price' },
    { key: 'count', label: 'Tracked hotels' },
    { key: 'signals', label: 'View / rooftop' }
  ], 'Athens hotel neighborhoods compared by fit, price, and visible hotel features.');
}

function renderFaqDetails(faqs) {
  return `
    <div class="faq-list">
      ${faqs.map(faq => `
        <details class="faq-item">
          <summary>${escapeHtml(faq.question)}</summary>
          <p>${escapeHtml(faq.answer)}</p>
        </details>
      `).join('')}
    </div>
  `;
}

// Helper: Generate hotel card HTML
function generateHotelCard(hotel) {
  const badges = [];
  if (hotel.hasAcropolisView) badges.push('<span class="badge badge-view">Acropolis View</span>');
  if (hotel.hasRooftopBar) badges.push('<span class="badge badge-rooftop">Rooftop Bar</span>');
  
  return `
    <a href="/hotel/${hotel.slug}" class="hotel-card" data-tier="${getPriceTier(hotel.pricePerNight)}" data-view="${hotel.hasAcropolisView}">
      <div class="hotel-card-image">🏨</div>
      <div class="hotel-card-content">
        <h3>${hotel.name}</h3>
        <div class="hotel-card-meta">
          <span>${generateStars(hotel.starRating)}</span>
          <span>•</span>
          <span>${hotel.neighborhoodName || hotel.neighborhood}</span>
        </div>
        <div class="hotel-card-badges">${badges.join('')}</div>
        <div class="hotel-card-price">
          <span class="from">from</span>
          <span class="price">€${hotel.pricePerNight}</span>
          <span class="per">/night</span>
        </div>
      </div>
    </a>
  `;
}

// Helper: Generate neighborhood card HTML
function generateNeighborhoodCard(hood) {
  return `
    <a href="/athens-hotels/${hood.id}" class="neighborhood-card">
      <span class="emoji">${hood.emoji}</span>
      <h3>${hood.name}</h3>
      <p class="price">from €${hood.avgPrice}/night</p>
      <p class="walk">${hood.walkToAcropolis} to Acropolis</p>
    </a>
  `;
}

// Generate Homepage
function generateHomepage() {
  console.log('📄 Generating homepage...');
  
  const neighborhoodsGrid = neighborhoodsData.neighborhoods
    .map(generateNeighborhoodCard)
    .join('');
  
  const siteHotels = uniqueHotels(allHotelsData.hotels);

  const acropolisViewHotels = siteHotels
    .filter(h => h.hasAcropolisView)
    .slice(0, 6)
    .map(generateHotelCard)
    .join('');
  
  const rooftopHotels = siteHotels
    .filter(h => h.hasRooftopBar && h.rooftopRating >= 4)
    .slice(0, 6)
    .map(generateHotelCard)
    .join('');
  
  let content = homeTemplate
    .replace(/\{\{TOTAL_HOTELS\}\}/g, allHotelsData.totalHotels)
    .replace('{{AVG_PRICE}}', allHotelsData.avgPrice)
    .replace('{{BUDGET_COUNT}}', allHotelsData.priceStats.budget.count)
    .replace('{{MID_COUNT}}', allHotelsData.priceStats.midRange.count)
    .replace('{{UPSCALE_COUNT}}', allHotelsData.priceStats.upscale.count)
    .replace('{{LUXURY_COUNT}}', allHotelsData.priceStats.luxury.count)
    .replace('{{NEIGHBORHOOD_MATRIX}}', renderNeighborhoodMatrix())
    .replace('{{NEIGHBORHOODS_GRID}}', neighborhoodsGrid)
    .replace('{{ACROPOLIS_VIEW_HOTELS}}', acropolisViewHotels)
    .replace('{{ROOFTOP_HOTELS}}', rooftopHotels);
  
  const title = 'Athens Hotels by Area & Budget';
  const description = `Compare ${allHotelsData.totalHotels} Athens hotels by neighborhood, nightly price signal, Acropolis view, rooftop bar, and traveler fit.`;
  const url = `${siteUrl}/`;

  const html = wrapInLayout(
    content,
    title,
    description,
    url,
    {
      schema: [
        pageSchema('CollectionPage', title, description, url),
        itemListSchema('Featured Athens hotels', chooseTopHotels(siteHotels, 10), url)
      ]
    }
  );
  
  fs.writeFileSync(path.join(distDir, 'index.html'), html);
}

// Generate Neighborhood Pages
function generateNeighborhoodPages() {
  console.log('📄 Generating neighborhood pages...');
  
  for (const hood of neighborhoodsData.neighborhoods) {
    const hoodData = JSON.parse(
      fs.readFileSync(path.join(dataDir, 'hotels', `${hood.id}.json`), 'utf8')
    );
    
    const hoodHotels = hotelsForNeighborhood(hood.id);
    const hotelsGrid = hoodHotels
      .map(generateHotelCard)
      .join('');

    const fitHotels = chooseTopHotels(hoodHotels, Math.min(hoodHotels.length, 6));
    const fitTable = renderHotelComparisonTable(
      fitHotels,
      `${hood.name} hotels compared by price, traveler fit, Acropolis-view signal, and rooftop-bar signal.`
    );
    
    const vibeTags = hood.vibe
      .map(v => `<span class="vibe-tag">${v}</span>`)
      .join('');
    
    // Get nearby neighborhoods (exclude current)
    const nearby = neighborhoodsData.neighborhoods
      .filter(n => n.id !== hood.id)
      .slice(0, 4)
      .map(generateNeighborhoodCard)
      .join('');
    
    // FAQ content
    const cheapest = [...hoodHotels].sort((a, b) => a.pricePerNight - b.pricePerNight)[0];
    const viewCount = hoodHotels.filter(h => h.hasAcropolisView).length;
    const rooftopCount = hoodHotels.filter(h => h.hasRooftopBar).length;
    const quickAnswer = `${hood.name} is a ${hood.tagline.toLowerCase()} area with ${hoodHotels.length} tracked hotels averaging about €${hood.avgPrice}/night. In this dataset, ${viewCount} hotel${viewCount === 1 ? '' : 's'} show an Acropolis-view signal and ${rooftopCount} hotel${rooftopCount === 1 ? '' : 's'} show a rooftop-bar signal. The lowest tracked nightly price signal is ${cheapest ? `€${cheapest.pricePerNight} at ${cheapest.name}` : `around €${hood.avgPrice}`}.`;
    const faqGoodArea = `Yes. ${hood.name} is ${hood.description.split('.')[0].toLowerCase()}. It is especially useful for ${hood.bestFor.join(', ').toLowerCase()}.`;
    const faqDistance = `${hood.name} is listed as ${hood.walkToAcropolis} from the Acropolis in the Hotels of Athens neighborhood data. Exact walking time depends on the individual hotel address and entrance used.`;
    const faqPrice = `Tracked hotels in ${hood.name} average around €${hood.avgPrice} per night, with the visible dataset spanning ${hoodHotels.length} options. Confirm live rates before booking.`;
    const faqs = [
      { question: `Is ${hood.name} a good area to stay in Athens?`, answer: faqGoodArea },
      { question: `How far is ${hood.name} from the Acropolis?`, answer: `${hood.name} is ${hood.walkToAcropolis} walk from the Acropolis. ${faqDistance}` },
      { question: `What's the average hotel price in ${hood.name}?`, answer: `Hotels in ${hood.name} average around €${hood.avgPrice} per night. ${faqPrice}` }
    ];
    
    let content = neighborhoodTemplate
      .replace(/\{\{NAME\}\}/g, hood.name)
      .replace(/\{\{EMOJI\}\}/g, hood.emoji)
      .replace(/\{\{TAGLINE\}\}/g, hood.tagline)
      .replace(/\{\{DESCRIPTION\}\}/g, hood.description)
      .replace(/\{\{HOTEL_COUNT\}\}/g, hoodHotels.length)
      .replace(/\{\{AVG_PRICE\}\}/g, hood.avgPrice)
      .replace(/\{\{WALK_TIME\}\}/g, hood.walkToAcropolis)
      .replace('{{VIBE_TAGS}}', vibeTags)
      .replace(/\{\{BEST_FOR\}\}/g, hood.bestFor.join(', '))
      .replace('{{HOTELS_GRID}}', hotelsGrid)
      .replace('{{NEARBY_NEIGHBORHOODS}}', nearby)
      .replace('{{QUICK_ANSWER}}', quickAnswer)
      .replace('{{FIT_TABLE}}', fitTable)
      .replace('{{BEST_FOR_LOWER}}', hood.bestFor.join(', ').toLowerCase())
      .replace('{{FAQ_GOOD_AREA}}', faqGoodArea)
      .replace('{{FAQ_DISTANCE}}', faqDistance)
      .replace('{{FAQ_PRICE}}', faqPrice);

    const title = `Hotels in ${hood.name} Athens: Compare Stays`;
    const description = `Compare hotels in ${hood.name}, Athens by price, traveler fit, Acropolis-view signal, rooftop bar, and nearby alternatives. ${hoodHotels.length} tracked stays from about €${hood.avgPrice}/night.`;
    const url = `${siteUrl}/athens-hotels/${hood.id}`;
    
    const html = wrapInLayout(
      content,
      title,
      description,
      url,
      {
        schema: [
          pageSchema('CollectionPage', title, description, url),
          breadcrumbSchema([
            { name: 'Home', url: siteUrl },
            { name: 'Athens Hotels', url: `${siteUrl}/where-to-stay-in-athens` },
            { name: hood.name, url }
          ]),
          itemListSchema(`${hood.name} Athens hotels`, fitHotels, url),
          faqSchema(faqs)
        ]
      }
    );
    
    fs.writeFileSync(path.join(distDir, 'athens-hotels', `${hood.id}.html`), html);
  }
}

// Generate Hotel Pages
function generateHotelPages() {
  console.log('📄 Generating hotel pages...');
  
  for (const hotel of uniqueHotels(allHotelsData.hotels)) {
    const amenitiesHtml = (hotel.amenities || [])
      .map(a => `<span class="amenity">${a}</span>`)
      .join('');
    
    const prosHtml = (hotel.pros || ['Great location', 'Good value'])
      .map(p => `<li>${p}</li>`)
      .join('');
    
    const consHtml = (hotel.cons || ['Book early'])
      .map(c => `<li>${c}</li>`)
      .join('');
    
    const badges = [];
    if (hotel.hasAcropolisView) badges.push('<span class="hotel-badge">🏛️ Acropolis View</span>');
    if (hotel.hasRooftopBar) badges.push('<span class="hotel-badge">🍸 Rooftop Bar</span>');
    if (hotel.starRating >= 5) badges.push('<span class="hotel-badge">👑 Luxury</span>');
    
    const bestForTags = (hotel.bestFor || ['Travelers'])
      .map(b => `<span class="best-for-tag">${b}</span>`)
      .join('');

    const fitSummary = `${hotel.name} is a ${hotel.starRating}-star ${priceTierLabel(hotel.pricePerNight).toLowerCase()} price-signal hotel in ${hotel.neighborhoodName}, with ${hotel.hasAcropolisView ? 'an Acropolis-view signal' : 'no Acropolis-view signal in the current dataset'} and ${hotel.hasRooftopBar ? 'a rooftop-bar signal' : 'no rooftop-bar signal in the current dataset'}. It is tagged for ${(hotel.bestFor || ['travelers']).join(', ').toLowerCase()}.`;
    const rooftopLink = hotel.hasRooftopBar
      ? `Compare it with other <a href="/best-rooftop-bars-athens">Athens rooftop bar hotels</a>.`
      : `For rooftop stays, compare <a href="/best-rooftop-bars-athens">Athens rooftop bar hotels</a>.`;
    
    // Get similar hotels in same neighborhood
    const similarHotels = uniqueHotels(allHotelsData.hotels)
      .filter(h => h.neighborhood === hotel.neighborhood && h.id !== hotel.id)
      .slice(0, 3)
      .map(generateHotelCard)
      .join('');
    
    let content = hotelTemplate
      .replace(/\{\{NAME\}\}/g, hotel.name)
      .replace(/\{\{NEIGHBORHOOD_ID\}\}/g, hotel.neighborhood)
      .replace(/\{\{NEIGHBORHOOD_NAME\}\}/g, hotel.neighborhoodName || hotel.neighborhood)
      .replace('{{STARS}}', generateStars(hotel.starRating))
      .replace('{{STAR_RATING}}', hotel.starRating)
      .replace('{{BADGES}}', badges.join(''))
      .replace(/\{\{PRICE\}\}/g, hotel.pricePerNight)
      .replace('{{PRICE_MIN}}', Math.round(hotel.pricePerNight * 0.8))
      .replace('{{PRICE_MAX}}', Math.round(hotel.pricePerNight * 1.5))
      .replace('{{OVERVIEW}}', hotel.overview || `${hotel.name} is a ${hotel.starRating}-star hotel in ${hotel.neighborhoodName}, Athens.`)
      .replace('{{AMENITIES}}', amenitiesHtml)
      .replace('{{PROS}}', prosHtml)
      .replace('{{CONS}}', consHtml)
      .replace('{{LOCATION_DESC}}', `${hotel.distanceToAcropolis} walk to the Acropolis.`)
      .replace('{{DISTANCE_ACROPOLIS}}', hotel.distanceToAcropolis)
      .replace('{{DISTANCE_METRO}}', '5-10 min')
      .replace('{{HAS_VIEW}}', hotel.hasAcropolisView ? 'Yes ✓' : 'No')
      .replace('{{HAS_ROOFTOP}}', hotel.hasRooftopBar ? 'Yes ✓' : 'No')
      .replace('{{BEST_FOR_TAGS}}', bestForTags)
      .replace(/\{\{FIT_SUMMARY\}\}/g, fitSummary)
      .replace('{{ROOFTOP_LINK}}', rooftopLink)
      .replace('{{LAST_VERIFIED}}', hotel.lastVerified || lastUpdated)
      .replace('{{SIMILAR_HOTELS}}', similarHotels)
      .replace('{{BOOKING_URL}}', `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(hotel.name + ' Athens')}`);

    const title = `${hotel.name}: ${hotel.neighborhoodName} Hotel from €${hotel.pricePerNight}`;
    const description = `${hotel.name} is a ${hotel.starRating}-star hotel in ${hotel.neighborhoodName}, Athens with ${hotel.hasAcropolisView ? 'Acropolis-view' : 'neighborhood'} and ${hotel.hasRooftopBar ? 'rooftop-bar' : 'amenity'} signals. Compare fit, price, and nearby hotels.`;
    const url = `${siteUrl}/hotel/${hotel.slug}`;
    
    const html = wrapInLayout(
      content,
      title,
      description,
      url,
      {
        schema: [
          pageSchema('WebPage', title, description, url),
          breadcrumbSchema([
            { name: 'Home', url: siteUrl },
            { name: hotel.neighborhoodName, url: `${siteUrl}/athens-hotels/${hotel.neighborhood}` },
            { name: hotel.name, url }
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'Hotel',
            name: hotel.name,
            url,
            starRating: {
              '@type': 'Rating',
              ratingValue: hotel.starRating
            },
            priceRange: `from €${hotel.pricePerNight}`,
            containedInPlace: {
              '@type': 'Place',
              name: `${hotel.neighborhoodName}, Athens`
            }
          }
        ]
      }
    );
    
    fs.writeFileSync(path.join(distDir, 'hotel', `${hotel.slug}.html`), html);
  }
}

// Generate Contact Page
function generateContactPage() {
  console.log('📄 Generating contact page...');
  
  const formspreeId = process.env.FORMSPREE_ID || 'xnjzokwn';
  
  const content = contactTemplate.replace('{{FORMSPREE_ID}}', formspreeId);
  
  const html = wrapInLayout(
    content,
    'Contact Us',
    'Questions about Athens hotels? Contact the Hotels of Athens team for personalized recommendations.',
    'https://hotelsofathens.com/contact'
  );
  
  fs.writeFileSync(path.join(distDir, 'contact.html'), html);
}

// Generate Thank You Page
function generateThankYouPage() {
  console.log('📄 Generating thank you page...');
  
  const html = wrapInLayout(
    thankYouTemplate,
    'Message Sent',
    'Thank you for contacting Hotels of Athens.',
    'https://hotelsofathens.com/thank-you'
  );
  
  fs.writeFileSync(path.join(distDir, 'thank-you.html'), html);
}

// Generate Guide Pages
function generateGuidePages() {
  console.log('📄 Generating guide pages...');

  const guideSchema = (title, description, url, hotels, faqs = []) => [
    pageSchema('CollectionPage', title, description, url),
    breadcrumbSchema([
      { name: 'Home', url: siteUrl },
      { name: title.replace(` (${currentYear})`, ''), url }
    ]),
    ...(hotels?.length ? [itemListSchema(title, hotels.slice(0, 12), url)] : []),
    ...(faqs.length ? [faqSchema(faqs)] : [])
  ];

  const siteHotels = uniqueHotels(allHotelsData.hotels);

  const neighborhoodHighlights = neighborhoodsData.neighborhoods.map(hood => {
    const hotels = siteHotels.filter(h => h.neighborhood === hood.id);
    const top = chooseTopHotels(hotels, 1)[0];
    return `
      <article class="area-panel">
        <div>
          <span class="area-emoji">${hood.emoji}</span>
          <h3><a href="/athens-hotels/${hood.id}">${hood.name}</a></h3>
          <p>${escapeHtml(hood.description)}</p>
        </div>
        <dl class="signal-list">
          <div><dt>Best for</dt><dd>${escapeHtml(hood.bestFor.join(', '))}</dd></div>
          <div><dt>Avg price</dt><dd>€${hood.avgPrice}/night</dd></div>
          <div><dt>Acropolis</dt><dd>${escapeHtml(hood.walkToAcropolis)}</dd></div>
          <div><dt>Starter pick</dt><dd>${top ? `<a href="${hotelUrl(top)}">${escapeHtml(top.name)}</a>` : 'See hotels'}</dd></div>
        </dl>
      </article>
    `;
  }).join('');

  // Where to Stay Guide
  const whereTitle = 'Where to Stay in Athens: Area Guide';
  const whereDescription = `Compare where to stay in Athens by neighborhood, budget, Acropolis access, nightlife, ferry transfers, and hotel fit. Includes ${allHotelsData.totalHotels} tracked hotels.`;
  const whereUrl = `${siteUrl}/where-to-stay-in-athens`;
  const whereFaqs = [
    {
      question: 'What is the best area to stay in Athens for first-timers?',
      answer: 'Plaka is the easiest first-timer base for historic atmosphere and short Acropolis access, while Monastiraki is better for markets and nightlife and Syntagma is better for transport connections.'
    },
    {
      question: 'Where should I stay in Athens for a ferry?',
      answer: 'Piraeus is the practical choice for early ferry departures. If you want central Athens first, choose Syntagma or Monastiraki and check the exact metro or taxi route before booking.'
    },
    {
      question: 'Which Athens neighborhoods are best for budget hotels?',
      answer: 'Exarchia, Koukaki, Piraeus, and parts of Monastiraki have the strongest budget signals in the Hotels of Athens dataset.'
    }
  ];
  const whereContent = `
    <section class="guide-hero">
      <div class="container">
        <nav class="breadcrumb"><a href="/">Home</a> → <span>Where to Stay in Athens</span></nav>
        <h1>Where to Stay in Athens</h1>
        <p>Compare Athens neighborhoods by traveler fit, price signal, Acropolis access, and the hotels tracked on this site.</p>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <div class="quick-answer">
          <p class="eyebrow">Quick answer</p>
          <h2>Choose Plaka for classic Athens, Monastiraki for energy, Syntagma for connections, and Koukaki for quieter value.</h2>
          <p>For most first trips, start with Plaka, Monastiraki, Syntagma, or Koukaki. Island hoppers should compare Piraeus, nightlife travelers should compare Psyrri and Monastiraki, and luxury travelers should compare Syntagma, Kolonaki, and Plaka.</p>
        </div>
      </div>
    </section>
    <section class="section section-alt">
      <div class="container">
        <h2 class="section-title">Athens Areas Compared</h2>
        <p class="section-subtitle">This matrix uses the visible Hotels of Athens neighborhood and hotel data.</p>
        ${renderNeighborhoodMatrix()}
      </div>
    </section>
    <section class="section">
      <div class="container">
        <h2 class="section-title">Neighborhood-by-Neighborhood Guide</h2>
        <div class="area-stack">${neighborhoodHighlights}</div>
      </div>
    </section>
    <section class="section section-alt">
      <div class="container">
        <h2 class="section-title">Best Area by Trip Type</h2>
        <div class="content-grid">
          <div class="info-panel"><h3>First-timers</h3><p><a href="/athens-hotels/plaka">Plaka</a> keeps the historic core close. <a href="/athens-hotels/monastiraki">Monastiraki</a> is a stronger pick if you want markets, metro, and nightlife.</p></div>
          <div class="info-panel"><h3>Luxury stays</h3><p><a href="/athens-hotels/syntagma">Syntagma</a>, <a href="/athens-hotels/kolonaki">Kolonaki</a>, and Plaka have the strongest upscale and luxury hotel signals in the dataset.</p></div>
          <div class="info-panel"><h3>Budget trips</h3><p><a href="/athens-hotels/exarchia">Exarchia</a>, <a href="/athens-hotels/koukaki">Koukaki</a>, Monastiraki, and <a href="/athens-hotels/piraeus">Piraeus</a> are the natural places to compare first.</p></div>
          <div class="info-panel"><h3>Rooftop views</h3><p>Compare <a href="/best-rooftop-bars-athens">Athens rooftop bar hotels</a> if sunset views and on-site rooftop dining matter more than neighborhood alone.</p></div>
        </div>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <h2 class="section-title">FAQs: Where to Stay in Athens</h2>
        ${renderFaqDetails(whereFaqs)}
      </div>
    </section>
  `;

  fs.writeFileSync(
    path.join(distDir, 'where-to-stay-in-athens.html'),
    wrapInLayout(whereContent, whereTitle, whereDescription, whereUrl, {
      schema: guideSchema(whereTitle, whereDescription, whereUrl, siteHotels, whereFaqs)
    })
  );

  // Best Hotels Guide
  const bestHotels = chooseTopHotels(siteHotels, 14);
  const bestTitle = 'Best Hotels in Athens: Fit, Price & View';
  const bestDescription = `Compare the best Athens hotel starting points by criteria: neighborhood, price signal, star category, Acropolis view, rooftop bar, and traveler fit.`;
  const bestUrl = `${siteUrl}/best-hotels-athens`;
  const bestFaqs = [
    {
      question: 'How does Hotels of Athens choose top hotel picks?',
      answer: 'The guide uses visible site data including neighborhood, nightly price signal, star category, Acropolis-view flag, rooftop-bar flag, amenities, and traveler-fit tags. It does not use unsupported review scores.'
    },
    {
      question: 'What is the best Athens hotel area for Acropolis views?',
      answer: 'Plaka, Monastiraki, Syntagma, and Koukaki have the strongest Acropolis-view hotel signals in this dataset.'
    },
    {
      question: 'Should I book a luxury or boutique hotel in Athens?',
      answer: 'Choose luxury if you want larger service infrastructure and premium amenities; choose boutique if neighborhood character, design, and a smaller hotel feel matter more.'
    }
  ];
  const bestContent = `
    <section class="guide-hero">
      <div class="container">
        <nav class="breadcrumb"><a href="/">Home</a> → <span>Best Hotels in Athens</span></nav>
        <h1>Best Hotels in Athens</h1>
        <p>Criteria-based hotel picks using visible Hotels of Athens data, not unsupported ratings or copied listicles.</p>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <div class="quick-answer">
          <p class="eyebrow">Quick answer</p>
          <h2>Start with hotels that match your area, budget, and view priorities.</h2>
          <p>For luxury and landmark convenience, compare Hotel Grande Bretagne, King George Athens, and Electra Palace Athens. For rooftop views at a lower price signal, compare A for Athens, 360 Degrees Hotel, Herodion Hotel, and Plaka Hotel. For budget stays, compare Athens Backpackers, City Circus Athens, Marble House, Orion Hotel, and Attalos Hotel.</p>
        </div>
      </div>
    </section>
    <section class="section section-alt">
      <div class="container">
        <h2 class="section-title">Top Athens Hotel Starting Points</h2>
        <p class="section-subtitle">Sorted by a transparent mix of visible star category, rooftop/view signals, traveler-fit tags, and price signal.</p>
        ${renderHotelComparisonTable(bestHotels, 'Criteria-based Athens hotel picks from the Hotels of Athens dataset.')}
      </div>
    </section>
    <section class="section">
      <div class="container">
        <h2 class="section-title">Best Athens Hotels by Traveler Type</h2>
        <div class="content-grid">
          <div class="info-panel"><h3>Best for classic luxury</h3><p><a href="/hotel/hotel-grande-bretagne-athens">Hotel Grande Bretagne</a>, <a href="/hotel/king-george-athens-athens">King George Athens</a>, and <a href="/hotel/electra-palace-athens-athens">Electra Palace Athens</a> have the strongest luxury price/star signals.</p></div>
          <div class="info-panel"><h3>Best for rooftop views</h3><p><a href="/hotel/a-for-athens-athens">A for Athens</a>, <a href="/hotel/360-degrees-hotel-athens">360 Degrees Hotel</a>, and <a href="/hotel/herodion-hotel-athens">Herodion Hotel</a> combine rooftop and Acropolis-view signals.</p></div>
          <div class="info-panel"><h3>Best for budget</h3><p><a href="/hotel/athens-backpackers-athens">Athens Backpackers</a>, <a href="/hotel/city-circus-athens-athens">City Circus Athens</a>, and <a href="/hotel/marble-house-athens">Marble House</a> show the lowest nightly price signals.</p></div>
          <div class="info-panel"><h3>Best for location-first trips</h3><p>Compare <a href="/athens-hotels/plaka">Plaka</a>, <a href="/athens-hotels/monastiraki">Monastiraki</a>, and <a href="/athens-hotels/syntagma">Syntagma</a> when walking access and centrality matter most.</p></div>
        </div>
      </div>
    </section>
    <section class="section section-alt">
      <div class="container">
        <h2 class="section-title">Methodology</h2>
        <div class="methodology">
          <p>This page is a comparison guide, not a review-award list. Hotels are surfaced from the first-party dataset using visible criteria: neighborhood, price signal, star category, Acropolis-view flag, rooftop-bar flag, amenities, and traveler-fit tags. Live rates, room inventory, rooftop access, and policies can change, so confirm final details before booking.</p>
        </div>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <h2 class="section-title">FAQs: Best Hotels in Athens</h2>
        ${renderFaqDetails(bestFaqs)}
      </div>
    </section>
  `;

  fs.writeFileSync(
    path.join(distDir, 'best-hotels-athens.html'),
    wrapInLayout(bestContent, bestTitle, bestDescription, bestUrl, {
      schema: guideSchema(bestTitle, bestDescription, bestUrl, bestHotels, bestFaqs)
    })
  );

  // Budget Hotels Guide
  const budgetHotels = siteHotels
    .filter(h => h.pricePerNight < 80)
    .sort((a, b) => a.pricePerNight - b.pricePerNight);
  
  const budgetFaqs = [
    {
      question: 'What counts as a budget hotel in Athens on this site?',
      answer: 'Hotels of Athens labels hotels under €80/night as budget based on the visible nightly price signal stored in the dataset.'
    },
    {
      question: 'Which Athens neighborhoods have the most budget hotel signals?',
      answer: 'Exarchia has the most tracked budget options in this dataset, followed by Monastiraki, Koukaki, and Piraeus.'
    }
  ];
  const budgetTitle = 'Budget Hotels in Athens Under €80';
  const budgetDescription = `Compare budget hotels in Athens under €80/night by neighborhood, star category, traveler fit, and Acropolis or rooftop signals.`;
  const budgetUrl = `${siteUrl}/budget-hotels-athens`;
  const budgetContent = `
    <section class="guide-hero">
      <div class="container">
        <h1>Budget Hotels in Athens</h1>
        <p>Compare tracked Athens stays under €80/night by area, fit, and visible hotel features.</p>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <div class="quick-answer">
          <p class="eyebrow">Quick answer</p>
          <h2>The lowest price signals cluster in Exarchia, Monastiraki, Koukaki, and Piraeus.</h2>
          <p>Use this page when price is the first filter. For historic sightseeing, compare budget options in Monastiraki and Koukaki; for ferry logistics, compare Piraeus; for the lowest visible cluster, compare Exarchia.</p>
        </div>
      </div>
    </section>
    <section class="section section-alt">
      <div class="container">
        <h2 class="section-title">Budget Hotel Comparison</h2>
        ${renderHotelComparisonTable(budgetHotels, 'Athens hotels under €80/night in the Hotels of Athens dataset.')}
      </div>
    </section>
    <section class="section">
      <div class="container">
        <h2 class="section-title">Budget Booking Notes</h2>
        <div class="content-grid">
          <div class="info-panel"><h3>Check the exact location</h3><p>A lower rate can mean a longer walk, a busier nightlife area, or a port-first location. Compare the neighborhood page before booking.</p></div>
          <div class="info-panel"><h3>Compare cancellation terms</h3><p>The stored price signal is not a live quote. Confirm taxes, cancellation policy, and room type on the booking page.</p></div>
          <div class="info-panel"><h3>Watch view tradeoffs</h3><p>Budget hotels rarely combine low price, central location, and premium views. If the view matters, compare <a href="/best-rooftop-bars-athens">rooftop bar hotels</a>.</p></div>
        </div>
      </div>
    </section>
    <section class="section section-alt">
      <div class="container">
        <h2 class="section-title">All Budget Picks</h2>
        <div class="hotels-grid">${budgetHotels.map(generateHotelCard).join('')}</div>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <h2 class="section-title">FAQs: Budget Hotels in Athens</h2>
        ${renderFaqDetails(budgetFaqs)}
      </div>
    </section>
  `;
  
  fs.writeFileSync(
    path.join(distDir, 'budget-hotels-athens.html'),
    wrapInLayout(budgetContent, budgetTitle, budgetDescription, budgetUrl, {
      schema: guideSchema(budgetTitle, budgetDescription, budgetUrl, budgetHotels, budgetFaqs)
    })
  );
  
  // Luxury Hotels Guide
  const luxuryHotels = siteHotels
    .filter(h => h.pricePerNight >= 200)
    .sort((a, b) => b.pricePerNight - a.pricePerNight);
  
  const luxuryFaqs = [
    {
      question: 'Which Athens neighborhoods are best for luxury hotels?',
      answer: 'Syntagma, Plaka, and Kolonaki have the strongest luxury hotel signals in the current Hotels of Athens dataset.'
    },
    {
      question: 'Do luxury Athens hotels usually have Acropolis views?',
      answer: 'Many tracked luxury-price hotels show an Acropolis-view signal, but it depends on room type and availability. Confirm the exact room view before booking.'
    }
  ];
  const luxuryTitle = 'Luxury Hotels in Athens: 5-Star Stays';
  const luxuryDescription = `Compare luxury hotels in Athens by neighborhood, price signal, Acropolis view, rooftop bar, amenities, and traveler fit.`;
  const luxuryUrl = `${siteUrl}/luxury-hotels-athens`;
  const luxuryContent = `
    <section class="guide-hero">
      <div class="container">
        <h1>Luxury Hotels in Athens</h1>
        <p>Compare premium Athens stays by area, view signal, rooftop signal, and traveler fit.</p>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <div class="quick-answer">
          <p class="eyebrow">Quick answer</p>
          <h2>Start with Syntagma, Plaka, and Kolonaki for the strongest luxury signals.</h2>
          <p>Hotel Grande Bretagne and King George Athens carry the highest nightly price signals in Syntagma. Electra Palace Athens anchors luxury Plaka with both Acropolis-view and rooftop-bar signals, while St. George Lycabettus gives Kolonaki a premium rooftop-view option.</p>
        </div>
      </div>
    </section>
    <section class="section section-alt">
      <div class="container">
        <h2 class="section-title">Luxury Hotel Comparison</h2>
        ${renderHotelComparisonTable(luxuryHotels, 'Luxury-price Athens hotels compared by fit, area, view, and rooftop signals.')}
      </div>
    </section>
    <section class="section">
      <div class="container">
        <h2 class="section-title">Luxury Decision Guide</h2>
        <div class="content-grid">
          <div class="info-panel"><h3>Choose Syntagma if</h3><p>You want classic city-center luxury, Parliament/Syntagma access, shopping, and strong transport links.</p></div>
          <div class="info-panel"><h3>Choose Plaka if</h3><p>You want historic atmosphere, Acropolis access, and a premium stay embedded in the old city.</p></div>
          <div class="info-panel"><h3>Choose Kolonaki if</h3><p>You want a more polished neighborhood base with boutiques, cafes, and Lycabettus-side atmosphere.</p></div>
        </div>
      </div>
    </section>
    <section class="section section-alt">
      <div class="container">
        <h2 class="section-title">All Luxury Picks</h2>
        <div class="hotels-grid">${luxuryHotels.map(generateHotelCard).join('')}</div>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <h2 class="section-title">FAQs: Luxury Hotels in Athens</h2>
        ${renderFaqDetails(luxuryFaqs)}
      </div>
    </section>
  `;
  
  fs.writeFileSync(
    path.join(distDir, 'luxury-hotels-athens.html'),
    wrapInLayout(luxuryContent, luxuryTitle, luxuryDescription, luxuryUrl, {
      schema: guideSchema(luxuryTitle, luxuryDescription, luxuryUrl, luxuryHotels, luxuryFaqs)
    })
  );
  
  // Rooftop Bars Guide
  const rooftopHotels = siteHotels
    .filter(h => h.hasRooftopBar)
    .sort((a, b) => (b.rooftopRating || 0) - (a.rooftopRating || 0) || a.pricePerNight - b.pricePerNight);
  
  const rooftopRows = rooftopHotels.map(hotel => ({
    hotel: `<a href="${hotelUrl(hotel)}">${escapeHtml(hotel.name)}</a>`,
    area: `<a href="/athens-hotels/${hotel.neighborhood}">${escapeHtml(hotel.neighborhoodName)}</a>`,
    view: hotel.hasAcropolisView ? 'Acropolis-view signal' : 'City-view / confirm view',
    score: hotel.rooftopRating ? `${hotel.rooftopRating}/5 site rooftop signal` : 'Rooftop listed',
    price: `€${hotel.pricePerNight}`,
    fit: escapeHtml((hotel.bestFor || ['Travelers']).join(', '))
  }));
  const rooftopTable = renderComparisonTable(rooftopRows, [
    { key: 'hotel', label: 'Hotel' },
    { key: 'area', label: 'Area' },
    { key: 'view', label: 'View signal' },
    { key: 'score', label: 'Rooftop signal' },
    { key: 'price', label: 'Price' },
    { key: 'fit', label: 'Best for' }
  ], 'Athens hotels with rooftop-bar signals compared by view, area, and price.');

  const rooftopFaqs = [
    {
      question: 'Which Athens hotel areas are best for rooftop bars?',
      answer: 'Plaka, Monastiraki, Syntagma, Kolonaki, Psyrri, Koukaki, and Exarchia all have tracked rooftop-bar hotel signals in the dataset, with Plaka, Monastiraki, and Syntagma carrying the strongest central sightseeing context.'
    },
    {
      question: 'Do all rooftop bar hotels have Acropolis views?',
      answer: 'No. The page separates rooftop-bar signal from Acropolis-view signal because a hotel can have one without the other. Confirm the exact room, terrace, or restaurant view before booking.'
    },
    {
      question: 'Are Athens hotel rooftop bars open to non-guests?',
      answer: 'Access rules can change by property, date, and event. Confirm directly with the hotel before planning around a rooftop visit.'
    }
  ];
  const rooftopTitle = 'Athens Hotels with Rooftop Bars';
  const rooftopDescription = `Compare Athens hotels with rooftop-bar signals by neighborhood, Acropolis-view signal, rooftop score, price tier, and traveler fit.`;
  const rooftopUrl = `${siteUrl}/best-rooftop-bars-athens`;
  const rooftopContent = `
    <section class="guide-hero">
      <div class="container">
        <h1>Athens Hotels with Rooftop Bars</h1>
        <p>Compare rooftop-bar hotels by Acropolis-view signal, neighborhood, and nightly price signal.</p>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <div class="quick-answer">
          <p class="eyebrow">Quick answer</p>
          <h2>For rooftop plus Acropolis-view signals, start with Electra Palace Athens, A for Athens, Hotel Grande Bretagne, King George Athens, St. George Lycabettus, Herodion Hotel, AVA Hotel Athens, and 360 Degrees Hotel.</h2>
          <p>This guide separates three things travelers often mix together: whether a hotel has a rooftop bar, whether the data shows an Acropolis-view signal, and what nightly price tier it sits in.</p>
        </div>
      </div>
    </section>
    <section class="section section-alt">
      <div class="container">
        <h2 class="section-title">Rooftop Hotel Comparison Table</h2>
        ${rooftopTable}
      </div>
    </section>
    <section class="section">
      <div class="container">
        <h2 class="section-title">How to Choose a Rooftop Hotel in Athens</h2>
        <div class="content-grid">
          <div class="info-panel"><h3>View first</h3><p>Choose hotels with both rooftop-bar and Acropolis-view signals if the skyline is the priority. Confirm the exact terrace or room view before booking.</p></div>
          <div class="info-panel"><h3>Area first</h3><p>Plaka and Monastiraki are better for historic walks; Syntagma is better for central transport and luxury; Kolonaki is better for a polished neighborhood stay.</p></div>
          <div class="info-panel"><h3>Budget first</h3><p>Sort by the nightly price signal, then check whether the rooftop is a bar, restaurant, pool terrace, or seasonal space on the hotel’s booking page.</p></div>
        </div>
      </div>
    </section>
    <section class="section section-alt">
      <div class="container">
        <h2 class="section-title">All Rooftop Bar Hotel Picks</h2>
        <div class="hotels-grid">${rooftopHotels.map(generateHotelCard).join('')}</div>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <h2 class="section-title">FAQs: Athens Rooftop Bar Hotels</h2>
        ${renderFaqDetails(rooftopFaqs)}
      </div>
    </section>
  `;
  
  fs.writeFileSync(
    path.join(distDir, 'best-rooftop-bars-athens.html'),
    wrapInLayout(rooftopContent, rooftopTitle, rooftopDescription, rooftopUrl, {
      schema: guideSchema(rooftopTitle, rooftopDescription, rooftopUrl, rooftopHotels, rooftopFaqs)
    })
  );
}

// Generate Sitemap
function generateSitemap() {
  console.log('📄 Generating sitemap...');
  
  const urls = [
    { loc: 'https://hotelsofathens.com/', priority: '1.0' },
    { loc: 'https://hotelsofathens.com/contact', priority: '0.5' },
    { loc: 'https://hotelsofathens.com/where-to-stay-in-athens', priority: '0.95' },
    { loc: 'https://hotelsofathens.com/best-hotels-athens', priority: '0.95' },
    { loc: 'https://hotelsofathens.com/budget-hotels-athens', priority: '0.8' },
    { loc: 'https://hotelsofathens.com/luxury-hotels-athens', priority: '0.8' },
    { loc: 'https://hotelsofathens.com/best-rooftop-bars-athens', priority: '0.8' },
    ...neighborhoodsData.neighborhoods.map(n => ({
      loc: `https://hotelsofathens.com/athens-hotels/${n.id}`,
      priority: '0.9'
    })),
    ...uniqueHotels(allHotelsData.hotels).map(h => ({
      loc: `https://hotelsofathens.com/hotel/${h.slug}`,
      priority: '0.7'
    }))
  ];
  
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;
  
  fs.writeFileSync(path.join(distDir, 'sitemap.xml'), sitemap);
}

// Generate robots.txt
function generateRobots() {
  console.log('📄 Generating robots.txt...');
  
  const robots = `User-agent: *
Allow: /

Sitemap: https://hotelsofathens.com/sitemap.xml`;
  
  fs.writeFileSync(path.join(distDir, 'robots.txt'), robots);
}

// Generate _headers
function generateHeaders() {
  console.log('📄 Generating _headers...');
  
  const headers = `/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin

/images/*
  Cache-Control: public, max-age=31536000

/css/*
  Cache-Control: public, max-age=31536000`;
  
  fs.writeFileSync(path.join(distDir, '_headers'), headers);
}

// Generate _redirects
function generateRedirects() {
  console.log('📄 Generating _redirects...');
  
  const redirects = `/index.html  /  301
/area/*  /athens-hotels/:splat  301`;
  
  fs.writeFileSync(path.join(distDir, '_redirects'), redirects);
}

// Main
async function main() {
  console.log('🏗️  Generating Hotels of Athens site...\n');
  
  generateHomepage();
  generateNeighborhoodPages();
  generateHotelPages();
  generateContactPage();
  generateThankYouPage();
  generateGuidePages();
  generateSitemap();
  generateRobots();
  generateHeaders();
  generateRedirects();
  
  console.log(`\n✅ Site generated! ${uniqueHotels(allHotelsData.hotels).length} hotel pages created.`);
  console.log(`   Output: ${distDir}`);
}

main().catch(console.error);
