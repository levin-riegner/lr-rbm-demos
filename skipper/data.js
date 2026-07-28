/* ─────────────────────────────────────────────────────────────
   SKIPPER — content layer.

   Everything the app knows lives here, so app.js stays a state
   machine and this file stays a document you can argue with.

   THE PREMISE THIS CONTENT IS WRITTEN FOR
   ---------------------------------------
   One person, alone, on a small open boat in Greek island water,
   wearing the glasses, with NO other source of information — no
   manual in the locker, no phone in a dry bag, no crew who has
   done this before. That premise decides three things:

   1. Nothing is assumed known. The step that says "the engine
      will not start in gear" is there because that is the single
      most common reason a rented outboard "won't start", and
      nobody at the dock ever mentions it.
   2. Every step carries a WHY. People skip instructions they
      don't understand and remember the ones they do. On a boat
      the skipped one is the drain plug.
   3. Numbers that vary unit-to-unit are marked, never guessed.
      A confidently wrong fuel capacity is worse than a blank —
      so per-hull figures below are only the published ones, and
      anything that changes between individual rental boats is
      flagged CONFIRM and asked about on the HANDOVER screen.

   SOURCES for the hull figures
   ----------------------------
   Nikita 470 (sold as SEAROVER 470) — NauticExpo / Nikita Boats.
   Poseidon Blu Water 170 — Poseidon Boats, itBoat, Greek charter
     listings (4-stroke 30 hp + 4 hp auxiliary, 60 L integral tank).
   Mostro Corvette 68 — 2024 RIB, Paros charter listings
     (~6.8 m / 22.97 ft, ~250 hp, 9 persons).
   ───────────────────────────────────────────────────────────── */

