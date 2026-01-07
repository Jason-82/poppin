import { PrismaClient, VenueType } from '@prisma/client';

const prisma = new PrismaClient();

interface VenueData {
  name: string;
  address: string;
  neighborhood: string;
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
    name: 'Three Dots and a Dash',
    address: '435 N Clark St, Chicago, IL 60654',
    neighborhood: 'River North',
    latitude: 41.8901,
    longitude: -87.6308,
    type: 'bar',
    description: 'Hidden tiki bar in River North known for creative tropical drinks',
    website: 'https://threedotschicago.com',
  },
  {
    name: 'The Aviary',
    address: '955 W Fulton Market, Chicago, IL 60607',
    neighborhood: 'West Loop',
    latitude: 41.8867,
    longitude: -87.6531,
    type: 'bar',
    description: 'Award-winning cocktail bar with innovative molecular mixology',
    website: 'https://theaviary.com',
  },
  {
    name: 'Sparrow',
    address: '3434 N Milwaukee Ave, Chicago, IL 60641',
    neighborhood: 'Logan Square',
    latitude: 41.9435,
    longitude: -87.7177,
    type: 'bar',
    description: 'Cozy cocktail bar in Logan Square with craft drinks',
  },
  {
    name: 'The Berkshire Room',
    address: '15 E Ohio St, Chicago, IL 60611',
    neighborhood: 'River North',
    latitude: 41.8926,
    longitude: -87.6276,
    type: 'bar',
    description: 'Sophisticated cocktail bar in River North with classic ambiance',
  },
  {
    name: 'The Drifter',
    address: '676 N Orleans St, Chicago, IL 60654',
    neighborhood: 'River North',
    latitude: 41.8944,
    longitude: -87.6378,
    type: 'bar',
    description: 'Speakeasy-style bar beneath Green Door Tavern',
  },
  {
    name: 'Sidetrack',
    address: '3349 N Halsted St, Chicago, IL 60657',
    neighborhood: 'Boystown',
    latitude: 41.9434,
    longitude: -87.6491,
    type: 'bar',
    description: 'Iconic Boystown bar with multiple rooms and video screens',
    website: 'https://sidetrackchicago.com',
  },
  {
    name: 'Gibsons Bar & Steakhouse',
    address: '1028 N Rush St, Chicago, IL 60611',
    neighborhood: 'Gold Coast',
    latitude: 41.9027,
    longitude: -87.6279,
    type: 'bar',
    description: 'Iconic Chicago steakhouse with lively bar scene',
    website: 'https://gibsonssteakhouse.com',
  },

  // Clubs
  {
    name: 'Sound-Bar',
    address: '226 W Ontario St, Chicago, IL 60654',
    neighborhood: 'River North',
    latitude: 41.8931,
    longitude: -87.6355,
    type: 'club',
    description: 'Premier nightclub featuring top EDM and house DJs',
    website: 'https://sound-bar.com',
  },
  {
    name: 'Spy Bar',
    address: '646 N Franklin St, Chicago, IL 60654',
    neighborhood: 'River North',
    latitude: 41.8936,
    longitude: -87.6358,
    type: 'club',
    description: 'Underground dance club with house and techno music',
    website: 'https://spybarchicago.com',
  },
  {
    name: 'Prysm Nightclub',
    address: '1543 N Kingsbury St, Chicago, IL 60642',
    neighborhood: 'Old Town',
    latitude: 41.9102,
    longitude: -87.6425,
    type: 'club',
    description: 'Upscale nightclub with state-of-the-art sound and lighting',
    website: 'https://prysmchicago.com',
  },
  {
    name: 'HVAC',
    address: '169 W Kinzie St, Chicago, IL 60654',
    neighborhood: 'River North',
    latitude: 41.8891,
    longitude: -87.6334,
    type: 'club',
    description: 'Industrial-themed nightclub in River North',
  },
  {
    name: 'Primary',
    address: '5634 N Milwaukee Ave, Chicago, IL 60646',
    neighborhood: 'Jefferson Park',
    latitude: 41.9847,
    longitude: -87.7641,
    type: 'club',
    description: 'Nightclub featuring house and techno music',
    website: 'https://primarychicago.com',
  },
  {
    name: 'Smartbar',
    address: '3730 N Clark St, Chicago, IL 60613',
    neighborhood: 'Wrigleyville',
    latitude: 41.9499,
    longitude: -87.6512,
    type: 'club',
    description: 'Legendary underground dance club since 1982',
    website: 'https://smartbarchicago.com',
  },
  {
    name: 'Stereo Nightclub',
    address: '2221 W North Ave, Chicago, IL 60647',
    neighborhood: 'Wicker Park',
    latitude: 41.9105,
    longitude: -87.6851,
    type: 'club',
    description: 'Wicker Park nightclub with DJ entertainment',
  },
  {
    name: 'TAO Chicago',
    address: '632 N Dearborn St, Chicago, IL 60654',
    neighborhood: 'River North',
    latitude: 41.8933,
    longitude: -87.6296,
    type: 'club',
    description: 'Asian-inspired restaurant and nightclub',
    website: 'https://taogroup.com/venues/tao-chicago',
  },
  {
    name: 'Moxy Chicago',
    address: '530 N LaSalle Dr, Chicago, IL 60654',
    neighborhood: 'River North',
    latitude: 41.8915,
    longitude: -87.6327,
    type: 'club',
    description: 'Hotel rooftop bar and lounge with city views',
    website: 'https://moxychicago.com',
  },
  {
    name: 'Bodega',
    address: '2056 W Division St, Chicago, IL 60622',
    neighborhood: 'Wicker Park',
    latitude: 41.9031,
    longitude: -87.6790,
    type: 'club',
    description: 'Wicker Park nightclub with Latin and hip-hop nights',
  },
  {
    name: '439',
    address: '439 N Clark St, Chicago, IL 60654',
    neighborhood: 'River North',
    latitude: 41.8901,
    longitude: -87.6308,
    type: 'club',
    description: 'River North nightclub with bottle service',
  },
  {
    name: 'Galeria',
    address: '1035 N Western Ave, Chicago, IL 60622',
    neighborhood: 'Ukrainian Village',
    latitude: 41.8993,
    longitude: -87.6873,
    type: 'club',
    description: 'Nightclub and event space in Ukrainian Village',
  },

  // Latin Dance Venues
  {
    name: 'Alhambra Palace',
    address: '1240 W Randolph St, Chicago, IL 60607',
    neighborhood: 'West Loop',
    latitude: 41.8843,
    longitude: -87.6597,
    type: 'latin_dance',
    description: 'Latin nightclub with salsa, bachata, and reggaeton',
  },
  {
    name: 'Carnivale',
    address: '702 W Fulton Market, Chicago, IL 60661',
    neighborhood: 'West Loop',
    latitude: 41.8867,
    longitude: -87.6475,
    type: 'latin_dance',
    description: 'Latin-inspired restaurant and bar with festive atmosphere',
    website: 'https://carnivalechicago.com',
  },
  {
    name: 'La Catrina Cafe',
    address: '1011 W 18th St, Chicago, IL 60608',
    neighborhood: 'Pilsen',
    latitude: 41.8578,
    longitude: -87.6536,
    type: 'latin_dance',
    description: 'Mexican restaurant and bar with weekend dance parties',
  },
  {
    name: 'Downers Sand Club Sports Bar & Grill',
    address: '4850 Main St, Downers Grove, IL 60515',
    neighborhood: 'Downers Grove',
    latitude: 41.7948,
    longitude: -88.0169,
    type: 'latin_dance',
    description: 'Sports bar with West Coast Swing dancing nights',
  },
];

async function main() {
  console.log('Starting seed...');

  // Clear existing data
  console.log('Clearing existing venues...');
  await prisma.crowdReport.deleteMany({});
  await prisma.busynessObservation.deleteMany({});
  await prisma.venueVideo.deleteMany({});
  await prisma.venue.deleteMany({});

  console.log('Creating venues...');

  for (const venueData of chicagoVenues) {
    const venue = await prisma.venue.create({
      data: venueData,
    });
    console.log(`Created venue: ${venue.name} (${venue.neighborhood})`);
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
