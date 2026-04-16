const BASE = "https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/productPhotos";
const BASE_EXTRAS = "https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/ProductExtras";

export const images = {
  // Product-specific
  blueberryMuffin: [
    `${BASE}/blueberryMuffin1.jpg`,
    `${BASE}/blueberryMuffin2.jpg`,
    `${BASE}/blueberryMuffin3.jpg`,
  ],
  brownieHearts: [
    `${BASE}/brownieHearts1.jpg`,
    `${BASE}/brownieHearts2.jpg`,
    `${BASE}/brownieHearts3.jpg`,
    `${BASE}/brownieHearts4.jpg`,
  ],
  chocChipBananaBread: [
    `${BASE}/chocChipBananaBread1.jpg`,
    `${BASE}/chocChipBananaBread2.jpg`,
    `${BASE}/chocChipBananaBread3.jpg`,
  ],
  chocolateTruffles: [
    `${BASE}/chocolateTruffles1.jpg`,
    `${BASE}/chocolateTruffles2.jpg`,
    `${BASE}/chocolateTruffles3.jpg`,
  ],
  rasChocChipBananaBread: [
    `${BASE}/rasChocChipBananaBread1.jpg`,
    `${BASE}/rasChocChipBananaBread2.jpg`,
    `${BASE}/rasChocChipBananaBread3.jpg`,
  ],

  // Collection / group shots
  allChocChipMuffins: `${BASE}/allChocChipMuffins.jpg`,
  allChocProducts1: `${BASE}/allChocProducts1.jpg`,
  allChocProducts2: `${BASE}/allChocProducts2.jpg`,
  allMuffins: `${BASE}/allMuffins.jpg`,
  allMuffins1: `${BASE}/allMuffins1.jpg`,
  allMuffins2: `${BASE}/allMuffins2.jpg`,
  allProducts1: `${BASE}/allProducts1.jpg`,
  allProducts2: `${BASE}/allProducts2.jpg`,
  allProducts3: `${BASE}/allProducts3.jpg`,
  allProducts4: `${BASE}/allProducts4.jpg`,
  allProducts5: `${BASE}/allProducts5.jpg`,
  allProductsFaceDown: `${BASE}/allProductsFaceDown.jpg`,
  raspberryBlueberryMuffins: `${BASE}/rasberryBlueberryMuffins.jpg`,
  // Nutrition fact cards (ProductExtras bucket)
  nutrition: {
    brownie: `${BASE_EXTRAS}/BrownieNutritionFacts.png`,
    raspberryBananaBread: `${BASE_EXTRAS}/RASPBERRYCHOCOLATECHIPBANANABreadNutritionFacts.png`,
    cookieDoughTruffle: `${BASE_EXTRAS}/VeganCookieDoughTruffleNutritionFacts.png`,
    blueberryMuffin: `${BASE_EXTRAS}/BlueberryMuffinNutritionFacts.png`,
    chocChipBananaBread: `${BASE_EXTRAS}/ChicChipBananaBreadNutritionFacts.png`,
  },

  // Lifestyle / graffiti background shots (ProductExtras bucket)
  lifestyle: {
    chocTrufflesRed: `${BASE_EXTRAS}/chocTrufflesRedBackground.jpg`,
    blueberryMuffinPurple: [
      `${BASE_EXTRAS}/blueberryMuffinPurpleBackground1.jpg`,
      `${BASE_EXTRAS}/blueberryMuffinPurpleBackground2.jpg`,
      `${BASE_EXTRAS}/blueberryMuffinPurpleBackground3.jpg`,
      `${BASE_EXTRAS}/blueberryMuffinPurpleBackground4.jpg`,
    ],
    chocChipBananaBread: `${BASE_EXTRAS}/chocChipBananaBread.jpg`,
    chocChipHeartBrownies: `${BASE_EXTRAS}/chocChipHeartBrownies.jpg`,
    chocChipRaspberryRed: [
      `${BASE_EXTRAS}/chocChipRasberryRedBackground.jpg`,
      `${BASE_EXTRAS}/chocChipRasberryRedBackground2.jpg`,
      `${BASE_EXTRAS}/chocChipRasberryRedBackground3.jpg`,
    ],
  },
  // About / personal photos
  about: {
    haley1: "https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/pictures/IMG_3676.jpg",
    haley2: "https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/pictures/IMG_3832.jpg",
    haley3: "https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/pictures/IMG_7258%202.jpg",
    haley4: "https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/pictures/IMG_8248.JPG",
  },
} as const;
