// ──────────────────────────────────────────────────────────────────
// ZORK I — world data
// A faithful tribute to the iconic 1981 Infocom adventure.
// Rooms, items, and scripted moments for the surface, the house,
// and the early underground (cellar → troll → gallery).
// ──────────────────────────────────────────────────────────────────

const ROOMS = {

  west_of_house: {
    name: "West of House",
    short: "West of House",
    desc: "You are standing in an open field west of a white house, with a boarded front door.",
    exits: { north: "north_of_house", south: "south_of_house", northeast: "north_of_house",
             southeast: "south_of_house", west: "forest_west",
             east: { msg: "The door is boarded and you can't remove the boards." },
             in:   { msg: "The door is boarded and you can't remove the boards." } },
    items: ["mailbox"],
  },

  north_of_house: {
    name: "North of House",
    short: "North of House",
    desc: "You are facing the north side of a white house. There is no door here, and all the windows are boarded up. To the north a narrow path winds through the trees.",
    exits: { west: "west_of_house", east: "behind_house", north: "forest_path",
             south: { msg: "The windows are all boarded." } },
  },

  south_of_house: {
    name: "South of House",
    short: "South of House",
    desc: "You are facing the south side of a white house. There is no door here, and all the windows are boarded.",
    exits: { west: "west_of_house", east: "behind_house",
             north: { msg: "The windows are all boarded." } },
  },

  behind_house: {
    name: "Behind House",
    short: "Behind House",
    desc: "You are behind the white house. A path leads into the forest to the east. In one corner of the house there is a small window which is slightly ajar.",
    exits: { north: "north_of_house", south: "south_of_house", east: "forest_east",
             west: { dyn: (s) => s.flags.windowOpen ? "kitchen" : { msg: "The window is closed." } },
             in:   { dyn: (s) => s.flags.windowOpen ? "kitchen" : { msg: "The window is closed." } } },
    items: ["window"],
  },

  forest_west: {
    name: "Forest",
    short: "Forest",
    desc: "This is a forest, with trees in all directions. To the east, there appears to be sunlight.",
    exits: { east: "west_of_house",
             north: { msg: "The forest becomes impenetrable to the north." },
             south: { msg: "Storm-tossed trees block your way." },
             west:  { msg: "You would need a machete to go further west." } },
  },

  forest_east: {
    name: "Forest",
    short: "Forest",
    desc: "This is a dimly lit forest, with large trees all around. To the west is a path.",
    exits: { west: "behind_house",
             north: "clearing",
             south: { msg: "Storm-tossed trees block your way." },
             east:  { msg: "The forest thickens, but is hardly impenetrable." } },
  },

  forest_path: {
    name: "Forest Path",
    short: "Forest Path",
    desc: "This is a path winding through a dimly lit forest. The path heads north-south here. One particularly large tree with some low branches stands at the edge of the path.",
    exits: { south: "north_of_house", north: "clearing", up: "up_a_tree",
             east: { msg: "The forest becomes impenetrable to the east." },
             west: { msg: "The forest becomes impenetrable to the west." } },
  },

  up_a_tree: {
    name: "Up a Tree",
    short: "Up a Tree",
    desc: "You are about 10 feet above the ground nestled among some large branches. The nearest branch above you is above your reach.\nBeside you on the branch is a small bird's nest.",
    exits: { down: "forest_path",
             up:    { msg: "You cannot climb any higher." } },
    items: ["nest"],
  },

  clearing: {
    name: "Clearing",
    short: "Clearing",
    desc: "You are in a clearing, with a forest surrounding you on all sides. A path leads south.",
    exits: { south: "forest_path", east: "forest_east",
             north: { msg: "The forest becomes impenetrable to the north." },
             west:  { msg: "The forest becomes impenetrable to the west." },
             down:  { dyn: (s) => s.flags.gratingUnlocked ? { msg: "The grating is locked." } : { msg: "You see a grating half-buried under a pile of leaves." } } },
    items: ["leaves"],
  },

  // ── HOUSE INTERIOR ──────────────────────────────────────

  kitchen: {
    name: "Kitchen",
    short: "Kitchen",
    desc: "You are in the kitchen of the white house. A table seems to have been used recently for the preparation of food. A passage leads to the west and a dark staircase can be seen leading upward. A dark chimney leads down and to the east is a small window which is open.",
    exits: { west: "living_room", up: "attic", east: "behind_house", out: "behind_house",
             down: { msg: "Only Santa Claus climbs down chimneys." } },
    items: ["table", "sack", "bottle"],
  },

  living_room: {
    name: "Living Room",
    short: "Living Room",
    desc: { dyn: (s) => "You are in the living room. There is a doorway to the east, a wooden door with strange gothic lettering to the west, which appears to be nailed shut, a trophy case, and "
      + (s.flags.rugMoved
          ? (s.flags.trapdoorOpen
              ? "an open trap door in the floor."
              : "the dusty cover of a closed trap door in the floor.")
          : "a large oriental rug in the center of the room.") },
    exits: { east: "kitchen",
             west: { msg: "The door is nailed shut." },
             down: { dyn: (s) => s.flags.trapdoorOpen ? "cellar" : (s.flags.rugMoved ? { msg: "The trap door is closed." } : { msg: "There is no way down." }) } },
    items: ["trophy_case", "rug", "sword", "lantern"],
  },

  attic: {
    name: "Attic",
    short: "Attic",
    desc: "This is the attic. The only exit is a stairway leading down.",
    exits: { down: "kitchen" },
    items: ["rope", "knife"],
  },

  // ── UNDERGROUND ─────────────────────────────────────────

  cellar: {
    name: "Cellar",
    short: "Cellar",
    desc: "You are in a dark and damp cellar with a narrow passageway leading north, and a crawlway to the south. On the west is the bottom of a steep metal ramp which is unclimbable.",
    exits: { north: "troll_room", south: "east_of_chasm",
             up: { dyn: (s) => s.flags.trapdoorOpen ? "living_room" : { msg: "The trap door is closed." } },
             west: { msg: "The metal ramp is unclimbable." } },
    dark: true,
  },

  troll_room: {
    name: "The Troll Room",
    short: "Troll Room",
    desc: "This is a small room with passages to the east and south and a forbidding hole leading west. Bloodstains and deep scratches (perhaps made by an axe) mar the walls.",
    exits: { south: "cellar", east: "east_west_passage",
             west: { msg: "Cretin, the troll wouldn't let you pass." } },
    items: ["troll"],
    dark: true,
  },

  east_west_passage: {
    name: "East-West Passage",
    short: "E-W Passage",
    desc: "This is a narrow east-west passageway. There is a narrow stairway leading down at the north end of the room.",
    exits: { west: "troll_room", east: "round_room",
             down: { msg: "The stairway is barricaded with rubble." },
             north: { msg: "The stairway is barricaded with rubble." } },
    dark: true,
  },

  round_room: {
    name: "Round Room",
    short: "Round Room",
    desc: "This is a circular stone room with passages in all directions. Several of the passages have been blocked by cave-ins.",
    exits: { west: "east_west_passage", northeast: "gallery" },
    dark: true,
  },

  gallery: {
    name: "Gallery",
    short: "Gallery",
    desc: "This is an art gallery. Most of the paintings have been stolen by vandals with exceptional taste. The vandals left through either the north or west exits.",
    exits: { southwest: "round_room",
             north: { msg: "A massive rockfall blocks the way." },
             west:  { msg: "A massive rockfall blocks the way." } },
    items: ["painting"],
    dark: true,
  },

  east_of_chasm: {
    name: "East of Chasm",
    short: "East of Chasm",
    desc: "You are on the east edge of a chasm, the bottom of which cannot be seen. A narrow passage goes north, and the path you are on continues to the east.",
    exits: { north: "cellar",
             east:  { msg: "A massive rockfall blocks the way." },
             down:  { msg: "It would be a long, long fall." } },
    dark: true,
  },
};


