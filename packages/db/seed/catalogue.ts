// Starter catalogue for the seed migration (`pnpm db:seed:generate`).
//
// Reference data only: chains, the category → product type taxonomy, and a set of widely
// stocked South African products. No prices and no store locations are seeded; those come from
// people (manual entry, pamphlets) so nothing here pretends to be observed data. Users add the
// stores they shop at. Sizes follow common pack sizes and can be corrected in the app later.

export type Unit = 'g' | 'ml' | 'each';

export const chains: [id: string, name: string, tier: string, loyalty: string | null][] = [
  ['checkers', 'Checkers', 'major', 'xtra_savings'],
  ['shoprite', 'Shoprite', 'major', 'xtra_savings'],
  ['usave', 'Usave', 'major', null],
  ['pick-n-pay', 'Pick n Pay', 'major', 'smart_shopper'],
  ['boxer', 'Boxer', 'major', null],
  ['woolworths', 'Woolworths', 'major', 'wrewards'],
  ['spar', 'Spar', 'major', 'spar_rewards'],
  ['ok-foods', 'OK Foods', 'major', null],
  ['food-lovers', "Food Lover's Market", 'major', null],
  ['makro', 'Makro', 'major', null],
  ['cambridge', 'Cambridge Food', 'regional', null],
  ['choppies', 'Choppies', 'regional', null],
  ['save-hyper', 'Save Hyper', 'regional', null],
  ['independent', 'Independent supermarket', 'informal', null],
  ['spaza', 'Spaza shop', 'informal', null],
  ['butchery', 'Butchery', 'informal', null],
  ['fruit-veg', 'Fruit & veg stall', 'informal', null],
];

