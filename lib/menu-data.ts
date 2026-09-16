// Café Mehfilé menu data — single source of truth.
// Ported verbatim from the existing design (`legacy/Canvas-2.dc.html`).
// Both the ordering UI and the server-side Google Sheets validation read from
// here, so prices can never drift between the two.

export type SizeDef = { label: string; price: number };
export type RawMenuItem = readonly [
  string,
  number | readonly (readonly [string, number])[],
];
export type RawMenuCat = readonly [string, readonly RawMenuItem[]];

export type MenuItem = {
  /** Stable id, e.g. "2-3" (categoryIndex-itemIndex). Used in order payloads + Sheets price map. */
  code: string;
  cat: string;
  name: string;
  price: number;
  sizes: readonly SizeDef[] | null;
  desc: string;
  photo: string | null;
  available: boolean;
};

export const CATS: readonly RawMenuCat[] = [
  [
    'Maggie',
    [
      ['Masala maggie', 79],
      ['Veggie maggie', 89],
      ['Peri-peri maggie', 109],
      ['Cheese corn maggie', 109],
      ['Pizza maggie', 119],
      ['Schezwan maggie', 99],
    ],
  ],
  [
    'Momos',
    [
      ['Veg momos', [['Half', 109], ['Full', 119]]],
      ['Paneer momos', [['Half', 119], ['Full', 129]]],
      ['Cheese corn momos', [['Half', 149], ['Full', 169]]],
      ['Veg momos pizza', 179],
    ],
  ],
  [
    'Fries',
    [
      ['Classic fries', 79],
      ['Masala fries', 89],
      ['Peri-peri fries', 109],
      ['Cheesy burst fries', 129],
    ],
  ],
  [
    'Pasta',
    [
      ['Exotic pasta', 129],
      ['Alfredo pasta', 149],
      ['Pink pasta', 129],
      ['Red pasta', 159],
    ],
  ],
  [
    'Burger',
    [
      ['Veg burger', 99],
      ['Paneer burger', 119],
      ['Peri-peri burger', 119],
      ['Double blast burger', 139],
    ],
  ],
  [
    'Garlic bread',
    [
      ['Cheese garlic bread', 129],
      ['Schezwan garlic bread', 129],
      ['Peri-peri garlic bread', 139],
    ],
  ],
  [
    'Pizza',
    [
      ['Veggie pizza', 129],
      ['Margherita pizza', 149],
      ['Golden corn pizza', 149],
      ['Peri-peri paneer pizza', 169],
      ['Tandoori paneer pizza', 179],
      ['Exotic pizza', 199],
      ['Schezwan pizza', 139],
      ['Barbeque pizza', 189],
      ['Cheese burst pizza', 149],
      ['Farm fresh pizza', 199],
    ],
  ],
  [
    'Sandwich',
    [
      ['Veggie sandwich', [['Half', 99], ['Full', 119]]],
      ['Fully loaded sandwich', [['Half', 149], ['Full', 179]]],
      ['Paneer cheese sandwich', [['Half', 129], ['Full', 159]]],
      ['Paneer tikka sandwich', [['Half', 149], ['Full', 169]]],
      ['Cheese corn sandwich', [['Half', 109], ['Full', 159]]],
      ['Chilly paneer sandwich', [['Half', 179], ['Full', 209]]],
      ['Peri-peri sandwich', [['Half', 119], ['Full', 159]]],
      ['Chocolate sandwich', 149],
      ['Hazelnut sandwich', 179],
    ],
  ],
  [
    'Pulao & rice',
    [
      ['Regular tava pulao', 109],
      ['Paneer pulao', 135],
      ['Punjabi tadka pulao', 125],
      ['Mix veg pulao', 129],
      ['Schezwan rice', 119],
      ['Paneer schezwan rice', 139],
      ['Italian rice', 249],
      ['Spinach rice with paneer', 209],
      ['Italian special rice', 279],
      ['Creamy corn delight', 149],
    ],
  ],
  [
    'Sizzler',
    [
      ['Hot sizzler brownie', 149],
      ['Chocolate sizzler brownie', 159],
      ['Oreo sizzler brownie', 169],
      ['Kit-kat sizzler brownie', 179],
      ['Nutella brownie', 199],
    ],
  ],
  [
    'Sundae',
    [
      ['Brownie sundae', 179],
      ['Mango sundae', 169],
      ['Chocolate sundae', 149],
      ['Strawberry sundae', 169],
    ],
  ],
  [
    'Mojito',
    [
      ['Virgin mojito', 89],
      ['Strawberry mojito', 129],
      ['Blueberry mojito', 129],
      ['Blue lagoon mojito', 139],
      ['Orange sunset mojito', 159],
    ],
  ],
  [
    'Coffee',
    [
      ['Hot coffee', 59],
      ['Cold coffee', 119],
      ['Hot chocolate coffee', 99],
      ['Cappuccino coffee', 99],
      ['Black coffee', 49],
      ['Ghee coffee', 69],
    ],
  ],
  [
    'Milk shake',
    [
      ['Mango shake', 119],
      ['Pineapple shake', 109],
      ['Butterscotch shake', 109],
      ['Strawberry shake', 109],
      ['Blueberry shake', 109],
    ],
  ],
  [
    'Thick shake',
    [
      ['Chocolate shake', 129],
      ['Hazelnut shake', 159],
      ['Overloaded kit-kat shake', 179],
      ['Oreo shake', 159],
      ['Bourbon shake', 129],
      ['Chocolate brownie shake', 149],
      ['Chocolate hazelnut shake', 179],
      ['Caramel shake', 179],
      ['Dry fruit shake', 159],
      ['Nutella shake', 209],
    ],
  ],
  [
    'Cafe special',
    [
      ['Cafe special shahi pulao', 199],
      ['Cafe special brownie', 149],
    ],
  ],
  [
    'Add ons',
    [
      ['Extra cheese', 30],
      ['Extra ice cream (1 cube)', 30],
      ['Mayonnaise', 20],
      ['Schezwan sauce', 20],
      ['Extra paneer', 30],
    ],
  ],
];

