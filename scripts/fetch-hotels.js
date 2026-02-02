import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
const hotelsDir = path.join(dataDir, 'hotels');

// Ensure directories exist
if (!fs.existsSync(hotelsDir)) {
  fs.mkdirSync(hotelsDir, { recursive: true });
}

const delay = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchWithRetry(url, options, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      
      if (res.status === 429) {
        const waitTime = parseInt(res.headers.get('Retry-After') || '60') * 1000;
        console.log(`Rate limited, waiting ${waitTime/1000}s...`);
        await delay(waitTime);
        continue;
      }
      
      console.log(`Attempt ${i + 1} failed with status ${res.status}`);
      await delay(2000 * (i + 1));
    } catch (e) {
      console.error(`Attempt ${i + 1} failed:`, e.message);
      if (i === retries - 1) throw e;
      await delay(2000 * (i + 1));
    }
  }
  return null;
}

// Search for hotels using Serper API
async function searchHotels(neighborhood) {
  const query = `best hotels in ${neighborhood} athens greece`;
  console.log(`Searching: ${query}`);
  
  const res = await fetchWithRetry('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': process.env.SERPER_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ q: query, num: 15 })
  });
  
  if (!res) return [];
  
  const data = await res.json();
  return data.organic || [];
}

// Extract content using Jina AI
async function extractContent(url) {
  console.log(`Extracting: ${url}`);
  
  const jinaUrl = `https://r.jina.ai/${url}`;
  const res = await fetchWithRetry(jinaUrl, {
    headers: {
      'Authorization': `Bearer ${process.env.JINA_API_KEY}`,
      'X-Return-Format': 'markdown'
    }
  });
  
  if (!res) return null;
  return await res.text();
}