/** [id, name, types: [id, name, default unit]] — array order is the aisle/sort order. */
export const categories: [string, string, [string, string, Unit][]][] = [
  [
    'fruit-veg',
    'Fruit & veg',
    [
      ['potatoes', 'Potatoes', 'g'],
      ['onions', 'Onions', 'g'],
      ['tomatoes', 'Tomatoes', 'g'],
      ['cabbage', 'Cabbage', 'each'],
      ['carrots', 'Carrots', 'g'],
      ['spinach', 'Spinach', 'each'],
      ['bananas', 'Bananas', 'g'],
      ['apples', 'Apples', 'g'],
      ['oranges', 'Oranges', 'g'],
    ],
  ],
  [
    'meat',
    'Meat, chicken & fish',
    [
      ['whole-chicken', 'Whole chicken', 'g'],
      ['chicken-portions', 'Chicken portions', 'g'],
      ['beef-mince', 'Beef mince', 'g'],
      ['stewing-beef', 'Stewing beef', 'g'],
      ['boerewors', 'Boerewors', 'g'],
      ['pork-chops', 'Pork chops', 'g'],
      ['polony', 'Polony', 'g'],
      ['viennas', 'Viennas', 'g'],
      ['frozen-fish', 'Frozen fish', 'g'],
    ],
  ],
  [
    'dairy',
    'Dairy & eggs',
    [
      ['fresh-milk', 'Fresh milk', 'ml'],
      ['long-life-milk', 'Long-life milk', 'ml'],
      ['amasi', 'Amasi', 'ml'],
      ['yoghurt', 'Yoghurt', 'g'],
      ['cheese', 'Cheese', 'g'],
      ['butter', 'Butter', 'g'],
      ['eggs', 'Eggs', 'each'],
    ],
  ],
  [
    'bakery',
    'Bakery',
    [
      ['white-bread', 'White bread', 'g'],
      ['brown-bread', 'Brown bread', 'g'],
      ['bread-rolls', 'Bread rolls', 'each'],
    ],
  ],
  [
    'staples',
    'Maize meal, rice & grains',
    [
      ['maize-meal', 'Maize meal', 'g'],
      ['rice', 'Rice', 'g'],
      ['samp', 'Samp', 'g'],
      ['dried-beans', 'Dried beans', 'g'],
      ['pasta', 'Pasta', 'g'],
      ['oats', 'Oats', 'g'],
    ],
  ],
  [
    'baking',
    'Baking & sugar',
    [
      ['white-sugar', 'White sugar', 'g'],
      ['brown-sugar', 'Brown sugar', 'g'],
      ['cake-flour', 'Cake flour', 'g'],
      ['bread-flour', 'Bread flour', 'g'],
      ['yeast', 'Yeast', 'g'],
    ],
  ],
  [
    'oils-spreads',
    'Oils & spreads',
    [
      ['cooking-oil', 'Cooking oil', 'ml'],
      ['margarine', 'Margarine', 'g'],
      ['peanut-butter', 'Peanut butter', 'g'],
      ['jam', 'Jam', 'g'],
    ],
  ],
  [
    'tins-sauces',
    'Tins, sauces & spices',
    [
      ['baked-beans', 'Baked beans', 'g'],
      ['pilchards', 'Pilchards', 'g'],
      ['chakalaka', 'Chakalaka', 'g'],
      ['tomato-sauce', 'Tomato sauce', 'ml'],
      ['mayonnaise', 'Mayonnaise', 'g'],
      ['curry-powder', 'Curry powder', 'g'],
      ['seasoning', 'Seasoning', 'g'],
      ['stock-cubes', 'Stock cubes', 'each'],
      ['soup-powder', 'Soup powder', 'g'],
    ],
  ],
  [
    'breakfast',
    'Breakfast',
    [
      ['cereal', 'Cereal', 'g'],
      ['instant-porridge', 'Instant porridge', 'g'],
    ],
  ],
  [
    'drinks',
    'Drinks',
    [
      ['tea', 'Tea', 'each'],
      ['coffee', 'Coffee', 'g'],
      ['soft-drinks', 'Soft drinks', 'ml'],
      ['fruit-juice', 'Fruit juice', 'ml'],
      ['cordial', 'Cordial', 'ml'],
      ['bottled-water', 'Bottled water', 'ml'],
    ],
  ],
  [
    'snacks',
    'Snacks & sweets',
    [
      ['chips', 'Chips', 'g'],
      ['biscuits', 'Biscuits', 'g'],
      ['chocolate', 'Chocolate', 'g'],
    ],
  ],
  [
    'frozen',
    'Frozen',
    [
      ['frozen-veg', 'Frozen vegetables', 'g'],
      ['frozen-chips', 'Frozen chips', 'g'],
      ['ice-cream', 'Ice cream', 'ml'],
    ],
  ],
  [
    'cleaning',
    'Cleaning & laundry',
    [
      ['dishwashing-liquid', 'Dishwashing liquid', 'ml'],
      ['washing-powder', 'Washing powder', 'g'],
      ['bleach', 'Bleach', 'ml'],
      ['surface-cleaner', 'Surface cleaner', 'ml'],
      ['toilet-paper', 'Toilet paper', 'each'],
    ],
  ],
  [
    'personal-care',
    'Toiletries',
    [
      ['toothpaste', 'Toothpaste', 'ml'],
      ['bath-soap', 'Bath soap', 'g'],
      ['petroleum-jelly', 'Petroleum jelly', 'ml'],
      ['deodorant', 'Deodorant', 'ml'],
      ['sanitary-pads', 'Sanitary pads', 'each'],
    ],
  ],
  [
    'baby',
    'Baby',
    [
      ['nappies', 'Nappies', 'each'],
      ['baby-formula', 'Baby formula', 'g'],
      ['baby-wipes', 'Baby wipes', 'each'],
    ],
  ],
];

interface SeedProduct {
  type: string;
  brand: string | null;
  name: string;
  size: number;
  unit: Unit;
  pack?: number;
  /** Priced per kg. */
  byWeight?: boolean;
}

const p = (
  type: string,
  brand: string | null,
  name: string,
  size: number,
  unit: Unit,
  extra: Partial<SeedProduct> = {},
): SeedProduct => ({ type, brand, name, size, unit, ...extra });