const PHOTOS: Readonly<Record<string, string>> = {
  // Maggie
  'Masala maggie': 'veggie_maggie.jpg',
  'Veggie maggie': 'veggie_maggie.jpg',
  'Peri-peri maggie': 'peri_peri_maggie.jpg',
  'Cheese corn maggie': 'cheese_corn_maggie.jpg',
  'Pizza maggie': 'pizza_maggie.jpg',
  'Schezwan maggie': 'schezwan_maggie.jpg',

  // Momos
  'Veg momos': 'veg_momos.jpg',
  'Paneer momos': 'paneer_momos.jpg',
  'Cheese corn momos': 'cheese_corn_momos.jpg',
  'Veg momos pizza': 'veg_momos_pizza.jpg',

  // Fries
  'Classic fries': 'classic_fries.jpg',
  'Masala fries': 'peri_peri_fries.jpg',
  'Peri-peri fries': 'peri_peri_fries.jpg',
  'Cheesy burst fries': 'cheesy_burst_fries.jpg',

  // Pasta
  'Exotic pasta': 'pink_sauce_pasta.jpg',
  'Alfredo pasta': 'alfredo_pasta.jpg',
  'Pink pasta': 'pink_sauce_pasta.jpg',
  'Red pasta': 'red_sauce_pasta.jpg',

  // Burger
  'Veg burger': 'peri_peri_burger.jpg',
  'Paneer burger': 'peri_peri_burger.jpg',
  'Peri-peri burger': 'peri_peri_burger.jpg',
  'Double blast burger': 'double_blast_burger.jpg',

  // Garlic bread
  'Cheese garlic bread': 'cheese_garlic_bread.jpg',
  'Schezwan garlic bread': 'schezwan_garlic_bread.jpg',
  'Peri-peri garlic bread': 'peri_peri_garlic_bread.jpg',

  // Pizza
  'Veggie pizza': 'ai_pizza_burger.jpg',
  'Margherita pizza': 'ai_pizza_burger.jpg',
  'Golden corn pizza': 'ai_pizza_burger.jpg',
  'Peri-peri paneer pizza': 'ai_pizza_burger.jpg',
  'Tandoori paneer pizza': 'ai_pizza_burger.jpg',
  'Exotic pizza': 'ai_pizza_burger.jpg',
  'Schezwan pizza': 'ai_pizza_burger.jpg',
  'Barbeque pizza': 'ai_pizza_burger.jpg',
  'Cheese burst pizza': 'ai_pizza_burger.jpg',
  'Farm fresh pizza': 'ai_pizza_burger.jpg',

  // Sandwich
  'Veggie sandwich': 'cheese_corn_sandwich.jpg',
  'Fully loaded sandwich': 'fully_loaded_sandwich.jpg',
  'Paneer cheese sandwich': 'paneer_cheese_sandwich.jpg',
  'Paneer tikka sandwich': 'paneer_tikka_sandwich.jpg',
  'Cheese corn sandwich': 'cheese_corn_sandwich.jpg',
  'Chilly paneer sandwich': 'chilly_paneer_sandwich.jpg',
  'Peri-peri sandwich': 'peri_peri_sandwich.jpg',
  'Chocolate sandwich': 'chocolate_sandwich.jpg',
  'Hazelnut sandwich': 'hazelnut_sandwich.jpg',

  // Pulao & rice
  'Regular tava pulao': 'mix_veg_pulao.jpg',
  'Paneer pulao': 'paneer_pulao.jpg',
  'Punjabi tadka pulao': 'panjabi_tadka_pulao.jpg',
  'Mix veg pulao': 'mix_veg_pulao.jpg',
  'Paneer schezwan rice': 'paneer_schezwan_rice.jpg',
  'Italian special rice': 'italian_special_rice.jpg',
  'Schezwan rice': 'paneer_schezwan_rice.jpg',
  'Italian rice': 'italian_special_rice.jpg',
  'Spinach rice with paneer': 'paneer_pulao.jpg',
  'Creamy corn delight': 'italian_special_rice.jpg',

  // Sizzler
  'Hot sizzler brownie': 'cafe_special_brownie.jpg',
  'Oreo sizzler brownie': 'oreo_sizzler_brownie.jpg',
  'Kit-kat sizzler brownie': 'kit_kat_sizzler_brownie.jpg',
  'Nutella brownie': 'nutella_brownie_sizzler.jpg',
  'Chocolate sizzler brownie': 'nutella_brownie_sizzler.jpg',

  // Sundae
  'Brownie sundae': 'brownie_sundae.jpg',
  'Mango sundae': 'mango_sundae.jpg',
  'Chocolate sundae': 'chocolate_sundae.jpg',
  'Strawberry sundae': 'strawberry_sundae.jpg',

  // Mojito
  'Virgin mojito': 'virgin_mojito.jpg',
  'Strawberry mojito': 'strawberry_mojito.jpg',
  'Blueberry mojito': 'blue_lagoon_mojito.jpg',
  'Blue lagoon mojito': 'blue_lagoon_mojito.jpg',
  'Orange sunset mojito': 'orange_sunset_mojito.jpg',

  // Coffee
  'Hot coffee': 'hot_coffee.jpg',
  'Cold coffee': 'cold_coffee.jpg',
  'Hot chocolate coffee': 'hot_coffee.jpg',
  'Cappuccino coffee': 'cappuccino_coffee.jpg',
  'Black coffee': 'hot_coffee.jpg',
  'Ghee coffee': 'ghee_coffee.jpg',

  // Milk shake
  'Mango shake': 'mango_shake.jpg',
  'Pineapple shake': 'pineapple_shake.jpg',
  'Butterscotch shake': 'butterscotch_shake.jpg',
  'Strawberry shake': 'strawberry_shake.jpg',
  'Blueberry shake': 'blueberry_shake.jpg',

  // Thick shake
  'Chocolate shake': 'chocolate_shake.jpg',
  'Hazelnut shake': 'hazelnut_shake.jpg',
  'Overloaded kit-kat shake': 'kit_kat_sizzler_brownie.jpg',
  'Oreo shake': 'oreo_shake.jpg',
  'Bourbon shake': 'bourbon_shake.jpg',
  'Chocolate brownie shake': 'chocolate_brownie_shake.jpg',
  'Chocolate hazelnut shake': 'chocolate_hazelnut_shake.jpg',
  'Caramel shake': 'caramel_shake.jpg',
  'Dry fruit shake': 'dry_fruit_shake.jpg',
  'Nutella shake': 'nutella_shake.jpg',

  // Cafe special
  'Cafe special shahi pulao': 'cafe_special_shahi_pulao.jpg',
  'Cafe special brownie': 'cafe_special_brownie.jpg',

  // Add ons
  'Extra cheese': 'extra_cheese.jpg',
  'Extra ice cream (1 cube)': 'brownie_sundae.jpg',
  'Mayonnaise': 'extra_cheese.jpg',
  'Schezwan sauce': 'schezwan_garlic_bread.jpg',
  'Extra paneer': 'paneer_momos.jpg',
};

