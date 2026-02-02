import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const dataDir = path.join(rootDir, 'data');
const templatesDir = path.join(rootDir, 'templates');
const distDir = path.join(rootDir, 'dist');

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

// Helper: Wrap content in layout
function wrapInLayout(content, title, description, url) {
  return layoutTemplate
    .replace(/\{\{PAGE_TITLE\}\}/g, title)
    .replace(/\{\{PAGE_DESCRIPTION\}\}/g, description)
    .replace(/\{\{PAGE_URL\}\}/g, url)
    .replace('{{CONTENT}}', content);
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

// Helper: Generate hotel card HTML
function generateHotelCard(hotel) {
  const badges = [];
  if (hotel.hasAcropolisView) badges.push('<span class="badge badge-view">🏛️ Acropolis View</span>');
  if (hotel.hasRooftopBar) badges.push('<span class="badge badge-rooftop">🍸 Rooftop Bar</span>');
  
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
  
  const acropolisViewHotels = allHotelsData.hotels
    .filter(h => h.hasAcropolisView)
    .slice(0, 6)
    .map(generateHotelCard)
    .join('');
  
  const rooftopHotels = allHotelsData.hotels
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
    .replace('{{NEIGHBORHOODS_GRID}}', neighborhoodsGrid)
    .replace('{{ACROPOLIS_VIEW_HOTELS}}', acropolisViewHotels)
    .replace('{{ROOFTOP_HOTELS}}', rooftopHotels);
  
  const html = wrapInLayout(
    content,
    'Compare Hotels by Neighborhood',
    `Discover ${allHotelsData.totalHotels}+ Athens hotels. Compare prices, Acropolis views, rooftop bars by neighborhood.`,
    'https://hotelsofathens.com/'
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
    
    const hotelsGrid = hoodData.hotels
      .map(generateHotelCard)
      .join('');
    
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
    const faqGoodArea = `Yes! ${hood.name} is ${hood.description.split('.')[0].toLowerCase()}. It's especially good for ${hood.bestFor.join(', ').toLowerCase()}.`;
    const faqDistance = `Most hotels in ${hood.name} are within easy walking distance of the Acropolis and other major attractions.`;
    const faqPrice = `You can find options ranging from budget hostels to luxury hotels depending on your preferences.`;
    
    let content = neighborhoodTemplate
      .replace(/\{\{NAME\}\}/g, hood.name)
      .replace(/\{\{EMOJI\}\}/g, hood.emoji)
      .replace(/\{\{TAGLINE\}\}/g, hood.tagline)
      .replace(/\{\{DESCRIPTION\}\}/g, hood.description)
      .replace(/\{\{HOTEL_COUNT\}\}/g, hoodData.hotelCount)
      .replace(/\{\{AVG_PRICE\}\}/g, hood.avgPrice)
      .replace(/\{\{WALK_TIME\}\}/g, hood.walkToAcropolis)
      .replace('{{VIBE_TAGS}}', vibeTags)
      .replace('{{BEST_FOR}}', hood.bestFor.join(', '))
      .replace('{{HOTELS_GRID}}', hotelsGrid)
      .replace('{{NEARBY_NEIGHBORHOODS}}', nearby)
      .replace('{{FAQ_GOOD_AREA}}', faqGoodArea)
      .replace('{{FAQ_DISTANCE}}', faqDistance)
      .replace('{{FAQ_PRICE}}', faqPrice);
    
    const html = wrapInLayout(
      content,
      `Hotels in ${hood.name}, Athens`,
      `Find the best hotels in ${hood.name}, Athens. ${hood.tagline}. Compare ${hoodData.hotelCount} hotels from €${hood.avgPrice}/night.`,
      `https://hotelsofathens.com/athens-hotels/${hood.id}`
    );
    
    fs.writeFileSync(path.join(distDir, 'athens-hotels', `${hood.id}.html`), html);
  }
}

// Generate Hotel Pages
function generateHotelPages() {
  console.log('📄 Generating hotel pages...');
  
  for (const hotel of allHotelsData.hotels) {
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
    
    // Get similar hotels in same neighborhood
    const similarHotels = allHotelsData.hotels
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
      .replace('{{SIMILAR_HOTELS}}', similarHotels)
      .replace('{{BOOKING_URL}}', `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(hotel.name + ' Athens')}`);
    
    const html = wrapInLayout(
      content,
      hotel.name,
      `${hotel.name} - ${hotel.starRating}-star hotel in ${hotel.neighborhoodName}, Athens. From €${hotel.pricePerNight}/night. ${hotel.hasAcropolisView ? 'Acropolis views available.' : ''}`,
      `https://hotelsofathens.com/hotel/${hotel.slug}`
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
  
  // Budget Hotels Guide
  const budgetHotels = allHotelsData.hotels
    .filter(h => h.pricePerNight < 80)
    .sort((a, b) => a.pricePerNight - b.pricePerNight)
    .map(generateHotelCard)
    .join('');
  
  const budgetContent = `
    <section class="guide-hero">
      <div class="container">
        <h1>Budget Hotels in Athens</h1>
        <p>Great stays under €80/night</p>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <div class="guide-intro">
          <p>Athens offers excellent budget accommodation without sacrificing location or comfort. These hotels prove you don't need to spend a fortune to enjoy the Greek capital.</p>
        </div>
        <div class="hotels-grid">${budgetHotels}</div>
      </div>
    </section>
  `;
  
  fs.writeFileSync(
    path.join(distDir, 'budget-hotels-athens.html'),
    wrapInLayout(budgetContent, 'Budget Hotels in Athens', 'Find affordable Athens hotels under €80/night. Great locations, clean rooms, excellent value.', 'https://hotelsofathens.com/budget-hotels-athens')
  );
  
  // Luxury Hotels Guide
  const luxuryHotels = allHotelsData.hotels
    .filter(h => h.pricePerNight >= 200)
    .sort((a, b) => b.pricePerNight - a.pricePerNight)
    .map(generateHotelCard)
    .join('');
  
  const luxuryContent = `
    <section class="guide-hero">
      <div class="container">
        <h1>Luxury Hotels in Athens</h1>
        <p>The finest 5-star experiences</p>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <div class="guide-intro">
          <p>Experience Athens in style at these exceptional luxury hotels. World-class service, stunning views, and unforgettable experiences await.</p>
        </div>
        <div class="hotels-grid">${luxuryHotels}</div>
      </div>
    </section>
  `;
  
  fs.writeFileSync(
    path.join(distDir, 'luxury-hotels-athens.html'),
    wrapInLayout(luxuryContent, 'Luxury Hotels in Athens', 'Discover Athens\' finest 5-star hotels. Rooftop pools, Acropolis views, world-class service.', 'https://hotelsofathens.com/luxury-hotels-athens')
  );
  
  // Rooftop Bars Guide
  const rooftopHotels = allHotelsData.hotels
    .filter(h => h.hasRooftopBar)
    .sort((a, b) => (b.rooftopRating || 0) - (a.rooftopRating || 0))
    .map(generateHotelCard)
    .join('');
  
  const rooftopContent = `
    <section class="guide-hero">
      <div class="container">
        <h1>Best Rooftop Bar Hotels in Athens</h1>
        <p>Sunset cocktails with Acropolis views</p>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <div class="guide-intro">
          <p>Nothing beats watching the sunset over the Acropolis with a cocktail in hand. These hotels offer the best rooftop experiences in Athens.</p>
        </div>
        <div class="hotels-grid">${rooftopHotels}</div>
      </div>
    </section>
  `;
  
  fs.writeFileSync(
    path.join(distDir, 'best-rooftop-bars-athens.html'),
    wrapInLayout(rooftopContent, 'Best Rooftop Bar Hotels in Athens', 'Hotels with the best rooftop bars in Athens. Acropolis views, sunset cocktails, unforgettable evenings.', 'https://hotelsofathens.com/best-rooftop-bars-athens')
  );
}

// Generate Sitemap
function generateSitemap() {
  console.log('📄 Generating sitemap...');
  
  const urls = [
    { loc: 'https://hotelsofathens.com/', priority: '1.0' },
    { loc: 'https://hotelsofathens.com/contact', priority: '0.5' },
    { loc: 'https://hotelsofathens.com/budget-hotels-athens', priority: '0.8' },
    { loc: 'https://hotelsofathens.com/luxury-hotels-athens', priority: '0.8' },
    { loc: 'https://hotelsofathens.com/best-rooftop-bars-athens', priority: '0.8' },
    ...neighborhoodsData.neighborhoods.map(n => ({
      loc: `https://hotelsofathens.com/athens-hotels/${n.id}`,
      priority: '0.9'
    })),
    ...allHotelsData.hotels.map(h => ({
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
  
  console.log(`\n✅ Site generated! ${allHotelsData.totalHotels} hotel pages created.`);
  console.log(`   Output: ${distDir}`);
}

main().catch(console.error);