const perKg = (type: string, name: string) => p(type, null, name, 1000, 'g', { byWeight: true });

export const products: SeedProduct[] = [
  // Fresh (unbranded; priced per kg or per bag/item)
  p('potatoes', null, 'Potatoes', 7000, 'g'),
  p('onions', null, 'Onions', 2000, 'g'),
  perKg('tomatoes', 'Tomatoes'),
  p('cabbage', null, 'Cabbage', 1, 'each'),
  p('carrots', null, 'Carrots', 1000, 'g'),
  perKg('bananas', 'Bananas'),
  p('apples', null, 'Apples', 1500, 'g'),
  perKg('whole-chicken', 'Whole fresh chicken'),
  perKg('beef-mince', 'Beef mince'),
  perKg('stewing-beef', 'Beef stewing pieces'),
  perKg('boerewors', 'Boerewors'),
  perKg('pork-chops', 'Pork loin chops'),
  p('chicken-portions', 'Rainbow', 'IQF Chicken Mixed Portions', 2000, 'g'),
  p('eggs', null, 'Large eggs', 30, 'each'),
  p('eggs', 'Nulaid', 'Large Eggs', 18, 'each'),

  // Dairy
  p('fresh-milk', 'Clover', 'Full Cream Fresh Milk', 2000, 'ml'),
  p('fresh-milk', 'Clover', 'Low Fat Fresh Milk', 2000, 'ml'),
  p('fresh-milk', 'Parmalat', 'Full Cream Fresh Milk', 2000, 'ml'),
  p('long-life-milk', 'Clover', 'Full Cream Long Life Milk', 1000, 'ml'),
  p('long-life-milk', 'Parmalat', 'Full Cream Long Life Milk', 1000, 'ml', { pack: 6 }),
  p('amasi', 'Inkomazi', 'Amasi', 2000, 'ml'),
  p('butter', 'Clover', 'Salted Butter', 500, 'g'),

  // Bakery
  p('white-bread', 'Albany', 'Superior White Bread', 700, 'g'),
  p('white-bread', 'Sasko', 'Premium White Bread', 700, 'g'),
  p('white-bread', 'Blue Ribbon', 'Classic White Bread', 700, 'g'),
  p('brown-bread', 'Albany', 'Superior Brown Bread', 700, 'g'),
  p('brown-bread', 'Sasko', 'Premium Brown Bread', 700, 'g'),

  // Staples
  p('maize-meal', 'White Star', 'Super Maize Meal', 10000, 'g'),
  p('maize-meal', 'White Star', 'Super Maize Meal', 5000, 'g'),
  p('maize-meal', 'White Star', 'Super Maize Meal', 2500, 'g'),
  p('maize-meal', 'Iwisa', 'Super Maize Meal', 10000, 'g'),
  p('maize-meal', 'Iwisa', 'Super Maize Meal', 5000, 'g'),
  p('maize-meal', 'Ace', 'Super Maize Meal', 10000, 'g'),
  p('rice', 'Tastic', 'Long Grain Parboiled Rice', 2000, 'g'),
  p('rice', 'Tastic', 'Long Grain Parboiled Rice', 1000, 'g'),
  p('rice', 'Spekko', 'Long Grain Parboiled Rice', 2000, 'g'),
  p('pasta', "Fatti's & Moni's", 'Spaghetti', 500, 'g'),
  p('pasta', "Fatti's & Moni's", 'Macaroni', 500, 'g'),
  p('oats', 'Jungle', 'Oats', 1000, 'g'),

  // Baking
  p('white-sugar', 'Huletts', 'White Sugar', 2500, 'g'),
  p('white-sugar', 'Selati', 'White Sugar', 2500, 'g'),
  p('cake-flour', 'Snowflake', 'Cake Wheat Flour', 2500, 'g'),
  p('cake-flour', 'Golden Cloud', 'Cake Wheat Flour', 2500, 'g'),
  p('bread-flour', 'Snowflake', 'White Bread Wheat Flour', 2500, 'g'),

  // Oils & spreads
  p('cooking-oil', 'Sunfoil', 'Sunflower Oil', 2000, 'ml'),
  p('cooking-oil', 'Sunfoil', 'Sunflower Oil', 750, 'ml'),
  p('cooking-oil', 'Excella', 'Sunflower Oil', 2000, 'ml'),
  p('margarine', 'Rama', 'Original Spread', 500, 'g'),
  p('margarine', 'Stork', 'Bake', 500, 'g'),
  p('peanut-butter', 'Black Cat', 'Smooth Peanut Butter', 400, 'g'),
  p('jam', 'All Gold', 'Apricot Jam', 450, 'g'),

  // Tins, sauces & spices
  p('baked-beans', 'Koo', 'Baked Beans in Tomato Sauce', 410, 'g'),
  p('pilchards', 'Lucky Star', 'Pilchards in Tomato Sauce', 400, 'g'),
  p('chakalaka', 'Koo', 'Chakalaka Mild & Spicy', 410, 'g'),
  p('tomato-sauce', 'All Gold', 'Tomato Sauce', 700, 'ml'),
  p('mayonnaise', 'Crosse & Blackwell', 'Tangy Mayonnaise', 750, 'g'),
  p('curry-powder', 'Rajah', 'Mild & Spicy Curry Powder', 100, 'g'),
  p('seasoning', 'Knorr', 'Aromat Original', 75, 'g'),

  // Breakfast
  p('cereal', 'Bokomo', 'Weet-Bix', 900, 'g'),
  p('instant-porridge', 'Ace', 'Instant Porridge Original', 1000, 'g'),

  // Drinks
  p('tea', 'Joko', 'Tagless Tea Bags', 100, 'each'),
  p('tea', 'Freshpak', 'Rooibos Tea Bags', 80, 'each'),
  p('coffee', 'Nestlé', 'Ricoffy', 750, 'g'),
  p('coffee', 'Nescafé', 'Classic Instant Coffee', 200, 'g'),
  p('soft-drinks', 'Coca-Cola', 'Original', 2000, 'ml'),
  p('soft-drinks', 'Sprite', 'Lemon-Lime', 2000, 'ml'),
  p('soft-drinks', 'Fanta', 'Orange', 2000, 'ml'),
  p('fruit-juice', 'Ceres', 'Medley of Fruits Juice', 1000, 'ml'),
  p('cordial', 'Oros', 'Orange Squash', 2000, 'ml'),
  p('bottled-water', 'Valpré', 'Still Water', 5000, 'ml'),

  // Snacks
  p('chips', 'Simba', 'Salt & Vinegar Chips', 120, 'g'),
  p('biscuits', 'Bakers', 'Tennis Biscuits', 200, 'g'),
  p('biscuits', 'Bakers', 'Eet-Sum-Mor', 200, 'g'),
  p('chocolate', 'Cadbury', 'Dairy Milk', 80, 'g'),

  // Frozen
  p('frozen-veg', 'McCain', 'Mixed Vegetables', 1000, 'g'),
  p('ice-cream', 'Ola', "Rich 'n Creamy Vanilla", 2000, 'ml'),

  // Cleaning
  p('dishwashing-liquid', 'Sunlight', 'Dishwashing Liquid Regular', 750, 'ml'),
  p('washing-powder', 'OMO', 'Auto Washing Powder', 2000, 'g'),
  p('bleach', 'Jik', 'Regular Bleach', 750, 'ml'),
  p('surface-cleaner', 'Handy Andy', 'Lemon Fresh Cream Cleaner', 750, 'ml'),
  p('toilet-paper', 'Twinsaver', '2-Ply Toilet Paper', 1, 'each', { pack: 9 }),

  // Toiletries
  p('toothpaste', 'Colgate', 'Regular Toothpaste', 100, 'ml'),
  p('bath-soap', 'Lifebuoy', 'Total 10 Soap', 175, 'g'),
  p('petroleum-jelly', 'Vaseline', 'Blue Seal Petroleum Jelly', 250, 'ml'),
];
