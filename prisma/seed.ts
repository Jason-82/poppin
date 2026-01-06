import { PrismaClient, VenueType } from '@prisma/client';

const prisma = new PrismaClient();

interface VenueData {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  type: VenueType;
  description?: string;
  phoneNumber?: string;
  website?: string;
}

const chicagoVenues: VenueData[] = [
  // Bars
  {
    name: 'The Violet Hour',
    address: '1520 N Damen Ave, Chicago, IL 60622',
    latitude: 41.9093,
    longitude: -87.6777,
    type: 'bar',
    description: 'Upscale cocktail lounge with creative drinks in a sophisticated setting',
    website: 'https://theviolethour.com',
  },
  {
    name: 'Lost Lake',
    address: '3154 W Diversey Ave, Chicago, IL 60647',
    latitude: 41.9322,
    longitude: -87.7051,
    type: 'bar',
    description: 'Tropical tiki bar with exotic cocktails and laid-back atmosphere',
    website: 'https://lostlaketiki.com',
  },
  {
    name: 'Three Dots and a Dash',
    address: '435 N Clark St, Chicago, IL 60654',
    latitude: 41.8901,
    longitude: -87.6308,
    type: 'bar',
    description: 'Hidden tiki bar in River North known for creative tropical drinks',
    website: 'https://threedotschicago.com',
  },
  {
    name: 'The Aviary',
    address: '955 W Fulton Market, Chicago, IL 60607',
    latitude: 41.8867,
    longitude: -87.6531,
    type: 'bar',
    description: 'Award-winning cocktail bar with innovative molecular mixology',
    website: 'https://theaviary.com',
  },
  {
    name: 'Sparrow',
    address: '3434 N Milwaukee Ave, Chicago, IL 60641',
    latitude: 41.9435,
    longitude: -87.7177,
    type: 'bar',
    description: 'Cozy cocktail bar in Logan Square with craft drinks',
  },
  {
    name: 'The Berkshire Room',
    address: '15 E Ohio St, Chicago, IL 60611',
    latitude: 41.8926,
    longitude: -87.6276,
    type: 'bar',
    description: 'Sophisticated cocktail bar in River North with classic ambiance',
  },
  {
    name: 'The Drifter',
    address: '676 N Orleans St, Chicago, IL 60654',
    latitude: 41.8944,
    longitude: -87.6378,
    type: 'bar',
    description: 'Speakeasy-style bar beneath Green Door Tavern',
  },

  // Clubs
  {
    name: 'Sound-Bar',
    address: '226 W Ontario St, Chicago, IL 60654',
    latitude: 41.8931,
    longitude: -87.6355,
    type: 'club',
    description: 'Premier nightclub featuring top EDM and house DJs',
    website: 'https://sound-bar.com',
  },
  {
    name: 'Spy Bar',
    address: '646 N Franklin St, Chicago, IL 60654',
    latitude: 41.8936,
    longitude: -87.6358,
    type: 'club',
    description: 'Underground dance club with house and techno music',
    website: 'https://spybarchicago.com',
  },
  {
    name: 'The Mid',
    address: '306 N Halsted St, Chicago, IL 60661',
    latitude: 41.8878,
    longitude: -87.6476,
    type: 'club',
    description: 'Multi-level nightclub in the West Loop with live performances',
  },
  {
    name: 'Studio Paris',
    address: '59 W Hubbard St, Chicago, IL 60654',
    latitude: 41.8898,
    longitude: -87.6290,
    type: 'club',
    description: 'Nightclub with bottle service and DJ entertainment',
  },
  {
    name: 'Prysm Nightclub',
    address: '1543 N Kingsbury St, Chicago, IL 60642',
    latitude: 41.9102,
    longitude: -87.6425,
    type: 'club',
    description: 'Upscale nightclub with state-of-the-art sound and lighting',
    website: 'https://prysmchicago.com',
  },
  {
    name: 'HVAC',
    address: '169 W Kinzie St, Chicago, IL 60654',
    latitude: 41.8891,
    longitude: -87.6334,
    type: 'club',
    description: 'Industrial-themed nightclub in River North',
  },

  // Latin Dance Venues
  {
    name: 'Alhambra Palace',
    address: '1240 W Randolph St, Chicago, IL 60607',
    latitude: 41.8843,
    longitude: -87.6597,
    type: 'latin_dance',
    description: 'Latin nightclub with salsa, bachata, and reggaeton',
  },
  {
    name: 'Nacional 27',
    address: '325 W Huron St, Chicago, IL 60654',
    latitude: 41.8946,
    longitude: -87.6370,
    type: 'latin_dance',
    description: 'Pan-Latin restaurant and nightclub with live music and dancing',
  },
  {
    name: 'Carnivale',
    address: '702 W Fulton Market, Chicago, IL 60661',
    latitude: 41.8867,
    longitude: -87.6475,
    type: 'latin_dance',
    description: 'Latin-inspired restaurant and bar with festive atmosphere',
    website: 'https://carnivalechicago.com',
  },
  {
    name: 'Tumbao',
    address: '2233 S Throop St, Chicago, IL 60608',
    latitude: 41.8515,
    longitude: -87.6598,
    type: 'latin_dance',
    description: 'Latin dance club in Pilsen featuring salsa and bachata nights',
  },
  {
    name: 'Debonair Social Club',
    address: '1575 N Milwaukee Ave, Chicago, IL 60622',
    latitude: 41.9099,
    longitude: -87.6774,
    type: 'latin_dance',
    description: 'Wicker Park venue with Latin dance nights and live music',
  },
  {
    name: 'La Catrina Cafe',
    address: '1011 W 18th St, Chicago, IL 60608',
    latitude: 41.8578,
    longitude: -87.6536,
    type: 'latin_dance',
    description: 'Mexican restaurant and bar with weekend dance parties',
  },
];

async function main() {
  console.log('Starting seed...');

  // Clear existing data (optional - comment out if you want to keep existing data)
  console.log('Clearing existing venues...');
  await prisma.crowdReport.deleteMany({});
  await prisma.busynessObservation.deleteMany({});
  await prisma.venue.deleteMany({});

  console.log('Creating venues...');

  for (const venueData of chicagoVenues) {
    const venue = await prisma.venue.create({
      data: venueData,
    });
    console.log(`Created venue: ${venue.name}`);
  }

  console.log('Seed completed successfully!');
  console.log(`Total venues created: ${chicagoVenues.length}`);
}

main()
  .catch((e) => {
    console.error('Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