const DESCS: Readonly<Record<string, string>> = {
  'Masala maggie': 'Spiced instant noodles',
  'Veggie maggie': 'Noodles with mixed vegetables',
  'Peri-peri maggie': 'Peri-peri spiced noodles',
  'Cheese corn maggie': 'Cheesy noodles with corn',
  'Pizza maggie': 'Noodles topped pizza style',
  'Schezwan maggie': 'Schezwan sauce tossed noodles',
  'Veg momos': 'Steamed vegetable dumplings',
  'Paneer momos': 'Steamed paneer dumplings',
  'Cheese corn momos': 'Cheese and corn dumplings',
  'Veg momos pizza': 'Pan-fried momos, pizza style',
  'Classic fries': 'Crispy salted fries',
  'Masala fries': 'Spiced masala fries',
  'Peri-peri fries': 'Peri-peri seasoned fries',
  'Cheesy burst fries': 'Fries loaded with cheese',
  'Exotic pasta': 'Pasta with exotic vegetables',
  'Alfredo pasta': 'Creamy white sauce pasta',
  'Pink pasta': 'Pink sauce pasta blend',
  'Red pasta': 'Tangy red sauce pasta',
  'Veg burger': 'Classic vegetable patty burger',
  'Paneer burger': 'Grilled paneer patty burger',
  'Peri-peri burger': 'Peri-peri spiced patty burger',
  'Double blast burger': 'Double patty loaded burger',
  'Cheese garlic bread': 'Toasted garlic bread, cheese',
  'Schezwan garlic bread': 'Schezwan spiced garlic bread',
  'Peri-peri garlic bread': 'Peri-peri seasoned garlic bread',
  'Veggie pizza': 'Loaded with fresh vegetables',
  'Margherita pizza': 'Classic cheese and tomato',
  'Golden corn pizza': 'Sweet corn topped pizza',
  'Peri-peri paneer pizza': 'Peri-peri paneer topping',
  'Tandoori paneer pizza': 'Tandoori spiced paneer topping',
  'Exotic pizza': 'Exotic vegetable medley topping',
  'Schezwan pizza': 'Schezwan sauce base pizza',
  'Barbeque pizza': 'Smoky barbeque sauce pizza',
  'Cheese burst pizza': 'Extra cheese stuffed crust',
  'Farm fresh pizza': 'Garden fresh vegetable pizza',
  'Veggie sandwich': 'Fresh vegetable sandwich',
  'Fully loaded sandwich': 'Loaded with veggies and cheese',
  'Paneer cheese sandwich': 'Grilled paneer and cheese',
  'Paneer tikka sandwich': 'Spiced paneer tikka filling',
  'Cheese corn sandwich': 'Cheese and sweet corn',
  'Chilly paneer sandwich': 'Spicy chilly paneer filling',
  'Peri-peri sandwich': 'Peri-peri spiced filling',
  'Chocolate sandwich': 'Melted chocolate grilled sandwich',
  'Hazelnut sandwich': 'Hazelnut spread grilled sandwich',
  'Regular tava pulao': 'Simple tava-tossed rice',
  'Paneer pulao': 'Rice tossed with paneer',
  'Punjabi tadka pulao': 'Punjabi style tempered rice',
  'Mix veg pulao': 'Rice with mixed vegetables',
  'Schezwan rice': 'Schezwan sauce fried rice',
  'Paneer schezwan rice': 'Schezwan rice with paneer',
  'Italian rice': 'Herbed Italian style rice',
  'Spinach rice with paneer': 'Spinach rice with paneer cubes',
  'Italian special rice': "Chef's special Italian rice",
  'Creamy corn delight': 'Creamy sweet corn rice',
  'Hot sizzler brownie': 'Warm brownie on sizzler',
  'Chocolate sizzler brownie': 'Chocolate brownie, sizzling plate',
  'Oreo sizzler brownie': 'Brownie topped with Oreo',
  'Kit-kat sizzler brownie': 'Brownie topped with Kit-Kat',
  'Nutella brownie': 'Brownie drizzled with Nutella',
  'Brownie sundae': 'Brownie with ice cream',
  'Mango sundae': 'Mango ice cream sundae',
  'Chocolate sundae': 'Chocolate ice cream sundae',
  'Strawberry sundae': 'Strawberry ice cream sundae',
  'Virgin mojito': 'Classic mint lime mojito',
  'Strawberry mojito': 'Strawberry mint mojito',
  'Blueberry mojito': 'Blueberry mint mojito',
  'Blue lagoon mojito': 'Blue lagoon flavored mojito',
  'Orange sunset mojito': 'Orange flavored sunset mojito',
  'Hot coffee': 'Classic hot brewed coffee',
  'Cold coffee': 'Chilled blended cold coffee',
  'Hot chocolate coffee': 'Coffee with hot chocolate',
  'Cappuccino coffee': 'Frothy cappuccino coffee',
  'Black coffee': 'Strong black coffee',
  'Ghee coffee': 'Coffee brewed with ghee',
  'Mango shake': 'Fresh mango milkshake',
  'Pineapple shake': 'Fresh pineapple milkshake',
  'Butterscotch shake': 'Butterscotch flavored milkshake',
  'Strawberry shake': 'Fresh strawberry milkshake',
  'Blueberry shake': 'Blueberry flavored milkshake',
  'Chocolate shake': 'Thick chocolate milkshake',
  'Hazelnut shake': 'Thick hazelnut milkshake',
  'Overloaded kit-kat shake': 'Loaded with Kit-Kat pieces',
  'Oreo shake': 'Thick Oreo cookie shake',
  'Bourbon shake': 'Thick Bourbon biscuit shake',
  'Chocolate brownie shake': 'Chocolate shake with brownie',
  'Chocolate hazelnut shake': 'Chocolate hazelnut thick shake',
  'Caramel shake': 'Thick caramel milkshake',
  'Dry fruit shake': 'Shake loaded with dry fruits',
  'Nutella shake': 'Thick Nutella milkshake',
  'Cafe special shahi pulao': 'House special shahi pulao',
  'Cafe special brownie': 'House special warm brownie',
  'Extra cheese': 'Extra cheese topping',
  'Extra ice cream (1 cube)': 'One extra ice cream cube',
  Mayonnaise: 'Side of mayonnaise',
  'Schezwan sauce': 'Side of schezwan sauce',
  'Extra paneer': 'Extra paneer topping',
};

function buildItems(): MenuItem[] {
  const items: MenuItem[] = [];
  CATS.forEach((cat, ci) => {
    cat[1].forEach((raw, ii) => {
      const name = String(raw[0]);
      const sizes = Array.isArray(raw[1])
        ? raw[1].map((s) => ({ label: String(s[0]), price: Number(s[1]) }))
        : null;
      const price = sizes ? sizes[0].price : Number(raw[1]);
      const photoName = PHOTOS[name];
      items.push({
        code: `${ci}-${ii}`,
        cat: cat[0],
        name,
        price,
        sizes,
        desc: DESCS[name] || '',
        photo: photoName ? `/uploads/${photoName}` : null,
        available: true,
      });
    });
  });
  return items;
}

export const MENU_ITEMS: readonly MenuItem[] = buildItems();
export const CAT_TABS: readonly string[] = [
  'All',
  ...CATS.map((c) => c[0]),
] as const;

/** Items the café has temporarily paused (code -> true). Empty = everything on. */
export const UNAVAILABLE: Readonly<Record<string, boolean>> = {};

export const byCode = new Map<string, MenuItem>(
  MENU_ITEMS.map((i) => [i.code, i]),
);