// ── ITEMS ────────────────────────────────────────────────

const ITEMS = {

  mailbox: {
    name: "small mailbox",
    short: "small mailbox",
    article: "a",
    fixed: true,
    container: true,
    closed: true,
    contains: ["leaflet"],
    examine: (s) => s.items.mailbox.closed
      ? "The small mailbox is closed."
      : (s.items.mailbox.contains.length
          ? "The small mailbox contains:\n  A leaflet"
          : "The small mailbox is empty."),
  },

  leaflet: {
    name: "leaflet",
    short: "leaflet",
    article: "a",
    examine: () => "  WELCOME TO ZORK!\n\n  ZORK is a game of adventure, danger, and low cunning. In it you will explore some of the most amazing territory ever seen by mortals. No computer should be without one!",
    read: true,
  },

  window: {
    name: "small window",
    short: "small window",
    article: "the",
    fixed: true,
    closed: true,
    examine: (s) => s.flags.windowOpen
      ? "The window is open just enough to allow entry."
      : "The window is slightly ajar, but not enough to allow entry.",
  },

  nest: {
    name: "bird's nest",
    short: "bird's nest",
    article: "a",
    fixed: true,
    container: true,
    contains: ["egg"],
    examine: () => "The bird's nest, made of woven twigs, is empty now that you've removed the egg." ,
    examineWithEgg: () => "In the bird's nest is a large egg encrusted with precious jewels.",
  },

  egg: {
    name: "jewel-encrusted egg",
    short: "jewel-encrusted egg",
    article: "a",
    treasure: 5,
    deposit: 5,
    examine: () => "The egg is covered with fine gold inlay, and ornamented in lapis lazuli and mother-of-pearl. Unlike most eggs, this one is hinged and closed with a delicate looking clasp. The egg appears extremely fragile.",
  },

  leaves: {
    name: "pile of leaves",
    short: "pile of leaves",
    article: "a",
    fixed: true,
    examine: (s) => s.flags.leavesMoved ? "The leaves are scattered, revealing a grating set into the ground." : "There is a pile of leaves on the ground.",
  },

  table: {
    name: "kitchen table",
    short: "kitchen table",
    article: "the",
    fixed: true,
    examine: () => "The table has been used for the preparation of food. Crumbs are scattered across its surface.",
  },

  sack: {
    name: "brown sack",
    short: "brown sack",
    article: "a",
    container: true,
    closed: true,
    contains: ["garlic", "lunch"],
    examine: (s) => s.items.sack.closed
      ? "The brown sack is closed."
      : "The brown sack contains:\n  A clove of garlic\n  A lunch",
  },

  garlic: {
    name: "clove of garlic",
    short: "clove of garlic",
    article: "a",
    examine: () => "It's a clove of garlic. Its odor is aromatic.",
  },

  lunch: {
    name: "lunch",
    short: "lunch",
    article: "a",
    examine: () => "Looks like a hot pepper sandwich. It is wrapped in waxed paper.",
  },

  bottle: {
    name: "glass bottle",
    short: "glass bottle",
    article: "a",
    container: true,
    closed: true,
    contains: ["water"],
    examine: () => "The glass bottle contains:\n  A quantity of water",
  },

  water: {
    name: "quantity of water",
    short: "water",
    article: "some",
    examine: () => "It's just water.",
  },

  trophy_case: {
    name: "trophy case",
    short: "trophy case",
    article: "the",
    fixed: true,
    container: true,
    contains: [],
    examine: (s) => s.items.trophy_case.contains.length === 0
      ? "The trophy case is empty."
      : "The trophy case contains:\n" + s.items.trophy_case.contains.map(id => "  " + capitalize(itemArticle(id) + " " + ITEMS[id].short)).join("\n"),
  },

  rug: {
    name: "oriental rug",
    short: "oriental rug",
    article: "a",
    fixed: true,
    examine: (s) => s.flags.rugMoved
      ? "The rug, now bunched in one corner of the room, was once a magnificent oriental — its colors faded by centuries of dust."
      : "The large oriental rug is just as it was when you arrived: faded but elegant, occupying the center of the room.",
  },

  trapdoor: {
    name: "trap door",
    short: "trap door",
    article: "a",
    fixed: true,
    examine: (s) => s.flags.trapdoorOpen
      ? "The dusty trap door is open, revealing a rickety staircase descending into darkness."
      : "The dusty trap door is closed.",
  },

  sword: {
    name: "elvish sword",
    short: "elvish sword",
    article: "an",
    examine: () => "It's an elvish sword of great antiquity. The runes on its blade are too old to read.",
  },

  lantern: {
    name: "brass lantern",
    short: "brass lantern",
    article: "a",
    examine: (s) => s.flags.lanternOn ? "The brass lantern is on, casting a warm glow." : "The brass lantern is off.",
  },

  rope: {
    name: "rope",
    short: "rope",
    article: "a",
    examine: () => "It's a sturdy length of hemp rope, perhaps thirty feet long.",
  },

  knife: {
    name: "nasty knife",
    short: "nasty knife",
    article: "a",
    examine: () => "It is a nasty-looking knife.",
  },

  troll: {
    name: "troll",
    short: "troll",
    article: "a",
    fixed: true,
    examine: (s) => s.flags.trollDead
      ? "The troll is dead."
      : "A nasty-looking troll, brandishing a bloody axe, blocks all passages out of the room.",
  },

  axe: {
    name: "bloody axe",
    short: "bloody axe",
    article: "a",
    examine: () => "The axe is covered in dried blood. The handle is splintered.",
  },

  coins: {
    name: "leather pouch of coins",
    short: "leather pouch",
    article: "a",
    treasure: 5,
    deposit: 5,
    examine: () => "Inside the leather pouch are dozens of old gold coins, stamped with strange symbols.",
  },

  painting: {
    name: "painting",
    short: "painting",
    article: "a",
    treasure: 5,
    deposit: 7,
    examine: () => "It's a beautiful work, undoubtedly painted by a master. You feel privileged to have rescued it from the vandals.",
  },
};