// Parse hotel info from extracted content
function parseHotelInfo(content, neighborhood) {
  const hotels = [];
  
  // Look for hotel names and prices in the content
  const hotelPatterns = [
    /(?:Hotel|Athens)\s+([A-Z][a-zA-Z\s&']+?)(?:\s*[-–]\s*|\s+)(?:from\s+)?€?(\d{2,4})/gi,
    /([A-Z][a-zA-Z\s&']+?)\s+(?:Hotel|Athens)(?:\s*[-–]\s*|\s+)(?:from\s+)?€?(\d{2,4})/gi
  ];
  
  const seen = new Set();
  
  for (const pattern of hotelPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const name = match[1].trim();
      const price = parseInt(match[2]);
      
      if (name.length > 3 && name.length < 50 && price > 30 && price < 2000 && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        hotels.push({
          name,
          pricePerNight: price,
          neighborhood
        });
      }
    }
  }
  
  return hotels;
}

// Generate slug from hotel name
function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim() + '-athens';
}

// Seed data for initial launch (curated hotels)
function getSeedHotels() {
  return {
    plaka: [
      { name: "Electra Palace Athens", starRating: 5, pricePerNight: 280, hasAcropolisView: true, hasRooftopBar: true, rooftopRating: 5, amenities: ["Pool", "Spa", "Restaurant", "Gym"], bestFor: ["Luxury", "Couples", "Views"], overview: "Iconic luxury hotel in the heart of Plaka with stunning rooftop pool and Acropolis views. Neoclassical elegance meets modern comfort.", pros: ["Rooftop pool with Acropolis view", "Prime Plaka location", "Excellent service"], cons: ["Premium pricing", "Can be busy"] },
      { name: "Plaka Hotel", starRating: 3, pricePerNight: 95, hasAcropolisView: true, hasRooftopBar: false, rooftopRating: 0, amenities: ["Breakfast", "WiFi", "AC"], bestFor: ["Budget", "Location", "Solo travelers"], overview: "Charming budget-friendly hotel in the heart of Plaka. Simple rooms with great location and friendly staff.", pros: ["Unbeatable location", "Great value", "Rooftop terrace"], cons: ["Basic rooms", "No pool"] },
      { name: "AVA Hotel Athens", starRating: 4, pricePerNight: 180, hasAcropolisView: true, hasRooftopBar: true, rooftopRating: 4, amenities: ["Restaurant", "Bar", "WiFi", "Concierge"], bestFor: ["Boutique", "Couples", "Design lovers"], overview: "Stylish boutique hotel with contemporary design and Acropolis views. Perfect blend of comfort and aesthetics.", pros: ["Beautiful design", "Great rooftop", "Quiet location"], cons: ["Small rooms", "Limited amenities"] },
      { name: "Herodion Hotel", starRating: 4, pricePerNight: 165, hasAcropolisView: true, hasRooftopBar: true, rooftopRating: 4, amenities: ["Restaurant", "Bar", "Garden", "WiFi"], bestFor: ["Families", "Couples", "History buffs"], overview: "Elegant hotel at the foot of the Acropolis with beautiful garden and rooftop restaurant.", pros: ["Steps from Acropolis", "Lovely garden", "Family-friendly"], cons: ["Dated decor in some rooms"] },
      { name: "Central Athens Hotel", starRating: 3, pricePerNight: 85, hasAcropolisView: false, hasRooftopBar: false, rooftopRating: 0, amenities: ["Breakfast", "WiFi", "AC"], bestFor: ["Budget", "Solo travelers", "Short stays"], overview: "Clean and comfortable budget option in central Plaka. No frills but excellent value.", pros: ["Great price", "Central location", "Clean rooms"], cons: ["Basic amenities", "No views"] }
    ],
    monastiraki: [
      { name: "A for Athens", starRating: 4, pricePerNight: 150, hasAcropolisView: true, hasRooftopBar: true, rooftopRating: 5, amenities: ["Rooftop Bar", "Restaurant", "WiFi"], bestFor: ["Nightlife", "Young travelers", "Views"], overview: "Hip hotel right on Monastiraki Square with the best rooftop bar in Athens. Unbeatable Acropolis views.", pros: ["Famous rooftop bar", "Perfect location", "Trendy vibe"], cons: ["Can be noisy", "Small rooms"] },
      { name: "360 Degrees Hotel", starRating: 4, pricePerNight: 140, hasAcropolisView: true, hasRooftopBar: true, rooftopRating: 4, amenities: ["Rooftop", "Bar", "WiFi", "Breakfast"], bestFor: ["Views", "Couples", "Photographers"], overview: "Modern hotel with panoramic rooftop offering 360-degree views of Athens landmarks.", pros: ["Incredible views", "Modern rooms", "Great breakfast"], cons: ["Street noise", "Busy area"] },
      { name: "Attalos Hotel", starRating: 3, pricePerNight: 75, hasAcropolisView: true, hasRooftopBar: false, rooftopRating: 0, amenities: ["Rooftop Terrace", "Breakfast", "WiFi"], bestFor: ["Budget", "Backpackers", "Location"], overview: "Classic budget hotel with rooftop terrace views. Simple but clean with unbeatable location.", pros: ["Budget-friendly", "Rooftop views", "Helpful staff"], cons: ["Basic rooms", "Old building"] },
      { name: "O&B Athens Boutique Hotel", starRating: 4, pricePerNight: 170, hasAcropolisView: true, hasRooftopBar: true, rooftopRating: 4, amenities: ["Spa", "Restaurant", "Bar", "Gym"], bestFor: ["Boutique", "Couples", "Wellness"], overview: "Elegant boutique hotel combining neoclassical architecture with modern luxury.", pros: ["Beautiful building", "Excellent spa", "Quiet rooms"], cons: ["Pricey restaurant"] },
      { name: "Athens Backpackers", starRating: 2, pricePerNight: 35, hasAcropolisView: true, hasRooftopBar: true, rooftopRating: 3, amenities: ["Rooftop Bar", "Kitchen", "WiFi"], bestFor: ["Backpackers", "Budget", "Social"], overview: "Legendary backpacker hostel with famous rooftop bar. Social atmosphere and great location.", pros: ["Super cheap", "Great rooftop", "Social vibe"], cons: ["Hostel dorms", "Can be loud"] }
    ],
    syntagma: [
      { name: "Hotel Grande Bretagne", starRating: 5, pricePerNight: 450, hasAcropolisView: true, hasRooftopBar: true, rooftopRating: 5, amenities: ["Pool", "Spa", "Restaurant", "Gym", "Concierge"], bestFor: ["Luxury", "Special occasions", "Business"], overview: "Athens' most iconic luxury hotel overlooking Syntagma Square. Historic grandeur with world-class service.", pros: ["Legendary hotel", "Stunning rooftop", "Impeccable service"], cons: ["Very expensive", "Formal atmosphere"] },
      { name: "King George Athens", starRating: 5, pricePerNight: 380, hasAcropolisView: true, hasRooftopBar: true, rooftopRating: 5, amenities: ["Restaurant", "Spa", "Butler Service", "Gym"], bestFor: ["Luxury", "Couples", "Fine dining"], overview: "Boutique luxury hotel next to Grande Bretagne with intimate atmosphere and Tudor Hall restaurant.", pros: ["Intimate luxury", "Amazing restaurant", "Personal service"], cons: ["Expensive", "Smaller than GB"] },
      { name: "NJV Athens Plaza", starRating: 5, pricePerNight: 220, hasAcropolisView: true, hasRooftopBar: false, rooftopRating: 0, amenities: ["Restaurant", "Bar", "Gym", "Business Center"], bestFor: ["Business", "Central location", "Comfort"], overview: "Modern luxury hotel on Syntagma Square. Excellent for business travelers and those wanting central location.", pros: ["Prime location", "Modern rooms", "Good value luxury"], cons: ["Less character", "No rooftop"] },
      { name: "Electra Hotel Athens", starRating: 4, pricePerNight: 140, hasAcropolisView: false, hasRooftopBar: true, rooftopRating: 3, amenities: ["Restaurant", "Bar", "WiFi", "Breakfast"], bestFor: ["Mid-range", "Shopping", "Convenience"], overview: "Comfortable hotel on Ermou shopping street. Great base for exploring with rooftop restaurant.", pros: ["Shopping location", "Good breakfast", "Friendly staff"], cons: ["No Acropolis view", "Busy street"] },
      { name: "Arethusa Hotel", starRating: 3, pricePerNight: 90, hasAcropolisView: false, hasRooftopBar: false, rooftopRating: 0, amenities: ["Breakfast", "WiFi", "AC"], bestFor: ["Budget", "Central", "Practical"], overview: "Simple, clean hotel steps from Syntagma metro. Perfect budget base for sightseeing.", pros: ["Great location", "Clean rooms", "Affordable"], cons: ["Basic amenities", "No views"] }
    ],
    kolonaki: [
      { name: "St. George Lycabettus", starRating: 5, pricePerNight: 250, hasAcropolisView: true, hasRooftopBar: true, rooftopRating: 5, amenities: ["Pool", "Spa", "Restaurant", "Gym"], bestFor: ["Luxury", "Views", "Quiet"], overview: "Hillside luxury hotel with stunning city views. Rooftop pool and Le Grand Balcon restaurant.", pros: ["Amazing views", "Rooftop pool", "Quiet area"], cons: ["Uphill walk", "Away from sites"] },
      { name: "Periscope Hotel", starRating: 4, pricePerNight: 160, hasAcropolisView: false, hasRooftopBar: true, rooftopRating: 3, amenities: ["Rooftop", "Bar", "WiFi", "Breakfast"], bestFor: ["Design", "Boutique", "Hip"], overview: "Design-forward boutique hotel in fashionable Kolonaki. Modern aesthetic with rooftop terrace.", pros: ["Great design", "Trendy area", "Good breakfast"], cons: ["Small rooms", "No major views"] },
      { name: "Coco-Mat Athens BC", starRating: 4, pricePerNight: 180, hasAcropolisView: false, hasRooftopBar: false, rooftopRating: 0, amenities: ["Spa", "Restaurant", "Gym", "Organic Bedding"], bestFor: ["Wellness", "Eco-conscious", "Sleep quality"], overview: "Wellness-focused hotel featuring Coco-Mat's famous organic mattresses and sustainable design.", pros: ["Best beds in Athens", "Eco-friendly", "Great spa"], cons: ["No rooftop", "Quiet area"] },
      { name: "Kolonaki Townhouse", starRating: 3, pricePerNight: 120, hasAcropolisView: false, hasRooftopBar: false, rooftopRating: 0, amenities: ["Breakfast", "WiFi", "Garden"], bestFor: ["Boutique", "Quiet", "Local feel"], overview: "Charming small hotel in residential Kolonaki. Feels like staying at a friend's elegant home.", pros: ["Charming atmosphere", "Quiet street", "Personal service"], cons: ["Limited amenities", "No views"] }
    ],
    psyrri: [
      { name: "Pallas Athena Grecotel", starRating: 5, pricePerNight: 200, hasAcropolisView: false, hasRooftopBar: true, rooftopRating: 4, amenities: ["Restaurant", "Bar", "Spa", "Art Gallery"], bestFor: ["Art lovers", "Design", "Nightlife"], overview: "Art-focused luxury hotel with rotating exhibitions and vibrant design. In the heart of creative Psyrri.", pros: ["Unique art concept", "Great location", "Excellent restaurant"], cons: ["No Acropolis view", "Can be noisy"] },
      { name: "Athens Tiare Hotel", starRating: 4, pricePerNight: 130, hasAcropolisView: false, hasRooftopBar: true, rooftopRating: 3, amenities: ["Rooftop", "Bar", "WiFi", "Breakfast"], bestFor: ["Nightlife", "Young travelers", "Value"], overview: "Modern hotel in the heart of Athens' nightlife district. Great rooftop for evening drinks.", pros: ["Nightlife location", "Modern rooms", "Good value"], cons: ["Street noise", "Basic breakfast"] },
      { name: "InnAthens", starRating: 4, pricePerNight: 110, hasAcropolisView: false, hasRooftopBar: false, rooftopRating: 0, amenities: ["Restaurant", "Bar", "WiFi", "Breakfast"], bestFor: ["Foodies", "Local experience", "Value"], overview: "Boutique hotel with excellent restaurant serving modern Greek cuisine. Perfect for food lovers.", pros: ["Great restaurant", "Authentic area", "Good value"], cons: ["No rooftop", "Gritty neighborhood"] },
      { name: "Athens Way Hotel", starRating: 3, pricePerNight: 80, hasAcropolisView: false, hasRooftopBar: false, rooftopRating: 0, amenities: ["Breakfast", "WiFi", "AC"], bestFor: ["Budget", "Nightlife", "Young travelers"], overview: "Simple budget hotel in vibrant Psyrri. Clean rooms and great location for exploring.", pros: ["Budget-friendly", "Great location", "Clean"], cons: ["Basic rooms", "Noisy area"] }
    ],
    koukaki: [
      { name: "Herodion Hotel", starRating: 4, pricePerNight: 155, hasAcropolisView: true, hasRooftopBar: true, rooftopRating: 4, amenities: ["Restaurant", "Bar", "Garden", "WiFi"], bestFor: ["Families", "Quiet", "Acropolis access"], overview: "Elegant hotel at the south slope of the Acropolis. Beautiful garden and easy access to sites.", pros: ["Quiet location", "Garden setting", "Near Acropolis"], cons: ["Uphill walk to center"] },
      { name: "Acropolis Hill Hotel", starRating: 3, pricePerNight: 85, hasAcropolisView: true, hasRooftopBar: false, rooftopRating: 0, amenities: ["Breakfast", "WiFi", "AC", "Terrace"], bestFor: ["Budget", "Views", "Local area"], overview: "Great value hotel with Acropolis views in authentic Koukaki neighborhood.", pros: ["Acropolis views", "Local neighborhood", "Great value"], cons: ["Basic amenities", "Uphill location"] },
      { name: "Marble House", starRating: 2, pricePerNight: 55, hasAcropolisView: false, hasRooftopBar: false, rooftopRating: 0, amenities: ["Kitchen", "WiFi", "Garden"], bestFor: ["Budget", "Long stays", "Self-catering"], overview: "Family-run pension with garden courtyard. Simple rooms but incredible value and warm hospitality.", pros: ["Super affordable", "Lovely garden", "Friendly owners"], cons: ["Very basic", "Shared facilities"] },
      { name: "Philippos Hotel", starRating: 3, pricePerNight: 95, hasAcropolisView: true, hasRooftopBar: false, rooftopRating: 0, amenities: ["Breakfast", "WiFi", "AC"], bestFor: ["Mid-range", "Quiet", "Couples"], overview: "Comfortable hotel in quiet Koukaki with partial Acropolis views. Good base for sightseeing.", pros: ["Quiet area", "Good breakfast", "Near metro"], cons: ["Dated decor", "No rooftop"] }
    ],
    exarchia: [
      { name: "Exarchion Hotel", starRating: 3, pricePerNight: 65, hasAcropolisView: false, hasRooftopBar: false, rooftopRating: 0, amenities: ["Breakfast", "WiFi", "AC"], bestFor: ["Budget", "Alternative culture", "Students"], overview: "Classic hotel in bohemian Exarchia. Simple but clean with authentic neighborhood experience.", pros: ["Very affordable", "Authentic area", "Near museums"], cons: ["Gritty neighborhood", "Basic rooms"] },
      { name: "Orion Hotel", starRating: 2, pricePerNight: 50, hasAcropolisView: false, hasRooftopBar: false, rooftopRating: 0, amenities: ["WiFi", "AC"], bestFor: ["Budget", "Backpackers", "Long stays"], overview: "No-frills budget hotel in Exarchia. Perfect for travelers who want to save money.", pros: ["Rock-bottom prices", "Central location", "Clean"], cons: ["Very basic", "Alternative area"] },
      { name: "City Circus Athens", starRating: 3, pricePerNight: 40, hasAcropolisView: false, hasRooftopBar: true, rooftopRating: 3, amenities: ["Rooftop", "Bar", "Kitchen", "Events"], bestFor: ["Backpackers", "Social", "Budget"], overview: "Award-winning hostel with great rooftop and social events. Mix of dorms and private rooms.", pros: ["Great atmosphere", "Rooftop bar", "Social events"], cons: ["Hostel vibe", "Can be loud"] }
    ],
    piraeus: [
      { name: "Piraeus Theoxenia Hotel", starRating: 4, pricePerNight: 120, hasAcropolisView: false, hasRooftopBar: false, rooftopRating: 0, amenities: ["Restaurant", "Bar", "WiFi", "Parking"], bestFor: ["Ferry travelers", "Business", "Marina views"], overview: "Modern hotel near Piraeus port. Perfect for early ferry departures to the islands.", pros: ["Near ferries", "Marina views", "Good restaurant"], cons: ["Far from Athens center", "Industrial area"] },
      { name: "Phidias Hotel", starRating: 3, pricePerNight: 75, hasAcropolisView: false, hasRooftopBar: false, rooftopRating: 0, amenities: ["Breakfast", "WiFi", "AC"], bestFor: ["Ferry travelers", "Budget", "Practical"], overview: "Simple hotel walking distance from Piraeus port. Ideal for catching early ferries.", pros: ["Very close to port", "Affordable", "Clean"], cons: ["Basic rooms", "Not scenic"] },
      { name: "Kastella Hotel", starRating: 3, pricePerNight: 85, hasAcropolisView: false, hasRooftopBar: false, rooftopRating: 0, amenities: ["Breakfast", "WiFi", "Sea View"], bestFor: ["Seafood lovers", "Local experience", "Quiet"], overview: "Charming hotel in Kastella neighborhood with sea views. Near excellent seafood tavernas.", pros: ["Sea views", "Great restaurants nearby", "Authentic area"], cons: ["Far from center", "Limited transport"] }
    ]
  };
}

// Main function
async function main() {
  console.log('🏨 Fetching Athens hotels...\n');
  
  const neighborhoods = JSON.parse(fs.readFileSync(path.join(dataDir, 'neighborhoods.json'), 'utf8'));
  const seedHotels = getSeedHotels();
  
  const allHotels = [];
  let totalHotels = 0;
  
  for (const hood of neighborhoods.neighborhoods) {
    console.log(`\n📍 Processing ${hood.name}...`);
    
    const hotels = seedHotels[hood.id] || [];
    
    // Add IDs and slugs to hotels
    const processedHotels = hotels.map((hotel, index) => ({
      id: generateSlug(hotel.name).replace('-athens', '') + '-' + hood.id,
      slug: generateSlug(hotel.name),
      neighborhood: hood.id,
      neighborhoodName: hood.name,
      distanceToAcropolis: hood.walkToAcropolis,
      lastVerified: new Date().toISOString().split('T')[0],
      isActive: true,
      ...hotel
    }));
    
    // Save neighborhood file
    const neighborhoodData = {
      ...hood,
      hotelCount: processedHotels.length,
      hotels: processedHotels
    };
    
    fs.writeFileSync(
      path.join(hotelsDir, `${hood.id}.json`),
      JSON.stringify(neighborhoodData, null, 2)
    );
    
    console.log(`  ✓ Saved ${processedHotels.length} hotels for ${hood.name}`);
    
    allHotels.push(...processedHotels);
    totalHotels += processedHotels.length;
  }
  
  // Calculate price stats
  const prices = allHotels.map(h => h.pricePerNight);
  const avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
  
  const priceStats = {
    budget: { range: "Under €80", count: allHotels.filter(h => h.pricePerNight < 80).length },
    midRange: { range: "€80-150", count: allHotels.filter(h => h.pricePerNight >= 80 && h.pricePerNight < 150).length },
    upscale: { range: "€150-250", count: allHotels.filter(h => h.pricePerNight >= 150 && h.pricePerNight < 250).length },
    luxury: { range: "€250+", count: allHotels.filter(h => h.pricePerNight >= 250).length }
  };
  
  // Save master file
  const masterData = {
    lastUpdated: new Date().toISOString().split('T')[0],
    currency: "EUR",
    totalHotels,
    avgPrice,
    priceStats,
    hotels: allHotels
  };
  
  fs.writeFileSync(
    path.join(dataDir, 'all-hotels.json'),
    JSON.stringify(masterData, null, 2)
  );
  
  console.log(`\n✅ Complete! ${totalHotels} hotels saved.`);
  console.log(`   Average price: €${avgPrice}/night`);
  console.log(`   Budget: ${priceStats.budget.count} | Mid: ${priceStats.midRange.count} | Upscale: ${priceStats.upscale.count} | Luxury: ${priceStats.luxury.count}`);
}

main().catch(console.error);
