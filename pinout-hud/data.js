/* ═══════════════════════════════════════════════════════════
   PINOUT HUD · Reference data
   ─ ESP32 board templates
   ─ Standard pin labels for custom boards
   ─ Wire color palette
   ═══════════════════════════════════════════════════════════ */

/* Wire color codes — must match CSS custom properties --w-* */
const WIRE_COLORS = [
  { id: 'red',    name: 'RED',    swatch: 'var(--w-red)' },
  { id: 'black',  name: 'BLACK',  swatch: 'var(--w-black)' },
  { id: 'blue',   name: 'BLUE',   swatch: 'var(--w-blue)' },
  { id: 'green',  name: 'GREEN',  swatch: 'var(--w-green)' },
  { id: 'yellow', name: 'YELLOW', swatch: 'var(--w-yellow)' },
  { id: 'orange', name: 'ORANGE', swatch: 'var(--w-orange)' },
  { id: 'white',  name: 'WHITE',  swatch: 'var(--w-white)' },
  { id: 'purple', name: 'PURPLE', swatch: 'var(--w-purple)' }
];

/* Default wire color by pin label class — convention used on benches:
   power = red, ground = black, data = blue, signal = green/yellow */
function defaultColorFor(label) {
  const u = String(label).toUpperCase();
  if (u === 'GND')                                       return 'black';
  if (u === '3V3' || u === '5V' || u === 'VIN' || u === 'VCC') return 'red';
  if (u === 'EN'  || u === 'RST')                        return 'orange';
  if (u.startsWith('TX') || u === 'U0T')                 return 'green';
  if (u.startsWith('RX') || u === 'U0R')                 return 'yellow';
  if (u === 'SCK' || u === 'SCL' || u === 'CLK')         return 'purple';
  if (u === 'SDA' || u === 'MOSI' || u === 'MISO' || u === 'SS') return 'white';
  return 'blue'; /* generic GPIO / signal */
}

/* Two-axis grid of common labels.
   Rows are loosely categorical (power, control, bus, GPIO, analog/digital)
   so spatial memory builds quickly: Up/Down jumps category, Left/Right
   walks within. 5 cols × 9 rows = 45 labels reachable in ≤4 swipes from
   any starting cell. */
const LABEL_GRID = [
  ['GND',    '3V3',    '5V',     'VIN',    'VCC'   ],
  ['EN',     'RST',    'TX',     'RX',     'SDA'   ],
  ['SCL',    'MOSI',   'MISO',   'SCK',    'SS'    ],
  ['GPIO0',  'GPIO1',  'GPIO2',  'GPIO3',  'GPIO4' ],
  ['GPIO5',  'GPIO12', 'GPIO13', 'GPIO14', 'GPIO15'],
  ['GPIO16', 'GPIO17', 'GPIO18', 'GPIO19', 'GPIO21'],
  ['GPIO22', 'GPIO23', 'GPIO25', 'GPIO26', 'GPIO27'],
  ['GPIO32', 'GPIO33', 'GPIO34', 'GPIO35', 'GPIO36'],
  ['GPIO39', 'A0',     'A1',     'D0',     'D1'    ]
];

/* Flat list — kept for any code that wants membership tests */
const STANDARD_LABELS = LABEL_GRID.flat();

/* Map label → [row, col] for setting initial focus on the picker */
const LABEL_POS = (() => {
  const m = {};
  for (let r = 0; r < LABEL_GRID.length; r++) {
    for (let c = 0; c < LABEL_GRID[r].length; c++) {
      m[LABEL_GRID[r][c]] = [r, c];
    }
  }
  return m;
})();

/* Helper: build a pin row from label */
function p(label) {
  return { label, color: defaultColorFor(label) };
}

/* ESP32 board templates — ordered as the user would see them on a breadboard,
   pin index 1 starts at top-left and continues down. Real datasheets group by
   side; we flatten for a single scrollable HUD list. */
const ESP32_TEMPLATES = [
  {
    id: 'esp32-wroom',
    name: 'ESP32-WROOM-32',
    eyebrow: '38-PIN DEVKIT · 30 SIGNAL',
    pins: [
      p('3V3'),  p('EN'),    p('GPIO36'), p('GPIO39'),
      p('GPIO34'), p('GPIO35'), p('GPIO32'), p('GPIO33'),
      p('GPIO25'), p('GPIO26'), p('GPIO27'), p('GPIO14'),
      p('GPIO12'), p('GND'),  p('GPIO13'), p('VIN'),
      p('GND'),  p('GPIO23'), p('GPIO22'), p('TX0'),
      p('RX0'),  p('GPIO21'), p('GPIO19'), p('GPIO18'),
      p('GPIO5'),  p('TX2'),  p('RX2'),    p('GPIO4'),
      p('GPIO0'),  p('GPIO2')
    ]
  },
  {
    id: 'esp32-cam',
    name: 'ESP32-CAM',
    eyebrow: 'AI-THINKER · 16 PIN',
    pins: [
      p('5V'),    p('GND'),  p('GPIO12'), p('GPIO13'),
      p('GPIO15'), p('GPIO14'), p('GPIO2'), p('GPIO4'),
      p('GND'),   p('3V3'),  p('U0R'),    p('U0T'),
      p('GPIO16'), p('GPIO0'), p('VCC'),  p('GND')
    ]
  },
  {
    id: 'esp8266-nodemcu',
    name: 'ESP8266 NODEMCU',
    eyebrow: 'AMICA · 16 PIN',
    pins: [
      p('3V3'), p('GND'),  p('TX'),    p('RX'),
      p('D0'),  p('D1'),   p('D2'),    p('D3'),
      p('D4'),  p('D5'),   p('D6'),    p('D7'),
      p('D8'),  p('A0'),   p('VIN'),   p('RST')
    ]
  },
  {
    id: 'esp32-s3',
    name: 'ESP32-S3 MINI',
    eyebrow: 'DEVKIT-C · 24 PIN',
    pins: [
      p('5V'),    p('3V3'),    p('GND'),    p('EN'),
      p('GPIO0'),  p('GPIO1'),  p('GPIO2'),  p('GPIO3'),
      p('GPIO4'),  p('GPIO5'),  p('GPIO6'),  p('GPIO7'),
      p('GPIO8'),  p('GPIO9'),  p('GPIO10'), p('GPIO11'),
      p('GPIO12'), p('GPIO13'), p('GPIO14'), p('GPIO15'),
      p('TX'),    p('RX'),     p('SDA'),    p('SCL')
    ]
  }
];