(() => {
  'use strict';

  /* ═══════════════════════ BOATS ═══════════════════════
     `traits` are the switches the procedures read. They are what
     make START THE ENGINE a different list of steps on a 30 hp
     license-free console boat and on a 250 hp RIB.

     tokens usable in any step/check text:
       {{boat}} {{people}} {{hp}} {{fuel}} {{loa}}          */

  const BOATS = {
    nikita: {
      key: 'nikita',
      name: 'NIKITA 470',
      sub: 'SEAROVER 470 · GRP CENTER CONSOLE',
      badge: 'N470',
      // published figures
      loa: '4.73 m',
      type: 'OPEN BOAT',
      beam: '2.00 m',
      draft: '0.31 m',
      dry: '480 kg',
      people: 6,
      maxLoad: '555 kg',
      hp: 'OUTBOARD, UP TO 60 hp',
      hpConfirm: true,
      fuel: 'PORTABLE / UNDER-DECK TANK',
      fuelConfirm: true,
      ce: 'C — INSHORE, SHELTERED WATER',
      licence: 'NONE IN GREECE IF THE ENGINE IS 30 hp OR LESS',
      licenceConfirm: true,
      traits: {
        rib: false,
        bigPower: false,
        aux: false,
        tiltIsPower: false,
        gelcoat: true,
      },
      // the one-line character sketch that sets expectations
      character:
        'Light, small, and quick to plane. Six people is the plate ' +
        'rating, not a comfortable day — with a full load she sits ' +
        'deep and gets wet in any chop.',
    },

    bluwater: {
      key: 'bluwater',
      name: 'BLU WATER 170',
      sub: 'POSEIDON · GRP CENTER CONSOLE',
      badge: 'BW170',
      loa: '4.99 m',
      type: 'OPEN BOAT',
      // published listings give length and draft but no reliable
      // beam, so it is a blank to ask about rather than a guess
      beam: '—',
      beamConfirm: true,
      draft: '0.30 m',
      dry: '—',
      people: 7,
      maxLoad: 'SEE THE BUILDER PLATE IN THE COCKPIT',
      hp: 'YAMAHA 30 hp 4-STROKE · 4 hp AUXILIARY',
      hpConfirm: true,
      fuel: '60 L INTEGRAL (+12 L SPARE CAN)',
      fuelConfirm: true,
      ce: 'C — COASTAL, RIVERS AND CANALS',
      licence: 'NONE IN GREECE AT 30 hp',
      licenceConfirm: true,
      traits: {
        rib: false,
        bigPower: false,
        aux: true,
        tiltIsPower: false,
        gelcoat: true,
      },
      character:
        'The classic Greek license-free day boat. Slow, forgiving, ' +
        'self-draining cockpit, and a 4 hp auxiliary on the bracket ' +
        'that turns a dead main engine into an inconvenience instead ' +
        'of an emergency.',
    },

    mostro: {
      key: 'mostro',
      name: 'MOSTRO CORVETTE',
      sub: 'CORVETTE 68 · 6.8 m OFFSHORE RIB',
      badge: 'MC68',
      loa: '6.8 m (22.97 ft)',
      type: 'RIB',
      beam: '—',
      draft: '—',
      dry: '—',
      people: 9,
      maxLoad: 'SEE THE BUILDER PLATE',
      hp: 'UP TO ~250 hp OUTBOARD',
      hpConfirm: true,
      fuel: 'LARGE UNDER-DECK TANK',
      fuelConfirm: true,
      ce: 'CONFIRM WITH THE OPERATOR',
      ceConfirm: true,
      licence: 'YES — A BOAT LICENCE IS REQUIRED FOR THIS POWER',
      traits: {
        rib: true,
        bigPower: true,
        aux: false,
        tiltIsPower: true,
        gelcoat: false,
      },
      character:
        'A different animal. Roughly eight times the power of the ' +
        'other two, so the throttle is a decision and not a request. ' +
        'Tubes forgive the dock and punish neglect: soft tubes ruin ' +
        'the way she handles.',
    },
  };

  const BOAT_ORDER = ['nikita', 'bluwater', 'mostro'];

  /* ═══════════════════ SETTABLE VALUES ═══════════════════
     There is no keyboard on the glasses, so these are wheels.
     They are set once during HANDOVER and then read back on the
     home header and the boat card all day.                     */

  const SETTINGS = {
    returnBy: {
      label: 'BACK AT THE DOCK BY',
      options: (() => {
        const out = ['—'];
        for (let h = 8; h <= 22; h++) {
          for (const m of [0, 15, 30, 45]) {
            out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
          }
        }
        return out;
      })(),
      defaultValue: '18:00',
    },
    jackets: {
      label: 'LIFEJACKETS COUNTED ABOARD',
      options: ['—', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
      defaultValue: '—',
    },
    fuel: {
      label: 'FUEL SHOWING AT PICKUP',
      options: ['—', 'EMPTY', 'ONE QUARTER', 'HALF', 'THREE QUARTERS', 'FULL'],
      defaultValue: '—',
    },
  };

  /* ═══════════════════════ CHECKLISTS ═══════════════════════
     type 'ask'  → tick it off
     type 'set'  → tick it off AND record a value
     `only` / `not` gate an item to particular hulls.            */

  const CHECKS = {
    handover: {
      title: 'HANDOVER',
      eyebrow: 'ASK BEFORE YOU SIGN',
      intro:
        'The person handing you the keys will tell you everything ' +
        'in ninety seconds and you will remember a third of it. ' +
        'Make them show you, not tell you.',
      items: [
        {
          text: 'SHOW ME THE KILL CORD',
          note:
            'The red lanyard that stops the engine if you leave the helm. ' +
            'Ask where it clips. Most engines will not start without it fitted.',
        },
        {
          text: 'START IT, STOP IT, THEN LET ME DO IT',
          note:
            'Do the whole sequence yourself once, while someone who knows ' +
            'the boat is standing there. This is the single most useful ' +
            'sixty seconds of the day.',
        },
        {
          text: 'WHERE IS THE FUEL VALVE AND THE TANK VENT?',
          note:
            'You need to open it to run and close it to stop. A closed vent ' +
            'makes an engine that dies five minutes out for no reason.',
        },
        {
          text: 'HOW MUCH FUEL, AND IS IT PAID FOR?',
          note:
            'Ask for the gauge reading and what "full" costs. Then set it here ' +
            'so you can prove what you started with.',
          type: 'set',
          setting: 'fuel',
        },
        {
          text: 'IS THE DRAIN PLUG IN? SHOW ME WHERE IT IS',
          note:
            'The bung in the transom. Out means the boat fills. It is the ' +
            'most common way a small boat sinks and it is always avoidable.',
        },
        {
          text: 'WHERE IS THE BILGE PUMP SWITCH?',
          note: 'Find it now, in daylight, dry, calm. Not later.',
        },
        {
          text: 'COUNT THE LIFEJACKETS WITH ME',
          note:
            'One per person, and at least one that fits each child. Count ' +
            'them, do not accept a number.',
          type: 'set',
          setting: 'jackets',
        },
        {
          text: 'SHOW ME THE ANCHOR AND HOW MUCH ROPE',
          note:
            'You need to know the length to know where you can anchor. Check ' +
            'the bitter end is actually tied to the boat.',
        },
        {
          text: 'WHERE IS THE HORN, THE FLARES, THE EXTINGUISHER, THE FIRST AID KIT?',
          note:
            'Four locations. Touch each one. Under a seat cushion you have ' +
            'never lifted is not a location you know.',
        },
        {
          text: 'IS THERE A VHF RADIO, AND IS IT WORKING?',
          note:
            'If yes, learn how to switch it on and set channel 16. If no, ' +
            'that changes your whole plan — stay in phone signal and close ' +
            'to other boats.',
        },
        {
          text: 'WHAT IS THIS BOAT CALLED, AND WHAT IS YOUR NUMBER?',
          note:
            'You will need the boat name to call for help and their number ' +
            'for everything else. Say both back to them out loud.',
        },
        {
          text: 'WHERE MUST I NOT GO?',
          note:
            'Every operator has a line on the chart — a crossing, a headland, ' +
            'a reef, a beach. Ask which way the wind will turn today, too. ' +
            'They watch it every day of the season.',
        },
        {
          text: 'WHAT TIME BACK, AND EXACTLY WHERE DO I TIE UP?',
          note:
            'Get the berth, not just the harbour. Then set the time — the ' +
            'header will count down to it all day.',
          type: 'set',
          setting: 'returnBy',
        },
        {
          text: 'WALK THE HULL AND PHOTOGRAPH EVERY MARK',
          note:
            'Both sides, the transom, the prop, the tubes. Five minutes now ' +
            'settles an argument later that you would otherwise lose.',
        },
      ],
    },

    predep: {
      title: 'BEFORE CAST OFF',
      eyebrow: 'THE LAST LOOK',
      intro:
        'Nine things, every single time you leave the dock, in this ' +
        'order. Skippers who have done it a thousand times still do it.',
      items: [
        {
          text: 'DRAIN PLUG IN',
          note:
            'Hand tight, then check it a second time. If the cockpit is ' +
            'self-draining, the transom bung still has to be in.',
        },
        {
          text: 'KILL CORD CLIPPED TO YOUR LEG',
          note:
            'Your thigh or your lifejacket. Not the wheel, not the rail. ' +
            'A boat circling back at a swimmer is what this prevents.',
        },
        {
          text: 'BILGE DRY, PUMP WORKS',
          note:
            'Run the pump for two seconds and hear it. Water already in ' +
            'the bilge before you leave means find out why.',
        },
        {
          text: 'FUEL: VENT OPEN, LINE ON, ENOUGH FOR THIRDS',
          note:
            'One third out, one third back, one third untouched. Chop and ' +
            'headwind can double the burn — the reserve is not optional.',
        },
        {
          text: 'TUBE PRESSURE FIRM',
          note:
            'Press hard with a thumb — firm, barely any give. Tubes soften ' +
            'overnight and in cool water, and a soft tube makes the boat ' +
            'wallow and steer badly.',
          only: ['mostro'],
        },
        {
          text: 'LIFEJACKETS ON THE CHILDREN, IN REACH FOR EVERYONE',
          note:
            'Children and non-swimmers wear them from the dock. Adults at ' +
            'least know which locker. Nobody puts one on in an emergency.',
        },
        {
          text: 'ENGINE DOWN, PROP CLEAR, SWINGS FREELY',
          note:
            'Look over the transom. A line in the water near the prop is a ' +
            'dead engine thirty seconds from now.',
        },
        {
          text: 'ANCHOR AND ROPE ABOARD, BITTER END TIED ON',
          note:
            'Follow the rope to its end with your hand. Anchors get thrown ' +
            'overboard with nothing holding the other end more often than ' +
            'you would believe.',
        },
        {
          text: 'NOTHING TRAILING IN THE WATER',
          note:
            'Lines, fenders, towels, swim ladder. Everything aboard before ' +
            'the engine goes into gear.',
        },
        {
          text: 'WIND AND SEA CHECKED — WHICH WAY WILL IT BUILD?',
          note:
            'In the Cyclades the wind usually fills in through the ' +
            'afternoon. Plan to go upwind first so the ride home is downwind.',
        },
        {
          text: 'SOMEONE ASHORE KNOWS WHERE AND WHEN',
          note:
            'Where you are going and what time you are back. It is what ' +
            'starts a search before it gets dark.',
        },
        {
          text: 'WATER, SHADE, SUNSCREEN, HAT',
          note:
            'Heat and dehydration end more days on the water than engines ' +
            'do, and they wreck your judgement before you notice.',
        },
      ],
    },

    shutdown: {
      title: 'SHUT DOWN',
      eyebrow: 'PUTTING HER TO BED',
      intro:
        'Do this before you walk away, not after you remember at ' +
        'dinner.',
      items: [
        {
          text: 'TWO LINES ON BEFORE ANYTHING ELSE',
          note:
            'Bow and stern secured first. Tidying up on an unsecured boat ' +
            'is how boats leave without you.',
        },
        {
          text: 'ENGINE OFF, KEY OUT, KILL CORD OFF',
          note: 'In that order. Take the key with you.',
        },
        {
          text: 'FUEL VALVE OFF, VENT CLOSED',
          note:
            'Stops fuel weeping and stops the tank breathing hot air all ' +
            'afternoon.',
        },
        {
          text: 'BILGE DRY, PUMP OFF, BATTERY ISOLATED',
          note:
            'A pump left on will flatten the battery by morning, and then ' +
            'nothing works when it matters.',
        },
        {
          text: 'TILT THE ENGINE UP',
          note:
            'Leg out of the water so the water pump and the anodes are not ' +
            'sitting in salt all night — unless the operator told you to ' +
            'leave it down.',
        },
        {
          text: 'DRAIN PLUG: OUT IF SHE COMES OUT, IN IF SHE STAYS IN',
          note:
            'On a trailer or ashore, take it out so she drains. Left in the ' +
            'water, it stays IN. Getting this backwards sinks the boat.',
        },
        {
          text: 'TUBES WIPED, PRESSURE CHECKED',
          note:
            'Salt dries abrasive on hypalon, and tubes go soft as the air ' +
            'cools tonight.',
          only: ['mostro'],
        },
        {
          text: 'FENDERS SET, LINES DOUBLED IF WIND IS COMING',
          note:
            'Fenders at the rubbing line. If it is going to blow overnight, ' +
            'a second line costs you thirty seconds.',
        },
        {
          text: 'REPORT ANYTHING YOU HIT, HEARD, OR BROKE',
          note:
            'Say it out loud to the operator. A declared scrape is cheap. ' +
            'A hidden one found next week is not.',
        },
        {
          text: 'COUNT YOUR CREW, YOUR BAGS, AND YOUR RUBBISH',
          note:
            'Phones and keys live in the seat lockers. Take the rubbish — ' +
            'there is nowhere for it to go out there.',
        },
      ],
    },
  };

  /* ═══════════════════════ STEP FLOWS ═══════════════════════
     Each step: { do, why, watch?, only?, not? }
     `do` is the instruction and it is the biggest thing on the lens.
     `why` is the reason, because understood steps get done.
     `watch` is the classic mistake, in amber.                    */

  const FLOWS = {
    start: {
      title: 'START THE ENGINE',
      eyebrow: 'COLD START, IN ORDER',
      steps: [
        {
          do: 'SIT DOWN AND CLIP THE KILL CORD TO YOUR LEG',
          why: 'It stops the engine if you go over. Fitting it is also what lets most engines start at all.',
          watch: 'Clipped to the rail or the wheel does nothing at all.',
        },
        {
          do: 'OPEN THE TANK VENT. FUEL VALVE ON',
          why: 'A sealed tank cannot feed the engine. It will run for a few minutes on what is in the line, then die.',
          watch: 'An engine that starts fine and dies later is almost always a closed vent.',
        },
        {
          do: 'SQUEEZE THE PRIMER BULB UNTIL IT GOES HARD',
          why: 'It fills the fuel line so the engine has something to fire on. Hold the bulb with the arrow pointing up toward the engine.',
          watch: 'If the bulb never firms up, the fuel line is loose or the tank is dry.',
          not: ['mostro'],
        },
        {
          do: 'TILT THE ENGINE FULLY DOWN',
          why: 'The water intake on the leg has to be under water or the engine cooks itself in about a minute.',
          watch: 'Half-tilted still looks fine from the helm. Look over the transom.',
        },
        {
          do: 'CHECK THE PROP IS CLEAR AND SWINGS FREE',
          why: 'A mooring line, a weed raft, or a swimmer behind the transom. Look, do not assume.',
        },
        {
          do: 'BATTERY SWITCH ON',
          why: 'Isolator to ON — or to BOTH if there are two batteries.',
        },
        {
          do: 'PUT THE SHIFT INTO NEUTRAL',
          why: 'The engine physically will not crank in gear. This is the number one reason a rented outboard "will not start".',
          watch: 'Neutral is a detent, not a range. Feel it click and the throttle go loose.',
        },
        {
          do: 'COLD ENGINE: FAST IDLE UP ONE NOTCH',
          why: 'A cold outboard needs a little extra throttle or choke to catch. If she is already warm, skip this.',
          watch: 'Too much fast idle and she will lurch when you shift. Bring it back down as soon as she runs.',
          not: ['mostro'],
        },
        {
          do: 'TURN THE KEY. RELEASE IT THE MOMENT SHE FIRES',
          why: 'Short bursts of five seconds, then wait ten. Cranking flattens the battery quickly and floods the engine.',
          watch: 'Pull-start instead? Take up the slack first, then one firm smooth pull. Never a jerk.',
        },
        {
          do: 'LOOK FOR THE PEE. A STEADY STREAM OF WATER',
          why: 'That little jet out of the back of the engine is proof the water pump is cooling it. It should appear within ten seconds.',
          watch: 'NO STREAM = SHUT DOWN NOW. Running dry destroys the engine in minutes. See NO TELLTALE under EMERGENCY.',
        },
        {
          do: 'CHECK THE GAUGES: OIL, TEMP, VOLTS, TRIM',
          why: 'On a big outboard the alarms are your early warning. Learn what normal looks like now, at the dock.',
          watch: 'A buzzer at start-up is not "it always does that". Find out what it is.',
          only: ['mostro'],
        },
        {
          do: 'LET HER IDLE HALF A MINUTE AND LISTEN',
          why: 'Warm oil, steady idle, and thirty seconds of listening tells you more about this engine than any gauge.',
          watch: 'Do not shift into gear while the fast idle is still up.',
        },
      ],
    },

    leave: {
      title: 'LEAVE THE BERTH',
      eyebrow: 'GETTING OFF CLEANLY',
      steps: [
        {
          do: 'READ THE WIND BEFORE YOU TOUCH A LINE',
          why: 'Wind decides everything that happens next. Look at flags, other boats, and ripples on the water — then decide which way the bow will blow.',
          watch: 'Blowing you ON to the dock: get the bow out first. Blowing you OFF: it does the work for you.',
        },
        {
          do: 'FENDERS DOWN THE SIDE YOU WILL BE AGAINST',
          why: 'Fenders go on before you move, at the height of the rubbing line, tied to a cleat or grabrail.',
          watch: 'Tubes bounce, they do not absorb a concrete edge. Fender the quarters where the tube meets the transom.',
          only: ['mostro'],
        },
        {
          do: 'FENDERS DOWN THE SIDE YOU WILL BE AGAINST',
          why: 'Gelcoat scratches for free and costs a deposit. Fenders on before you move, at the rubbing line.',
          not: ['mostro'],
        },
        {
          do: 'HANDS AND FEET INSIDE THE BOAT',
          why: 'Tell your crew now: never push off with a foot or a hand between the boat and the dock. Use a boathook or let it touch.',
          watch: 'A few tonnes of boat closes a gap faster than an ankle comes out of it.',
        },
        {
          do: 'ENGINE RUNNING, IN NEUTRAL, BEFORE THE LAST LINE COMES OFF',
          why: 'You want to know she is running before you are adrift. Drop the lines you do not need and keep the one holding you against the wind until last.',
        },
        {
          do: 'STEER IN PULSES: SHORT BURST IN GEAR, THEN NEUTRAL',
          why: 'An outboard steers by aiming its thrust. In neutral you have no steering at all — so turn the wheel first, then a brief nudge of throttle.',
          watch: 'Slow-speed manoeuvring is a series of small pushes, not a steady crawl.',
        },
        {
          do: 'STERN-TO? SLIP THE STERN LINES, THEN GO AHEAD SLOWLY',
          why: 'Take in the two stern lines, then motor gently forward while a crew member walks the lazy line or the anchor rope up to the bow and lets it go.',
          watch: 'Do not put it in gear until that lazy line is clear of the water and the prop.',
        },
        {
          do: 'IDLE SPEED UNTIL YOU CLEAR THE LAST MOORED BOAT',
          why: 'Your wake is legally yours. Inside a harbour that means walking pace, no exceptions.',
          watch: 'Watch for swimmers between moored boats and for people stepping onto passerelles.',
        },
        {
          do: 'LOOK BEHIND YOU, THEN BUILD SPEED SMOOTHLY',
          why: 'Trim fully down, throttle up progressively, let the bow come up and settle, then trim out a touch until she feels light and quiet.',
          watch: 'Everyone seated and holding on before you plane. Nobody sitting on the bow or the tubes.',
        },
        {
          do: 'REMEMBER: THIS THROTTLE IS A DECISION',
          why: 'Two hundred and fifty horsepower on six metres accelerates faster than the crew expects. Give warning, then feed it in over three or four seconds.',
          watch: 'A fast open boat also torque-steers to one side. Keep both hands on the wheel every time you accelerate.',
          only: ['mostro'],
        },
      ],
    },

    underway: {
      title: 'UNDERWAY',
      eyebrow: 'DRIVING HER WELL',
      steps: [
        {
          do: 'SCAN THE HORIZON EVERY THIRTY SECONDS',
          why: 'Almost every collision involving a small boat is one where nobody was looking. A slow sweep, all the way round, including behind you.',
          watch: 'Ferries are the real hazard in these waters. They are far faster than they look and they do not manoeuvre for you. Cross well astern.',
        },
        {
          do: 'TRIM DOWN TO ACCELERATE, OUT TO CRUISE',
          why: 'Bow down gets her onto the plane and keeps the ride soft in chop. Once up, trim out until she feels loose and the note lifts.',
          watch: 'Trimmed out too far and the bow starts hunting up and down — that is porpoising. Trim back in a touch immediately.',
        },
        {
          do: 'HEAD SEA: SLOW DOWN AND TAKE IT ON THE SHOULDER',
          why: 'Meet the waves ten to twenty degrees off the bow rather than square on, and ease the throttle as you come over each crest so she lands soft.',
          watch: 'Launching off a wave is how backs and boats get broken. If it is slamming, you are going too fast.',
        },
        {
          do: 'FOLLOWING SEA: STAY OFF THE BACK OF THE WAVE AHEAD',
          why: 'Running downwind feels wonderful and hides how big it has got. Sit on the back of a wave, do not surf down its face.',
          watch: 'If the stern starts sliding sideways she is about to broach. Ease off, do not steer harder.',
        },
        {
          do: 'BEAM SEA: ZIG-ZAG INSTEAD OF ROLLING',
          why: 'Waves straight on the side make a miserable, wet, rolling ride. Take them at an angle on one tack, then the other.',
        },
        {
          do: 'CROSS OTHER BOATS’ WAKES AT AN ANGLE',
          why: 'Slow down and take a wake at roughly forty-five degrees. Parallel to it is what throws people off seats.',
        },
        {
          do: 'CREW SEATED, NOBODY ON THE BOW',
          why: 'On the plane a small boat leaves the water. Anyone forward of the console is one wave away from going over, and the propeller is right there.',
          watch: 'Sitting on the tubes at speed is exactly how people end up in the water on a RIB.',
          only: ['mostro'],
        },
        {
          do: 'CREW SEATED, NOBODY ON THE BOW',
          why: 'On the plane a small boat leaves the water. Anyone forward of the console is one wave away from going over the side.',
          not: ['mostro'],
        },
        {
          do: 'STAY OUTSIDE THE YELLOW BUOYS OFF BEACHES',
          why: 'Buoyed swimming areas are for swimmers. Approach beaches at idle, from directly offshore, and keep a lookout on the bow.',
          watch: 'Snorkellers have no idea you are there and are almost invisible from the helm. A red flag with a white diagonal means divers down — stay a hundred metres clear.',
        },
        {
          do: 'TURN FOR HOME WHEN YOU REACH ONE THIRD OF FUEL',
          why: 'Thirds: out, back, and a reserve you never plan to use. It is the reserve that covers a headwind you did not have on the way out.',
          watch: 'Fuel burn rises steeply against wind and chop. The trip home is often the expensive one.',
        },
        {
          do: 'HOT AFTERNOON? EXPECT MORE WIND, NOT LESS',
          why: 'In the Aegean the breeze commonly builds from late morning and peaks mid-afternoon. Getting home early is free; getting home late is not.',
          watch: 'White caps everywhere and spray off the tops means it is time to go, not time for one more bay.',
        },
        {
          do: 'IF IN DOUBT, SLOW DOWN',
          why: 'It is the answer to nearly every problem on a small boat. Almost nothing at three knots is an emergency.',
        },
      ],
    },

    anchor: {
      title: 'ANCHOR & SWIM',
      eyebrow: 'STOPPING SOMEWHERE LOVELY',
      steps: [
        {
          do: 'PICK SAND, NOT WEED. LOOK FOR THE PALE PATCHES',
          why: 'Light turquoise is sand and holds well. Dark patches are seagrass — poor holding, and in Greece anchoring on Posidonia beds is prohibited.',
          watch: 'Also look for the dark shadows of rocks. They hold an anchor permanently.',
        },
        {
          do: 'CHECK THE DEPTH AND WHAT IS DOWNWIND OF YOU',
          why: 'Three to six metres is comfortable. Then look behind you: if the anchor drags, that is where you end up.',
          watch: 'A lee shore — rocks downwind — is the one place never to anchor casually.',
        },
        {
          do: 'MOTOR UP INTO THE WIND AND STOP OVER THE SPOT',
          why: 'Come to a dead stop, in neutral, pointing at the wind. The boat will then blow backwards, which is exactly what you want.',
        },
        {
          do: 'LOWER THE ANCHOR. DO NOT THROW IT',
          why: 'Let it down hand over hand until you feel it touch the bottom. Thrown anchors land in a heap on top of their own chain and never set.',
          watch: 'Feet clear of the rope. A running anchor rope takes a foot with it.',
        },
        {
          do: 'DRIFT BACK PAYING OUT FIVE TIMES THE DEPTH',
          why: 'Five metres of water needs about twenty-five metres of rope out. It is the low angle of pull that makes an anchor grip, not its weight.',
          watch: 'Not enough rope is why anchors drag. If in doubt, let out more.',
        },
        {
          do: 'MAKE IT FAST, THEN A GENTLE BURST ASTERN TO DIG IN',
          why: 'Cleat the rope, then a short pull in reverse. You should feel it stop the boat solidly, like a rope going tight.',
          watch: 'Skipping and jerking means it is dragging over the bottom. Pull it up and start again somewhere else.',
        },
        {
          do: 'TAKE TWO TRANSITS ASHORE AND WATCH THEM',
          why: 'Line up two fixed things on land. If they stay lined up you are holding. It is the only anchor check that actually works.',
          watch: 'Check them again in ten minutes, and again if the wind gets up.',
        },
        {
          do: 'ENGINE OFF. KEY OUT. KILL CORD OFF AND IN YOUR HAND',
          why: 'Nobody goes in the water with the engine running. Ever. Holding the kill cord is a habit worth having.',
          watch: 'The propeller is at head height for someone swimming near the stern.',
        },
        {
          do: 'LADDER DOWN BEFORE THE FIRST PERSON GOES IN',
          why: 'Climbing back aboard a small boat without a ladder is genuinely hard, and much harder when you are tired and cold.',
          watch: 'Never let everybody swim at once. One capable person stays on board with the boat.',
        },
        {
          do: 'RESPECT THE CURRENT BETWEEN ISLANDS',
          why: 'It looks like nothing from the deck and can be faster than you can swim. Swim upcurrent first so the tired half is with it.',
          watch: 'A swimmer who is not getting closer to the boat is in trouble now. Throw something that floats, on a line.',
        },
        {
          do: 'LEAVING: MOTOR SLOWLY UP TO THE ANCHOR AS IT COMES IN',
          why: 'Drive gently towards it while a crew member takes in the slack. When the rope is straight up and down, it breaks out easily.',
          watch: 'Pulling against the boat’s weight will not shift it and will hurt someone’s back.',
        },
        {
          do: 'STUCK FAST? SNUB IT SHORT AND MOTOR PAST IT',
          why: 'Cleat it short, then motor slowly in the opposite direction to trip the anchor out backwards. It almost always releases.',
          watch: 'Slowly. Doing this at speed rips out cleats and breaks ropes under load.',
        },
      ],
    },

    alongside: {
      title: 'COME ALONGSIDE',
      eyebrow: 'DOCKING ON THE SIDE',
      steps: [
        {
          do: 'STOP OUTSIDE AND LOOK, BEFORE YOU COMMIT',
          why: 'Hold off in clear water. Find the gap, find the wind, find where you will put your lines, and decide the whole plan before you go in.',
          watch: 'Almost every bad docking is one that started before there was a plan.',
        },
        {
          do: 'FENDERS AND LINES READY ON THE DOCKING SIDE',
          why: 'Two fenders at the rubbing line, a bow line and a stern line coiled and ready on the correct side, brief your crew on who takes which.',
          watch: 'Lines must not hang in the water. Not for a second, not near the prop.',
        },
        {
          do: 'NEVER APPROACH FASTER THAN YOU ARE WILLING TO HIT',
          why: 'This is the whole art of docking. Walking pace, or slower. Slow enough is always slow enough.',
          watch: 'If it is going wrong, go around and do it again. Nobody watching will care. Everyone will care about the crunch.',
        },
        {
          do: 'COME IN AT ABOUT TWENTY DEGREES TO THE DOCK',
          why: 'A shallow angle, aiming just ahead of where you want to end up, then straighten alongside as you arrive.',
          watch: 'Wind blowing off the dock? Use a steeper angle and more speed. Blowing on? Come in shallower and let the wind do the last metre.',
        },
        {
          do: 'STOP HER WITH A BURST OF REVERSE',
          why: 'Neutral, then a short burst astern to kill the way off. The stern will also walk sideways as you do it — use that, it is free.',
          watch: 'Reverse on a single outboard pulls the stern toward one side. Learn which, and always dock that side to the wall.',
        },
        {
          do: 'GET ONE LINE ON FIRST — MIDSHIPS IF YOU CAN',
          why: 'One line near the middle of the boat, made fast ashore, holds the whole boat while you sort out everything else. It is the single best docking trick there is.',
          watch: 'Nobody jumps. Step off, or hand the line to someone ashore.',
        },
        {
          do: 'CLEAT HITCH: A TURN, TWO FIGURE-EIGHTS, ONE LOCK',
          why: 'One full turn round the base, two figure-eights over the horns, then a single locking hitch. It holds hard and comes off loaded.',
          watch: 'More than one locking hitch will jam solid under load, exactly when you need it off.',
        },
        {
          do: 'ADJUST FENDERS AND LINES ONLY WHEN SHE IS HELD',
          why: 'Bow line, stern line, then springs if it is windy. Then, and only then, tidy up and shut the engine down.',
        },
      ],
    },

    medmoor: {
      title: 'MED MOOR STERN-TO',
      eyebrow: 'THE GREEK HARBOUR WALL',
      steps: [
        {
          do: 'THIS IS THE NORMAL WAY TO BERTH IN GREECE',
          why: 'Stern to the quay, held off by your anchor or a lazy line laid from the wall. Almost every island harbour works this way.',
          watch: 'Read the whole flow once now, at anchor, before you try it in a crosswind with an audience.',
        },
        {
          do: 'PICK YOUR GAP AND CHECK THE DEPTH AT THE WALL',
          why: 'Look for a gap comfortably wider than the boat, and look at what your neighbours are doing — if they are all bow-to, there is a reason.',
          watch: 'Shallow, rubble, or a broken quay edge. Look over the side before you back in.',
        },
        {
          do: 'FENDERS ON BOTH SIDES, STERN LINES READY AFT',
          why: 'You will end up sandwiched between two boats, so fender both sides. Two stern lines coiled and ready at the transom.',
        },
        {
          do: 'STOP TWO OR THREE BOAT LENGTHS OUT, SQUARE TO YOUR GAP',
          why: 'Line up with your slot while you still have room to correct. Do not begin backing until the bow is pointing straight out from it.',
        },
        {
          do: 'IF USING YOUR ANCHOR: DROP IT NOW, WELL OUT',
          why: 'Lower it four to five boat lengths off the wall and pay out steadily as you go astern. It is what stops the stern hitting the quay.',
          watch: 'Do not drop it on top of your neighbour’s anchor rope, or you will both be stuck when they leave.',
        },
        {
          do: 'GO ASTERN SLOWLY, CORRECTING WITH SHORT BURSTS',
          why: 'A small outboard boat reverses badly and blows off the wind. Get a little way on, then use brief bursts of throttle to steer.',
          watch: 'Wind on the bow will push the front sideways fast. Commit and keep moving — she steers when water is flowing, not when stopped.',
        },
        {
          do: 'CREW PASSES BOTH STERN LINES ASHORE',
          why: 'Stop with the transom about a metre off, close enough to hand lines across, far enough that a swell cannot slam you into concrete.',
          watch: 'Nobody stands between the transom and the wall. Nobody jumps ashore.',
        },
        {
          do: 'IF THERE IS A LAZY LINE: WALK IT TO THE BOW AND MAKE IT FAST',
          why: 'Many quays have a line from the wall out to a mooring block. Pick it up, walk it forward outside everything, and cleat it at the bow.',
          watch: 'It will be filthy, heavy, and covered in growth. Gloves if you have them, and keep it out of the propeller.',
        },
        {
          do: 'TENSION THE ANCHOR OR LAZY LINE UNTIL SHE SITS OFF THE WALL',
          why: 'Take up forward until the boat hangs a metre or so clear of the quay with the stern lines tight. That is what stops the transom grinding all night.',
          watch: 'Slack forward and she will be against the wall by morning. Check it again before you leave her.',
        },
        {
          do: 'ADJUST FENDERS, THEN SHUT HER DOWN',
          why: 'Fenders where they are actually touching something, lines even on both sides, then engine off.',
        },
      ],
    },

    rules: {
      title: 'RULES OF THE ROAD',
      eyebrow: 'WHO GIVES WAY, AND WHAT THE MARKS MEAN',
      steps: [
        {
          do: 'YOU ARE A POWER BOAT. YOU GIVE WAY TO ALMOST EVERYONE',
          why: 'Give way to sailing boats under sail, to anything fishing, to anything that cannot manoeuvre, and in practice to anything bigger than you.',
          watch: 'Right of way is not a thing you win. Being right is no use at all after a collision.',
        },
        {
          do: 'HEAD ON: BOTH TURN RIGHT. PASS PORT TO PORT',
          why: 'Two boats meeting head on each alter to starboard and pass left side to left side. Make the turn early and obviously.',
          watch: 'A small, clear, early alteration tells the other skipper what you are doing. A late one tells them nothing.',
        },
        {
          do: 'CROSSING: THE BOAT ON YOUR RIGHT HAS RIGHT OF WAY',
          why: 'If a boat is coming from your starboard side, you give way. Slow down and pass behind them — never try to cut in front.',
          watch: 'If their bearing is not changing, you are on a collision course. Act now, while it is still easy.',
        },
        {
          do: 'OVERTAKING: THE ONE OVERTAKING KEEPS CLEAR',
          why: 'Pass wide, and slow down as you go by so your wake does not go through their cockpit.',
        },
        {
          do: 'IN A NARROW CHANNEL, KEEP TO THE RIGHT',
          why: 'Stay to the starboard side of the channel, the same as driving. Do not cut corners at the entrance to a harbour.',
        },
        {
          do: 'COMING IN: RED CAN TO YOUR LEFT, GREEN CONE TO YOUR RIGHT',
          why: 'European waters use IALA A. Entering a harbour or channel from seaward, leave red marks on your port side and green on your starboard.',
          watch: 'Leaving, it is reversed. A yellow buoy is special — usually a swimming area — and you stay outside it.',
        },
        {
          do: 'DIVER DOWN FLAGS MEAN STAY A HUNDRED METRES OFF',
          why: 'A red flag with a white diagonal stripe, or a blue and white flag, means people are in the water. No wake, wide berth.',
        },
        {
          do: 'THREE KNOTS INSIDE HARBOURS AND SWIM ZONES',
          why: 'Walking pace. You are responsible for the damage and injury your own wake causes, wherever it happens.',
        },
        {
          do: 'SOUND SIGNALS: ONE SHORT RIGHT, TWO SHORT LEFT, FIVE MEANS DANGER',
          why: 'One blast is "I am turning to starboard", two is "to port", five or more short blasts is "I do not understand you" or "danger".',
          watch: 'Five blasts from a big ship is aimed at you. Get out of the way immediately, and turn away from its bow.',
        },
        {
          do: 'AT NIGHT: RED IS THEIR LEFT, GREEN IS THEIR RIGHT',
          why: 'Both red and green means it is pointing at you. White only means you are looking at its stern. Slow to a speed at which you can stop.',
          watch: 'A small open boat has no business out after dark. If it happens, nav lights on and go slowly for the nearest sheltered light.',
        },
      ],
    },

    lines: {
      title: 'LINES & KNOTS',
      eyebrow: 'FOUR THINGS, THAT IS ALL',
      steps: [
        {
          do: 'CLEAT HITCH — FOR EVERY DOCK LINE YOU WILL TIE',
          why: 'One full turn around the base of the cleat, then two figure-eights across the horns, then one locking hitch with the loose end twisted under.',
          watch: 'Exactly one locking hitch. Two or three will jam solid under load and you will be cutting it off.',
        },
        {
          do: 'BOWLINE — A LOOP THAT NEVER SLIPS',
          why: 'Make a small loop in the standing part. The end comes up through it, around behind the standing part, and back down through the loop.',
          watch: 'The end must finish inside the big loop, alongside the standing part. Outside, it will fail.',
        },
        {
          do: 'ROUND TURN AND TWO HALF HITCHES — FOR A RING OR A RAIL',
          why: 'A full turn around the ring, then two identical half hitches around the standing part. It holds under load and unties while still loaded.',
        },
        {
          do: 'CLOVE HITCH — FENDERS AND TEMPORARY WORK',
          why: 'Two turns around the rail with the second crossing over the first, then tuck the end under that crossing. Fast and adjustable.',
          watch: 'It rolls off a smooth post under a changing load. Never use it for anything that matters.',
        },
        {
          do: 'NO ROPE GOES IN THE WATER. EVER',
          why: 'A trailing line finds your propeller within a minute. Coil everything and stow it before the engine goes into gear.',
          watch: 'The swim ladder rope and the anchor rope are the two that catch people out.',
        },
        {
          do: 'FENDERS HANG AT THE RUBBING LINE, TIED TO SOMETHING SOLID',
          why: 'Set the height so the fat part sits where the boat actually touches the dock. Tie to a cleat or a grabrail.',
          watch: 'A fender hanging too high does nothing whatsoever, and looks exactly like a fender doing its job.',
        },
      ],
    },
  };

  /* ═══════════════════════ EMERGENCIES ═══════════════════════ */

  const EMERGENCY = {
    title: 'EMERGENCY',
    eyebrow: 'PICK THE ONE THAT IS HAPPENING',
    items: [
      { key: 'mayday',    label: 'MAYDAY — CALL FOR HELP',  sub: 'VHF CHANNEL 16 · WHAT TO SAY', kind: 'mayday', hot: true },
      { key: 'mob',       label: 'MAN OVERBOARD',           sub: 'SOMEONE IS IN THE WATER',      kind: 'steps', hot: true },
      { key: 'water',     label: 'TAKING ON WATER',         sub: 'SHE IS FILLING UP',            kind: 'steps', hot: true },
      { key: 'fire',      label: 'FIRE ABOARD',             sub: 'SMOKE OR FLAME',               kind: 'steps', hot: true },
      { key: 'nostart',   label: 'ENGINE WILL NOT START',   sub: 'AT THE DOCK OR AT ANCHOR',     kind: 'steps' },
      { key: 'telltale',  label: 'NO TELLTALE / OVERHEAT',  sub: 'NO WATER, OR AN ALARM',        kind: 'steps' },
      { key: 'died',      label: 'ENGINE DIED UNDERWAY',    sub: 'ADRIFT WITH NO POWER',         kind: 'steps' },
      { key: 'prop',      label: 'ROPE ROUND THE PROP',     sub: 'FOULED PROPELLER',             kind: 'steps' },
      { key: 'aground',   label: 'RUN AGROUND',             sub: 'SAND OR ROCK',                 kind: 'steps' },
      { key: 'weather',   label: 'WEATHER TURNED',          sub: 'MORE WIND THAN YOU WANT',      kind: 'steps' },
      { key: 'hurt',      label: 'SOMEONE IS HURT',         sub: 'INJURY, HEAT, OR PANIC',       kind: 'steps' },
    ],
  };

  const DRILLS = {
    mob: {
      title: 'MAN OVERBOARD',
      eyebrow: 'FIRST THIRTY SECONDS',
      steps: [
        {
          do: 'SHOUT "MAN OVERBOARD" AND POINT AT THEM',
          why: 'One person does nothing else but point and keep their eyes on the person in the water. A head in a wave disappears in seconds and is almost impossible to find again.',
          watch: 'Losing sight of them is the thing that turns this into a fatality.',
        },
        {
          do: 'THROW SOMETHING THAT FLOATS, RIGHT NOW',
          why: 'A lifejacket, a fender, a cushion — anything. It gives them something to hold and it marks the spot on the water.',
        },
        {
          do: 'ENGINE INTO NEUTRAL AND TURN TOWARD THEM',
          why: 'Come off the throttle immediately, then turn the stern away from them as you begin to come round. The propeller is the danger now.',
          watch: 'Never reverse toward a person in the water.',
        },
        {
          do: 'APPROACH SLOWLY FROM DOWNWIND, STOP UPWIND OF THEM',
          why: 'Come in at idle and stop with them just off your side, slightly downwind, so the boat drifts toward them rather than over them.',
        },
        {
          do: 'ENGINE OFF BEFORE ANYONE REACHES OVER THE SIDE',
          why: 'Off. Not neutral. Key out. This is not negotiable while a person is beside the hull.',
        },
        {
          do: 'GET A LINE OR THE LADDER TO THEM, DO NOT GO IN',
          why: 'Reach, throw, then only as a last resort go in — and only wearing a lifejacket with a line attached. Two people in the water is twice the emergency.',
          watch: 'Recovering an exhausted adult over the side of a small boat is very hard. Use the ladder, and use the swell to help lift them.',
        },
        {
          do: 'IF THEY ARE NOT FOUND IN ONE MINUTE, MAYDAY',
          why: 'Do not wait, and do not keep searching alone first. Call on channel 16 straight away — help can always be stood down.',
          watch: 'Press ▲ from here to get the MAYDAY script.',
        },
      ],
    },

    water: {
      title: 'TAKING ON WATER',
      eyebrow: 'FIND IT, SLOW IT, CALL',
      steps: [
        {
          do: 'LIFEJACKETS ON EVERYONE. NOW, NOT LATER',
          why: 'Before you investigate anything. This is the moment they get put on, while the boat is still level and you have hands free.',
        },
        {
          do: 'BILGE PUMP ON. START BAILING BY HAND AS WELL',
          why: 'The pump alone is rarely enough. A bucket moves far more water than a small electric pump does.',
        },
        {
          do: 'CHECK THE DRAIN PLUG FIRST',
          why: 'It is the most common cause by a very long way, and the easiest to fix — reach into the transom and check the bung is there and tight.',
          watch: 'On many small boats you can feel the water coming in at the plug with a hand.',
        },
        {
          do: 'IF UNDERWAY, GOING FORWARD MAY HELP',
          why: 'On a self-draining boat, planing lifts the transom and lets the water run out aft. Slow, level, and full is worse than moving.',
          watch: 'Only if she still handles. If she feels heavy and sluggish, stay slow and head for shallow water.',
        },
        {
          do: 'PLUG IT WITH ANYTHING SOFT',
          why: 'A towel, a T-shirt, a cushion pushed hard into the hole from inside. Slowing the leak by half doubles your time.',
        },
        {
          do: 'HEAD FOR THE NEAREST SHALLOW WATER OR BEACH',
          why: 'A boat sitting on sand in a metre of water is a repair job. The same boat in thirty metres is a rescue.',
          watch: 'Nearest safe land, not the harbour you came from.',
        },
        {
          do: 'CALL MAYDAY WHILE YOU STILL HAVE POWER',
          why: 'Do it early, with a working radio and a working engine, not after both are underwater. Press ▲ for the script.',
        },
      ],
    },

    fire: {
      title: 'FIRE ABOARD',
      eyebrow: 'AIR, FUEL, AND GETTING CLEAR',
      steps: [
        {
          do: 'STOP THE ENGINE AND SHUT THE FUEL OFF',
          why: 'Cuts the fuel supply and stops the airflow feeding it. Do both before you point an extinguisher at anything.',
        },
        {
          do: 'GET EVERYONE FORWARD AND UPWIND OF THE SMOKE',
          why: 'Smoke in a small open boat incapacitates people in a couple of breaths. Move them to clean air first.',
        },
        {
          do: 'LIFEJACKETS ON EVERYONE',
          why: 'Because the next decision may be to leave the boat, and there will not be time then.',
        },
        {
          do: 'EXTINGUISHER: AIM AT THE BASE, SHORT SWEEPS',
          why: 'Pull the pin, aim low at what is actually burning, and sweep. Get close enough to be effective and keep your exit behind you.',
          watch: 'Do not fling open an engine cover into a fire. Opening it feeds it a lungful of air.',
        },
        {
          do: 'IF IT IS NOT OUT IN SECONDS, MAYDAY AND PREPARE TO LEAVE',
          why: 'A fibreglass boat burns fast and hot. Call, then get everyone at the bow ready to go into the water on your word.',
          watch: 'Stay together in the water, jackets on, upwind of the boat, and do not swim for shore. Being found matters more than distance.',
        },
      ],
    },

    nostart: {
      title: 'WILL NOT START',
      eyebrow: 'IN THE ORDER THEY ACTUALLY HAPPEN',
      steps: [
        {
          do: 'IS IT IN NEUTRAL?',
          why: 'This is the answer most of the time. The engine cannot crank in gear. Feel the shift click into the middle detent.',
        },
        {
          do: 'IS THE KILL CORD CLIPPED ON?',
          why: 'The second most common answer. No lanyard fitted, no ignition circuit, no crank, no noise at all.',
        },
        {
          do: 'IS THE BATTERY SWITCH ON, AND THE KEY ALL THE WAY ROUND?',
          why: 'Isolator to ON or BOTH. If you get nothing at all — no click, no gauges — it is electrical, not fuel.',
        },
        {
          do: 'IS THE VENT OPEN, THE VALVE ON, THE BULB HARD?',
          why: 'Open the vent, turn the valve, squeeze the primer until it is firm. If the bulb never goes hard, the fuel is not reaching the engine.',
          watch: 'Check the fuel line is actually clipped on at both ends. They get knocked off.',
        },
        {
          do: 'RIG THE FOUR HORSEPOWER AUXILIARY',
          why: 'That is what it is there for. Clamp it on the bracket, connect its own fuel, tilt down, and get yourself home slowly.',
          watch: 'It will make about three knots. Go with the wind, not against it.',
          only: ['bluwater'],
        },
        {
          do: 'IT CRANKS BUT WILL NOT CATCH: SMELL FOR FUEL',
          why: 'Strong petrol smell means it is flooded — throttle fully open in neutral, no choke, and crank for five seconds. No smell at all means it is getting nothing.',
          watch: 'Five seconds of cranking, then wait ten. Long cranks flatten the battery and then you have two problems.',
        },
        {
          do: 'STOP AFTER A FEW TRIES AND SECURE THE BOAT',
          why: 'If you are drifting, get the anchor down before you carry on fiddling. A drifting boat becomes an emergency; an anchored one is just annoying.',
        },
        {
          do: 'CALL THE OPERATOR. THEY KNOW THIS BOAT’S TRICK',
          why: 'Nearly every rental engine has one — a switch, a knack, a habit. One phone call is usually the whole answer.',
          watch: 'No signal and no radio, drifting toward anything hard? That is a MAYDAY. Press ▲.',
        },
      ],
    },

    telltale: {
      title: 'NO TELLTALE',
      eyebrow: 'OVERHEATING — MINUTES MATTER',
      steps: [
        {
          do: 'SHUT THE ENGINE DOWN IMMEDIATELY',
          why: 'No water coming out of the telltale means the pump is not cooling it. Running it dry destroys the impeller, then the powerhead, in minutes.',
          watch: 'An overheat buzzer is the same instruction. Off, now, then look.',
        },
        {
          do: 'ANCHOR OR SECURE THE BOAT FIRST',
          why: 'Before you start working on the engine, make sure you are not drifting onto anything.',
        },
        {
          do: 'CHECK THE ENGINE IS FULLY DOWN AND THE INTAKE IS UNDER WATER',
          why: 'A part-tilted leg sucks air. It is the simplest cause and it costs nothing to check.',
        },
        {
          do: 'LOOK FOR A BLOCKED INTAKE: WEED, A BAG, SAND',
          why: 'The intake slots are on the leg just above the propeller. Clear them with a finger or a bit of wire.',
          watch: 'If you ran through shallow sand, the pump may have drawn sand in. That is a shop job, not a fix.',
        },
        {
          do: 'CLEAR THE TELLTALE OUTLET WITH A THIN WIRE',
          why: 'Salt blocks the little outlet pipe itself. Sometimes cooling is fine and only the tell-tale hole is clogged — but never assume that.',
        },
        {
          do: 'RESTART AND WATCH. NO STREAM IN TEN SECONDS: OFF AGAIN',
          why: 'One try. If there is still no water, the water pump impeller has failed and the engine cannot be run.',
        },
        {
          do: 'IMPELLER GONE? YOU ARE NOT MOTORING HOME',
          why: 'Anchor, call the operator for a tow, and use the auxiliary if you have one. Running it "gently" still kills it.',
        },
      ],
    },

    died: {
      title: 'ENGINE DIED',
      eyebrow: 'ADRIFT — SECURE FIRST',
      steps: [
        {
          do: 'GET THE ANCHOR DOWN IF THERE IS ANYTHING DOWNWIND',
          why: 'Before anything else. Anchoring in twenty metres holds badly but slows the drift, and slowing the drift buys you all your time.',
          watch: 'Rocks downwind is the situation that turns a dead engine into a wreck.',
        },
        {
          do: 'LIFEJACKETS ON, THEN COUNT YOUR CREW',
          why: 'A boat rolling beam-on with no power is unpleasant and people move around. Jackets on, everyone seated.',
        },
        {
          do: 'DID IT DIE SUDDENLY OR FADE AWAY?',
          why: 'Suddenly and completely is usually the kill cord pulled out or an electrical fault. Faded or coughed first is fuel or cooling.',
        },
        {
          do: 'CHECK THE KILL CORD AND THE FUEL, IN THAT ORDER',
          why: 'Refit the lanyard, then check the vent is open and squeeze the bulb hard. That is the great majority of them.',
          watch: 'Fuel gauge reading a quarter can still mean empty in chop, with the pickup sucking air.',
        },
        {
          do: 'TRY A RESTART: NEUTRAL, PRIME, SHORT CRANK',
          why: 'Five seconds on, ten seconds off. Do not sit on the starter.',
        },
        {
          do: 'NO LUCK? PHONE THE OPERATOR AND GIVE THEM YOUR POSITION',
          why: 'They will send someone. Tell them what you can see ashore — a beach, a headland, a hotel — and roughly how long you have been drifting.',
        },
        {
          do: 'DRIFTING TOWARD DANGER OR IT IS GETTING DARK: MAYDAY',
          why: 'Do not wait until it is bad. Press ▲ for the script and make the call while you still have daylight and options.',
        },
      ],
    },

    prop: {
      title: 'FOULED PROP',
      eyebrow: 'ROPE ROUND THE PROPELLER',
      steps: [
        {
          do: 'NEUTRAL, THEN ENGINE OFF, THEN KEY OUT',
          why: 'The moment you hear the note change or feel the vibration. Continuing to drive winds it on tighter and can wreck the gearbox seals.',
        },
        {
          do: 'ANCHOR, OR CHECK YOU ARE DRIFTING SOMEWHERE SAFE',
          why: 'You are about to have your head over the transom and your hands in the water. Know where the boat is going first.',
        },
        {
          do: 'TAKE THE KILL CORD WITH YOU AND KEEP IT IN YOUR HAND',
          why: 'Nobody can start that engine while it is in your pocket. This is the whole reason the kill cord exists.',
          watch: 'Never, ever work near a propeller with the key in the ignition.',
        },
        {
          do: 'TILT THE ENGINE UP TO GET AT IT',
          why: 'Most fouls are visible and reachable once the leg is up, with the boat lying still.',
        },
        {
          do: 'UNWIND IT — THE OPPOSITE WAY IT WENT ON',
          why: 'Turn the propeller by hand backwards and it usually comes off in a few turns. Cut it only if unwinding fails.',
          watch: 'Sharp barnacles on the leg and a knife in a wet hand. Go slowly.',
        },
        {
          do: 'CHECK THE BLADES AND THE VIBRATION ON RESTART',
          why: 'Look for chunks out of the blades. Then run up gently — if she shakes at speed, go home slowly and report it.',
        },
        {
          do: 'CANNOT CLEAR IT? DO NOT DIVE UNDER THE BOAT ALONE',
          why: 'In any swell, with nobody else capable aboard, call for a tow instead. Being under a small boat in a chop is genuinely dangerous.',
        },
      ],
    },

    aground: {
      title: 'RUN AGROUND',
      eyebrow: 'STOP MAKING IT WORSE',
      steps: [
        {
          do: 'THROTTLE TO NEUTRAL IMMEDIATELY',
          why: 'Do not power on to "push through". You will pack sand into the cooling water intake and grind the propeller and the leg.',
        },
        {
          do: 'STOP THE ENGINE AND TILT THE LEG UP',
          why: 'Gets the propeller and the gearbox off the bottom before the swell puts them there repeatedly.',
        },
        {
          do: 'CHECK FOR WATER COMING IN, AND CHECK YOUR PEOPLE',
          why: 'A hard grounding can crack a hull or knock people over. Look in the bilge, count heads, look for injuries.',
        },
        {
          do: 'WORK OUT WHAT YOU ARE ON AND WHERE THE DEEP WATER IS',
          why: 'Look over the side. Sand is recoverable; rock needs care. The deep water is almost always the way you came in.',
        },
        {
          do: 'MOVE WEIGHT AND PUSH OFF THE WAY YOU CAME',
          why: 'Get crew to the opposite end or over the side into knee-deep water to lift her, and push back along your track.',
          watch: 'Shoes on. Sea urchins, glass, and sharp rock are all in there.',
        },
        {
          do: 'FLOATING AGAIN: CHECK THE TELLTALE THE MOMENT SHE STARTS',
          why: 'Sand in the water pump is the usual after-effect. No stream of water means shut down and get a tow.',
        },
        {
          do: 'ON ROCK, IN SWELL, OR HOLED: STOP AND CALL',
          why: 'Every attempt in swell hammers the hull on rock. Lifejackets on, get everyone ashore if you safely can, and call for help.',
        },
      ],
    },

    weather: {
      title: 'WEATHER TURNED',
      eyebrow: 'GETTING HOME IN A BLOW',
      steps: [
        {
          do: 'DECIDE EARLY. THE FIRST HALF HOUR IS THE EASY ONE',
          why: 'It only builds. Every minute you spend deciding is a minute of worse conditions to travel in.',
          watch: 'White caps forming everywhere and spray blowing off the tops means it is already time to go.',
        },
        {
          do: 'LIFEJACKETS ON EVERYONE BEFORE IT GETS ROUGH',
          why: 'Doing it now, sitting still, is easy. Doing it later, being thrown about, is not.',
        },
        {
          do: 'PICK THE NEAREST SHELTER, NOT THE HOME HARBOUR',
          why: 'Any lee shore of any island beats a long slog into a rising sea. You can arrange a tow, a taxi, or a wait from anywhere.',
        },
        {
          do: 'GO SLOWLY, ON THE SHOULDER OF THE WAVES',
          why: 'Take them ten to twenty degrees off the bow, and ease off over each crest. Slow and dry beats fast and airborne.',
          watch: 'Do not try to keep to a schedule. Half speed and arriving is the plan.',
        },
        {
          do: 'STAY DOWNWIND OF SHELTER IF YOU CAN CHOOSE',
          why: 'Working along the sheltered side of an island is far calmer than crossing an open channel. Add the miles, take the calm water.',
        },
        {
          do: 'IF IT IS TOO MUCH: ANCHOR IN A LEE AND WAIT',
          why: 'Tucking into shelter and waiting it out is a completely legitimate decision. Afternoon wind in these islands often drops with the sun.',
          watch: 'Tell the operator where you are and that you are safe, so nobody starts a search.',
        },
      ],
    },

    hurt: {
      title: 'SOMEONE IS HURT',
      eyebrow: 'INJURY, HEAT, PANIC',
      steps: [
        {
          do: 'STOP THE BOAT. NEUTRAL, THEN OFF',
          why: 'You cannot help anyone and drive at the same time, and the motion is making everything harder.',
        },
        {
          do: 'BLEEDING: PRESS HARD ON IT AND KEEP PRESSING',
          why: 'Firm direct pressure with the cleanest cloth you have, and do not keep lifting it to look. Raise the limb if you can.',
          watch: 'Propeller and fishhook injuries bleed a great deal. Pressure, then call for help early.',
        },
        {
          do: 'HEAT: SHADE, WATER, WET THEM DOWN',
          why: 'Confusion, headache, nausea, or stopping sweating is heat illness, and it comes on faster on the water than ashore. Shade, sips of water, wet cloths, and head for home.',
          watch: 'Confused or not making sense is serious. That one needs a doctor today.',
        },
        {
          do: 'SEASICK: PUT THEM WHERE THEY CAN SEE THE HORIZON',
          why: 'Low in the middle of the boat, facing forward, eyes on the land. Not below, not looking down, not staring at a phone.',
          watch: 'A very seasick person becomes helpless and dehydrated. They also fall over the side while being sick. Keep them clipped in the middle of the boat.',
        },
        {
          do: 'BURNS AND SUN: COOL WATER, TEN MINUTES, THEN COVER',
          why: 'Cool running water or seawater for a good ten minutes, then cover loosely. Nothing greasy on a burn.',
        },
        {
          do: 'UNCONSCIOUS, CHEST PAIN, BAD BLEEDING, HEAD INJURY: MAYDAY',
          why: 'These need a hospital and you cannot provide one. Call on channel 16 for medical assistance — press ▲ for the script.',
        },
      ],
    },
  };

  /* ═════════════════════ MAYDAY SCRIPT ═════════════════════
     Three pages, read left to right. Written to be read aloud
     verbatim while frightened, which is why the lines are short.  */

  const MAYDAY = {
    pages: [
      {
        label: 'HOW',
        head: 'VHF · CHANNEL 16 · HIGH POWER',
        lines: [
          ['SET', 'Channel 16. Full power. Squelch down.'],
          ['HOLD', 'Mic five centimetres from your mouth.'],
          ['SPEAK', 'Slowly. Loudly. Flat voice. Short words.'],
          ['PRESS', 'Press to talk, speak, then release to listen.'],
          ['WAIT', 'Thirty seconds for an answer. Then say it all again.'],
        ],
        foot: 'MAYDAY is for grave and imminent danger to life. For serious but not life-threatening, say PAN PAN three times instead — same script.',
      },
      {
        label: 'SAY THIS',
        head: 'READ IT STRAIGHT DOWN',
        script: [
          { t: 'MAYDAY MAYDAY MAYDAY', big: true },
          { t: 'THIS IS {{boat}}, {{boat}}, {{boat}}' },
          { t: 'MAYDAY {{boat}}' },
          { t: 'MY POSITION IS —', pos: true },
          { t: 'I AM  …say what is wrong…', hint: true },
          { t: 'I NEED IMMEDIATE ASSISTANCE' },
          { t: '{{people}} PEOPLE ON BOARD', hint: true },
          { t: 'A {{loa}} {{type}}' },
          { t: 'OVER', big: true },
        ],
        foot: 'Do not know the boat name? Say the model and the colour. Do not know your position? Say what you can see ashore and how far off you are.',
      },
      {
        label: 'IF NO ANSWER',
        head: 'THE OTHER WAYS OUT',
        lines: [
          ['112', 'European emergency number. Works on any mobile network, and without a SIM.'],
          ['108', 'Hellenic Coast Guard emergency line.'],
          ['CH 16', 'Repeat the call. Any vessel that hears you must respond and relay.'],
          ['FLARE', 'Only when you can see someone who could see it. Downwind, held out over the side, arm up.'],
          ['SIGNAL', 'Slow raising and lowering of both outstretched arms. Orange smoke. A torch flashed at anything moving.'],
          ['HORN', 'Five or more short blasts, repeated. Sound carries downwind a long way.'],
        ],
        foot: 'Whoever you reach: give POSITION, NUMBER OF PEOPLE, and WHAT IS WRONG, in that order. Everything else can wait.',
      },
    ],
  };

  /* ═══════════════════════ HOME MENU ═══════════════════════ */

  const MENU = [
    { kind: 'section', label: 'THE DAY' },
    { kind: 'check', key: 'handover', num: '01', label: 'HANDOVER',        sub: 'ASK BEFORE YOU SIGN' },
    { kind: 'check', key: 'predep',   num: '02', label: 'BEFORE CAST OFF', sub: 'THE LAST LOOK' },
    { kind: 'steps', key: 'start',    num: '03', label: 'START THE ENGINE',sub: 'COLD START, IN ORDER' },
    { kind: 'steps', key: 'leave',    num: '04', label: 'LEAVE THE BERTH', sub: 'GETTING OFF CLEANLY' },
    { kind: 'steps', key: 'underway', num: '05', label: 'UNDERWAY',        sub: 'DRIVING HER WELL' },
    { kind: 'steps', key: 'anchor',   num: '06', label: 'ANCHOR & SWIM',   sub: 'STOPPING SOMEWHERE LOVELY' },
    { kind: 'steps', key: 'alongside',num: '07', label: 'COME ALONGSIDE',  sub: 'DOCKING ON THE SIDE' },
    { kind: 'steps', key: 'medmoor',  num: '08', label: 'MED MOOR STERN-TO',sub: 'THE GREEK HARBOUR WALL' },
    { kind: 'check', key: 'shutdown', num: '09', label: 'SHUT DOWN',       sub: 'PUTTING HER TO BED' },
    { kind: 'section', label: 'REFERENCE' },
    { kind: 'card',  key: 'card',     label: 'BOAT CARD',        sub: 'NUMBERS AND LIMITS' },
    { kind: 'steps', key: 'rules',    label: 'RULES OF THE ROAD',sub: 'WHO GIVES WAY' },
    { kind: 'steps', key: 'lines',    label: 'LINES & KNOTS',    sub: 'FOUR THINGS, THAT IS ALL' },
    { kind: 'sos',   key: 'sos',      label: 'EMERGENCY',        sub: 'WHEN IT GOES WRONG', hot: true },
  ];

  window.SKIPPER_DATA = {
    BOATS, BOAT_ORDER, SETTINGS, CHECKS, FLOWS, EMERGENCY, DRILLS, MAYDAY, MENU,
  };
})();