function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function itemArticle(id) {
  const it = ITEMS[id];
  return it.article || "a";
}


// ── INITIAL STATE ────────────────────────────────────────

function makeInitialState() {
  // Deep-clone item.contains so play state can mutate freely.
  const items = {};
  for (const id in ITEMS) {
    items[id] = {
      contains: ITEMS[id].contains ? [...ITEMS[id].contains] : undefined,
      closed: !!ITEMS[id].closed,
    };
  }
  return {
    location: "west_of_house",
    inventory: [],
    items,
    score: 0,
    moves: 0,
    flags: {
      windowOpen: false,
      rugMoved: false,
      trapdoorOpen: false,
      enteredCellar: false,
      lanternOn: false,
      trollDead: false,
      coinsRevealed: false,
      eggTaken: false,
      leavesMoved: false,
      gratingUnlocked: false,
      verbose: true,
      visited: { west_of_house: true },
      examined: {},
      darkMoves: 0,
      gameOver: false,
      awaitingStart: false,
      // achievements (one-shot point gates)
      a_openMailbox: false,
      a_readLeaflet: false,
      a_enteredHouse: false,
      a_tookSword: false,
      a_tookLantern: false,
      a_litLantern: false,
      a_movedRug: false,
      a_openedTrap: false,
      a_enteredCellar: false,
      a_killedTroll: false,
      a_tookEgg: false,
      a_tookCoins: false,
      a_tookPainting: false,
      a_depositedEgg: false,
      a_depositedCoins: false,
      a_depositedPainting: false,
    },
    trollHp: 3,
  };
}
