/* ═══════════════════════════════════════════════════════════
   COOKING HUD · Recipe data
   Each recipe: id, name, eyebrow, totalMin, servings,
                shop[], prep[], cook[]
   shop:  { id, qty, item }
   prep:  { id, text }
   cook:  { id, text, timerSec? }
   ═══════════════════════════════════════════════════════════ */

const RECIPES = [
  {
    id: 'carbonara',
    name: 'PASTA CARBONARA',
    eyebrow: 'ITALIAN · WEEKNIGHT',
    totalMin: 25,
    servings: 2,
    shop: [
      { id: 's1', qty: '8 oz',     item: 'Spaghetti' },
      { id: 's2', qty: '4 oz',     item: 'Guanciale or pancetta' },
      { id: 's3', qty: '2',        item: 'Large eggs' },
      { id: 's4', qty: '1',        item: 'Egg yolk' },
      { id: 's5', qty: '1 cup',    item: 'Pecorino Romano' },
      { id: 's6', qty: '1 tsp',    item: 'Black pepper, cracked' },
      { id: 's7', qty: '1 tbsp',   item: 'Kosher salt (for water)' }
    ],
    prep: [
      { id: 'p1', text: 'Cube the guanciale into ¼" pieces.' },
      { id: 'p2', text: 'Crack 2 whole eggs + 1 yolk into a bowl.' },
      { id: 'p3', text: 'Grate pecorino fine, whisk into the eggs.' },
      { id: 'p4', text: 'Crack pepper coarsely, set aside.' },
      { id: 'p5', text: 'Fill a wide pot with water, add salt.' }
    ],
    cook: [
      { id: 'c1', text: 'Bring the salted water to a rolling boil.', timerSec: 360 },
      { id: 'c2', text: 'Add spaghetti, cook al dente.', timerSec: 540 },
      { id: 'c3', text: 'Render guanciale in a cold pan over medium until crisp.', timerSec: 420 },
      { id: 'c4', text: 'Reserve 1 cup pasta water. Drain pasta.' },
      { id: 'c5', text: 'Off heat: toss pasta into the pan with guanciale.' },
      { id: 'c6', text: 'Pour egg mixture in, tossing fast. Add pasta water until silky.' },
      { id: 'c7', text: 'Plate. Top with extra pecorino + cracked pepper.' }
    ]
  },
  {
    id: 'salmon',
    name: 'SHEET PAN SALMON',
    eyebrow: 'WEEKNIGHT · 30 MIN',
    totalMin: 30,
    servings: 2,
    shop: [
      { id: 's1', qty: '2 (6 oz)', item: 'Salmon fillets, skin-on' },
      { id: 's2', qty: '1 lb',     item: 'Asparagus, trimmed' },
      { id: 's3', qty: '1',        item: 'Lemon' },
      { id: 's4', qty: '3 cloves', item: 'Garlic' },
      { id: 's5', qty: '3 tbsp',   item: 'Olive oil' },
      { id: 's6', qty: '1 tsp',    item: 'Flaky salt' },
      { id: 's7', qty: '½ tsp',    item: 'Black pepper' },
      { id: 's8', qty: '1 tbsp',   item: 'Fresh dill' }
    ],
    prep: [
      { id: 'p1', text: 'Preheat the oven to 425°F.' },
      { id: 'p2', text: 'Pat salmon fillets dry with a paper towel.' },
      { id: 'p3', text: 'Trim woody ends from asparagus.' },
      { id: 'p4', text: 'Mince garlic. Slice lemon into thin rounds.' },
      { id: 'p5', text: 'Whisk oil + garlic + salt + pepper in a small bowl.' }
    ],
    cook: [
      { id: 'c1', text: 'Toss asparagus with half the oil mix on a sheet pan.', timerSec: 60 },
      { id: 'c2', text: 'Roast asparagus alone, top rack.', timerSec: 300 },
      { id: 'c3', text: 'Brush salmon with the rest. Lay lemon rounds on top.' },
      { id: 'c4', text: 'Push asparagus aside, add salmon, return to oven.', timerSec: 720 },
      { id: 'c5', text: 'Rest 2 minutes off the heat.', timerSec: 120 },
      { id: 'c6', text: 'Plate, scatter dill, finish with flaky salt.' }
    ]
  },
  {
    id: 'stirfry',
    name: 'CHICKEN STIR FRY',
    eyebrow: 'FAST · ONE PAN',
    totalMin: 20,
    servings: 2,
    shop: [
      { id: 's1', qty: '1 lb',    item: 'Chicken thigh, boneless' },
      { id: 's2', qty: '2 cups',  item: 'Mixed vegetables' },
      { id: 's3', qty: '3 tbsp',  item: 'Soy sauce' },
      { id: 's4', qty: '1 tbsp',  item: 'Sesame oil' },
      { id: 's5', qty: '1 tbsp',  item: 'Cornstarch' },
      { id: 's6', qty: '2 cloves',item: 'Garlic' },
      { id: 's7', qty: '1 in',    item: 'Ginger, fresh' },
      { id: 's8', qty: '2 cups',  item: 'Jasmine rice, cooked' }
    ],
    prep: [
      { id: 'p1', text: 'Slice chicken into ½" strips.' },
      { id: 'p2', text: 'Toss chicken with cornstarch + 1 tbsp soy.' },
      { id: 'p3', text: 'Mince garlic. Grate ginger.' },
      { id: 'p4', text: 'Mix sauce: 2 tbsp soy + sesame oil + splash of water.' },
      { id: 'p5', text: 'Have rice warm and ready to serve.' }
    ],
    cook: [
      { id: 'c1', text: 'Heat a wok or wide skillet over high until smoking.', timerSec: 180 },
      { id: 'c2', text: 'Add oil, then chicken in one layer. Don’t move.', timerSec: 90 },
      { id: 'c3', text: 'Stir + sear until cooked through.', timerSec: 240 },
      { id: 'c4', text: 'Push to side, add garlic + ginger, 20 seconds.', timerSec: 20 },
      { id: 'c5', text: 'Add vegetables. Toss to crisp-tender.', timerSec: 180 },
      { id: 'c6', text: 'Pour sauce in, toss to coat, 30 seconds.', timerSec: 30 },
      { id: 'c7', text: 'Spoon over rice. Serve immediately.' }
    ]
  },
  {
    id: 'oats',
    name: 'OVERNIGHT OATS',
    eyebrow: 'BREAKFAST · NO COOK',
    totalMin: 5,
    servings: 1,
    shop: [
      { id: 's1', qty: '½ cup',  item: 'Rolled oats' },
      { id: 's2', qty: '½ cup',  item: 'Milk or oat milk' },
      { id: 's3', qty: '¼ cup',  item: 'Greek yogurt' },
      { id: 's4', qty: '1 tbsp', item: 'Chia seeds' },
      { id: 's5', qty: '1 tbsp', item: 'Maple syrup' },
      { id: 's6', qty: '½ cup',  item: 'Berries, fresh or frozen' }
    ],
    prep: [
      { id: 'p1', text: 'Find a clean jar or container with a lid.' },
      { id: 'p2', text: 'Measure oats into the jar.' },
      { id: 'p3', text: 'Add chia seeds.' }
    ],
    cook: [
      { id: 'c1', text: 'Pour milk + yogurt into the jar.' },
      { id: 'c2', text: 'Add maple syrup. Stir well to combine.' },
      { id: 'c3', text: 'Top with berries. Seal the jar.' },
      { id: 'c4', text: 'Refrigerate at least 4 hours, or overnight.' },
      { id: 'c5', text: 'Stir before eating. Add toppings to taste.' }
    ]
  }
];
