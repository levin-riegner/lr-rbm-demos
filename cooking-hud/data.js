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
    eyebrow: 'Italian',
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
      { id: 'p1', text: 'Cube the guanciale into 1/4" pieces.' },
      { id: 'p2', text: 'Crack 2 whole eggs + 1 yolk into a bowl.' },
      { id: 'p3', text: 'Grate pecorino fine, whisk into the eggs.' },
      { id: 'p4', text: 'Crack pepper coarsely, set aside.' },
      { id: 'p5', text: 'Fill a wide pot with water, add salt.' }
    ],
    cook: [
      { id: 'c1', text: 'Bring the salted water to a rolling boil.', timerSec: 360, tag: 'BOIL' },
      { id: 'c2', text: 'Add spaghetti, cook al dente.', timerSec: 540, tag: 'PASTA' },
      { id: 'c3', text: 'Render guanciale in a cold pan over medium until crisp.', timerSec: 420, tag: 'RENDER' },
      { id: 'c4', text: 'Reserve 1 cup pasta water. Drain pasta.' },
      { id: 'c5', text: 'Off heat: toss pasta into the pan with guanciale.' },
      { id: 'c6', text: 'Pour egg mixture in, tossing fast. Add pasta water until silky.' },
      { id: 'c7', text: 'Plate. Top with extra pecorino + cracked pepper.' }
    ]
  },
  {
    id: 'salmon',
    name: 'SHEET PAN SALMON',
    eyebrow: 'Weeknight',
    totalMin: 30,
    servings: 2,
    shop: [
      { id: 's1', qty: '2 (6 oz)', item: 'Salmon fillets, skin-on' },
      { id: 's2', qty: '1 lb',     item: 'Asparagus, trimmed' },
      { id: 's3', qty: '1',        item: 'Lemon' },
      { id: 's4', qty: '3 cloves', item: 'Garlic' },
      { id: 's5', qty: '3 tbsp',   item: 'Olive oil' },
      { id: 's6', qty: '1 tsp',    item: 'Flaky salt' },
      { id: 's7', qty: '1/2 tsp',    item: 'Black pepper' },
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
      { id: 'c1', text: 'Toss asparagus with half the oil mix on a sheet pan.', timerSec: 60, tag: 'TOSS' },
      { id: 'c2', text: 'Roast asparagus alone, top rack.', timerSec: 300, tag: 'ROAST' },
      { id: 'c3', text: 'Brush salmon with the rest. Lay lemon rounds on top.' },
      { id: 'c4', text: 'Push asparagus aside, add salmon, return to oven.', timerSec: 720, tag: 'BAKE' },
      { id: 'c5', text: 'Rest 2 minutes off the heat.', timerSec: 120, tag: 'REST' },
      { id: 'c6', text: 'Plate, scatter dill, finish with flaky salt.' }
    ]
  },
  {
    id: 'stirfry',
    name: 'CHICKEN STIR FRY',
    eyebrow: 'One Pan',
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
      { id: 'p1', text: 'Slice chicken into 1/2" strips.' },
      { id: 'p2', text: 'Toss chicken with cornstarch + 1 tbsp soy.' },
      { id: 'p3', text: 'Mince garlic. Grate ginger.' },
      { id: 'p4', text: 'Mix sauce: 2 tbsp soy + sesame oil + splash of water.' },
      { id: 'p5', text: 'Have rice warm and ready to serve.' }
    ],
    cook: [
      { id: 'c1', text: 'Heat a wok or wide skillet over high until smoking.', timerSec: 180, tag: 'HEAT' },
      { id: 'c2', text: 'Add oil, then chicken in one layer. Don’t move.', timerSec: 90, tag: 'SEAR' },
      { id: 'c3', text: 'Stir + sear until cooked through.', timerSec: 240, tag: 'CHICKEN' },
      { id: 'c4', text: 'Push to side, add garlic + ginger, 20 seconds.', timerSec: 20, tag: 'GARLIC' },
      { id: 'c5', text: 'Add vegetables. Toss to crisp-tender.', timerSec: 180, tag: 'VEGGIES' },
      { id: 'c6', text: 'Pour sauce in, toss to coat, 30 seconds.', timerSec: 30, tag: 'SAUCE' },
      { id: 'c7', text: 'Spoon over rice. Serve immediately.' }
    ]
  },
  {
    id: 'oats',
    name: 'OVERNIGHT OATS',
    eyebrow: 'Breakfast',
    totalMin: 5,
    servings: 1,
    shop: [
      { id: 's1', qty: '1/2 cup',  item: 'Rolled oats' },
      { id: 's2', qty: '1/2 cup',  item: 'Milk or oat milk' },
      { id: 's3', qty: '1/4 cup',  item: 'Greek yogurt' },
      { id: 's4', qty: '1 tbsp', item: 'Chia seeds' },
      { id: 's5', qty: '1 tbsp', item: 'Maple syrup' },
      { id: 's6', qty: '1/2 cup',  item: 'Berries, fresh or frozen' }
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
  },
  {
    id: 'tomato-soup',
    name: 'TOMATO SOUP',
    eyebrow: 'Comfort',
    totalMin: 35,
    servings: 4,
    shop: [
      { id: 's1', qty: '2 lbs',    item: 'Roma tomatoes' },
      { id: 's2', qty: '1',        item: 'Yellow onion' },
      { id: 's3', qty: '3 cloves', item: 'Garlic' },
      { id: 's4', qty: '2 tbsp',   item: 'Olive oil' },
      { id: 's5', qty: '2 cups',   item: 'Vegetable broth' },
      { id: 's6', qty: '1/2 cup',    item: 'Heavy cream' },
      { id: 's7', qty: '1 tsp',    item: 'Sugar' },
      { id: 's8', qty: '1 tbsp',   item: 'Fresh basil' }
    ],
    prep: [
      { id: 'p1', text: 'Halve tomatoes, remove cores.' },
      { id: 'p2', text: 'Dice the onion.' },
      { id: 'p3', text: 'Mince the garlic.' },
      { id: 'p4', text: 'Chop the basil leaves.' }
    ],
    cook: [
      { id: 'c1', text: 'Heat olive oil in a pot over medium.', timerSec: 120, tag: 'HEAT' },
      { id: 'c2', text: 'Sauté onion until soft.', timerSec: 240, tag: 'ONION' },
      { id: 'c3', text: 'Add garlic, stir 30 seconds.', timerSec: 30, tag: 'GARLIC' },
      { id: 'c4', text: 'Add tomatoes, broth, sugar. Bring to a simmer.', timerSec: 600, tag: 'SIMMER' },
      { id: 'c5', text: 'Blend smooth with an immersion blender.' },
      { id: 'c6', text: 'Stir in cream + salt + pepper. Warm through.', timerSec: 60, tag: 'WARM' },
      { id: 'c7', text: 'Ladle into bowls, top with basil.' }
    ]
  },
  {
    id: 'greek-salad',
    name: 'GREEK SALAD',
    eyebrow: 'Lunch',
    totalMin: 15,
    servings: 4,
    shop: [
      { id: 's1', qty: '3',       item: 'Tomatoes' },
      { id: 's2', qty: '1',       item: 'English cucumber' },
      { id: 's3', qty: '1/2',       item: 'Red onion' },
      { id: 's4', qty: '1 cup',   item: 'Kalamata olives' },
      { id: 's5', qty: '8 oz',    item: 'Feta cheese, block' },
      { id: 's6', qty: '1/4 cup',   item: 'Olive oil' },
      { id: 's7', qty: '2 tbsp',  item: 'Red wine vinegar' },
      { id: 's8', qty: '1 tsp',   item: 'Dried oregano' },
      { id: 's9', qty: '1/2 tsp',   item: 'Flaky salt' }
    ],
    prep: [
      { id: 'p1', text: 'Cut tomatoes into thick wedges.' },
      { id: 'p2', text: 'Slice cucumber into thick half-moons.' },
      { id: 'p3', text: 'Slice red onion paper-thin.' },
      { id: 'p4', text: 'Cut feta into rough cubes.' }
    ],
    cook: [
      { id: 'c1', text: 'Layer tomatoes, cucumber, onion in a wide bowl.' },
      { id: 'c2', text: 'Whisk oil, vinegar, oregano, salt for dressing.' },
      { id: 'c3', text: 'Pour dressing over the vegetables.' },
      { id: 'c4', text: 'Scatter olives + feta on top.' },
      { id: 'c5', text: 'Serve at room temperature.' }
    ]
  },
  {
    id: 'beef-tacos',
    name: 'BEEF TACOS',
    eyebrow: 'Weeknight',
    totalMin: 25,
    servings: 4,
    shop: [
      { id: 's1', qty: '1 lb',     item: 'Ground beef' },
      { id: 's2', qty: '1 packet', item: 'Taco seasoning' },
      { id: 's3', qty: '1/2 cup',    item: 'Water' },
      { id: 's4', qty: '8',        item: 'Corn tortillas' },
      { id: 's5', qty: '1 cup',    item: 'Shredded cheese' },
      { id: 's6', qty: '1',        item: 'Lime' },
      { id: 's7', qty: '1/4 cup',    item: 'Cilantro' },
      { id: 's8', qty: '1',        item: 'Avocado' },
      { id: 's9', qty: '1 cup',    item: 'Salsa' }
    ],
    prep: [
      { id: 'p1', text: 'Wedge the lime.' },
      { id: 'p2', text: 'Roughly chop the cilantro.' },
      { id: 'p3', text: 'Slice the avocado.' }
    ],
    cook: [
      { id: 'c1', text: 'Heat a skillet over medium-high.', timerSec: 120, tag: 'HEAT' },
      { id: 'c2', text: 'Brown the beef, breaking it apart.', timerSec: 300, tag: 'BROWN' },
      { id: 'c3', text: 'Drain fat, add seasoning + water, simmer.', timerSec: 180, tag: 'SIMMER' },
      { id: 'c4', text: 'Warm the tortillas in a dry pan.', timerSec: 60, tag: 'WARM' },
      { id: 'c5', text: 'Fill tortillas with beef. Top with cheese.' },
      { id: 'c6', text: 'Add salsa, avocado, cilantro, lime.' }
    ]
  },
  {
    id: 'banana-pancakes',
    name: 'BANANA PANCAKES',
    eyebrow: 'Breakfast',
    totalMin: 20,
    servings: 2,
    shop: [
      { id: 's1', qty: '1 cup',   item: 'All-purpose flour' },
      { id: 's2', qty: '1 tbsp',  item: 'Sugar' },
      { id: 's3', qty: '1 tsp',   item: 'Baking powder' },
      { id: 's4', qty: '1/2 tsp',   item: 'Salt' },
      { id: 's5', qty: '1 cup',   item: 'Milk' },
      { id: 's6', qty: '1',       item: 'Large egg' },
      { id: 's7', qty: '2 tbsp',  item: 'Butter, melted' },
      { id: 's8', qty: '2',       item: 'Ripe bananas' },
      { id: 's9', qty: 'To serve',item: 'Maple syrup' }
    ],
    prep: [
      { id: 'p1', text: 'Whisk flour, sugar, baking powder, salt.' },
      { id: 'p2', text: 'Mash one banana. Slice the other.' },
      { id: 'p3', text: 'Whisk milk, egg, and melted butter.' }
    ],
    cook: [
      { id: 'c1', text: 'Combine wet + dry. Fold in mashed banana.' },
      { id: 'c2', text: 'Heat a nonstick pan over medium.', timerSec: 90, tag: 'HEAT' },
      { id: 'c3', text: 'Pour 1/4 cup batter per pancake.', timerSec: 120, tag: 'COOK' },
      { id: 'c4', text: 'Flip when bubbles form. Cook other side.', timerSec: 90, tag: 'FLIP' },
      { id: 'c5', text: 'Plate. Top with sliced banana + maple syrup.' }
    ]
  },
  {
    id: 'cookies',
    name: 'CHOCOLATE CHIP COOKIES',
    eyebrow: 'Dessert',
    totalMin: 30,
    servings: 24,
    shop: [
      { id: 's1', qty: '2 1/4 cups', item: 'All-purpose flour' },
      { id: 's2', qty: '1 tsp',   item: 'Baking soda' },
      { id: 's3', qty: '1 tsp',   item: 'Salt' },
      { id: 's4', qty: '1 cup',   item: 'Butter, softened' },
      { id: 's5', qty: '3/4 cup',   item: 'Brown sugar' },
      { id: 's6', qty: '3/4 cup',   item: 'White sugar' },
      { id: 's7', qty: '2',       item: 'Large eggs' },
      { id: 's8', qty: '1 tsp',   item: 'Vanilla extract' },
      { id: 's9', qty: '2 cups',  item: 'Chocolate chips' }
    ],
    prep: [
      { id: 'p1', text: 'Preheat oven to 375°F.' },
      { id: 'p2', text: 'Whisk flour, baking soda, salt in a bowl.' },
      { id: 'p3', text: 'Bring butter to room temperature.' },
      { id: 'p4', text: 'Line baking sheets with parchment.' }
    ],
    cook: [
      { id: 'c1', text: 'Beat butter + sugars until creamy.', timerSec: 180, tag: 'BEAT' },
      { id: 'c2', text: 'Add eggs + vanilla, mix until smooth.' },
      { id: 'c3', text: 'Stir in flour mix until just combined.' },
      { id: 'c4', text: 'Fold in chocolate chips.' },
      { id: 'c5', text: 'Drop rounded spoonfuls onto sheets.' },
      { id: 'c6', text: 'Bake until edges are golden.', timerSec: 600, tag: 'BAKE' },
      { id: 'c7', text: 'Cool on sheets for 2 minutes.', timerSec: 120, tag: 'COOL' },
      { id: 'c8', text: 'Transfer to a wire rack to finish cooling.' }
    ]
  },
  {
    id: 'radish-slaw',
    name: 'SESAME RADISH SLAW',
    eyebrow: 'Side',
    totalMin: 15,
    servings: 4,
    shop: [
      { id: 's1', qty: '1 bunch', item: 'Radishes' },
      { id: 's2', qty: '1',       item: 'Cucumber' },
      { id: 's3', qty: '2 tbsp',  item: 'Rice vinegar' },
      { id: 's4', qty: '1 tbsp',  item: 'Soy sauce' },
      { id: 's5', qty: '1 tsp',   item: 'Sesame oil' },
      { id: 's6', qty: '1 tsp',   item: 'Sugar' },
      { id: 's7', qty: '1 tbsp',  item: 'Sesame seeds, toasted' },
      { id: 's8', qty: '1',       item: 'Scallion' },
      { id: 's9', qty: '1/4 tsp', item: 'Chili flakes (optional)' }
    ],
    prep: [
      { id: 'p1', text: 'Trim and slice radishes paper-thin.' },
      { id: 'p2', text: 'Slice cucumber thin into half-moons.' },
      { id: 'p3', text: 'Thinly slice the scallion on a bias.' }
    ],
    cook: [
      { id: 'c1', text: 'Whisk vinegar, soy, sesame oil, sugar in a bowl.' },
      { id: 'c2', text: 'Combine radishes + cucumber in a wide bowl.' },
      { id: 'c3', text: 'Pour dressing over, toss to coat.' },
      { id: 'c4', text: 'Let sit 5 minutes so the slices soften.', timerSec: 300, tag: 'REST' },
      { id: 'c5', text: 'Top with sesame seeds, scallion, chili flakes.' }
    ]
  }
];
