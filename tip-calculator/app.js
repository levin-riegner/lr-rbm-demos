/* ============================================================
   TIP CALCULATOR — D-pad logic
   ▲ / ▼  →  bill  ± $1   (hold-free, repeat via key autorepeat)
   ◀ / ▶  →  tip   ± 1 %
   Enter  →  cycle party size 1 → 2 → … → 8 → 1 (split the total)
   ============================================================ */

const TIP_STEPS = [0, 5, 10, 12, 15, 18, 20, 22, 25, 30];

const state = {
  bill: 42.00,
  tip: 18,      // percent
  party: 1,
};

const el = {
  bill:      document.getElementById('bill'),
  tipPct:    document.getElementById('tip-pct'),
  tipAmt:    document.getElementById('tip-amt'),
  total:     document.getElementById('total'),
  people:    document.getElementById('people-badge'),
  perPerson: document.getElementById('per-person'),
  rowBill:   document.getElementById('row-bill'),
  rowTip:    document.getElementById('row-tip'),
};

const money = (n) => n.toFixed(2);

function bump(node) {
  node.classList.remove('bump');
  void node.offsetWidth;        // restart animation
  node.classList.add('bump');
}

function render() {
  const tipAmt = state.bill * (state.tip / 100);
  const total  = state.bill + tipAmt;

  el.bill.textContent   = money(state.bill);
  el.tipPct.textContent = state.tip;
  el.tipAmt.textContent = '+$' + money(tipAmt);
  el.total.textContent  = money(total);

  if (state.party > 1) {
    el.people.textContent = state.party + ' people';
    el.people.classList.add('active');
    el.perPerson.textContent = '$' + money(total / state.party) + ' each';
    el.perPerson.classList.remove('hidden');
  } else {
    el.people.textContent = '1 party';
    el.people.classList.remove('active');
    el.perPerson.classList.add('hidden');
  }
}

function changeBill(delta) {
  // bigger steps as the bill grows, so large checks aren't a slog
  const step = state.bill >= 200 ? 10 : state.bill >= 50 ? 5 : 1;
  state.bill = Math.max(0, Math.round((state.bill + delta * step) * 100) / 100);
  bump(el.bill);
  render();
}

function changeTip(dir) {
  const exact = TIP_STEPS.indexOf(state.tip);
  let i;
  if (exact !== -1) {
    i = exact + dir;                                  // already on a preset → step
  } else if (dir > 0) {
    i = TIP_STEPS.findIndex((s) => s > state.tip);    // snap up to next preset
  } else {
    i = TIP_STEPS.filter((s) => s < state.tip).length - 1; // snap down to prev preset
  }
  i = Math.max(0, Math.min(TIP_STEPS.length - 1, i));
  state.tip = TIP_STEPS[i];
  bump(el.tipPct);
  render();
}

function cycleParty() {
  state.party = state.party >= 8 ? 1 : state.party + 1;
  bump(el.people);
  render();
}

// Absolute setters — used by voice; same bump + render path as the D-pad.
// Each returns true when the value was accepted.
function setBill(amount) {
  const n = Number(amount);
  if (!isFinite(n) || n < 0) return false;
  state.bill = Math.round(n * 100) / 100;
  bump(el.bill);
  render();
  return true;
}

function setTip(percent) {
  const n = parseInt(percent, 10);
  if (isNaN(n) || n < 0 || n > 100) return false;
  state.tip = n;
  bump(el.tipPct);
  render();
  return true;
}

function setParty(size) {
  const n = parseInt(size, 10);
  if (isNaN(n) || n < 1 || n > 8) return false;
  state.party = n;
  bump(el.people);
  render();
  return true;
}

window.addEventListener('keydown', (e) => {
  switch (e.key) {
    case 'ArrowUp':    changeBill(+1); break;
    case 'ArrowDown':  changeBill(-1); break;
    case 'ArrowRight': changeTip(+1);  break;
    case 'ArrowLeft':  changeTip(-1);  break;
    case 'Enter':      cycleParty();   break;
    default: return;
  }
  e.preventDefault();
});

render();

/* ============================================================
   WebMCP (Meta AI voice control)
   Additive: the app works identically when document.modelContext is absent.
   Utterances: "the bill is 86 dollars" / "make it twenty percent" /
   "split it four ways" / "86 dollars, 20 percent, split between 4" /
   "what's the total?"
   ============================================================ */
function registerWebMcp() {
  const ctx = document.modelContext;
  if (!ctx || typeof ctx.registerTool !== 'function') return;

  function safeRegister(tool) {
    try {
      const r = ctx.registerTool(tool);
      if (r && typeof r.then === 'function') {
        r.then(undefined, (err) => console.error(tool.name + ' registration failed', err));
      }
    } catch (err) {
      console.error(tool.name + ' registration failed', err);
    }
  }

  function snapshot(next) {
    const tipAmt = state.bill * (state.tip / 100);
    const total  = state.bill + tipAmt;
    return {
      bill: Number(money(state.bill)),
      tip_percent: state.tip,
      tip_amount: Number(money(tipAmt)),
      total: Number(money(total)),
      party: state.party,
      per_person: Number(money(total / state.party)),
      next_action: next,
    };
  }

  const CONFIRM = 'Confirm the total (and per-person amount if split) in one short sentence, then stop.';

  safeRegister({
    name: 'tip_get_state',
    description: 'Report the current bill, tip percent, tip amount, total, party size and per-person share.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: () => snapshot('Tell the wearer the total in one short sentence, then stop.'),
  });

  safeRegister({
    name: 'tip_set_bill',
    description: 'Set the bill amount in dollars (0 or more, cents allowed). Returns the recalculated tip and total.',
    inputSchema: {
      type: 'object',
      properties: { amount: { type: 'number', description: 'Bill amount in dollars, e.g. 86.40. Must be 0 or more.' } },
      required: ['amount'],
    },
    execute: (args) => {
      if (!setBill(args && args.amount)) {
        return { error: true, message: 'Bill must be a number of dollars, 0 or more.', next_action: 'Ask for the bill amount and call again.' };
      }
      return snapshot(CONFIRM);
    },
  });

  safeRegister({
    name: 'tip_set_percent',
    description: 'Set the tip percentage (whole number 0-100). Returns the recalculated tip and total.',
    inputSchema: {
      type: 'object',
      properties: { percent: { type: 'integer', description: 'Tip percent as a whole number from 0 to 100, e.g. 20.' } },
      required: ['percent'],
    },
    execute: (args) => {
      if (!setTip(args && args.percent)) {
        return { error: true, message: 'Tip percent must be a whole number from 0 to 100.', next_action: 'Ask for the percentage and call again.' };
      }
      return snapshot(CONFIRM);
    },
  });

  safeRegister({
    name: 'tip_set_party',
    description: 'Set how many people split the bill (1-8). 1 means no split. Returns the per-person share.',
    inputSchema: {
      type: 'object',
      properties: { size: { type: 'integer', description: 'Number of people splitting, from 1 to 8.' } },
      required: ['size'],
    },
    execute: (args) => {
      if (!setParty(args && args.size)) {
        return { error: true, message: 'Party size must be a whole number from 1 to 8.', next_action: 'Ask how many people and call again.' };
      }
      return snapshot(CONFIRM);
    },
  });

  safeRegister({
    name: 'tip_calculate',
    description: 'Set any combination of bill, tip percent and party size in ONE call and return the total and per-person share. Use this when the wearer names more than one value in a sentence. Omitted values keep their current setting.',
    inputSchema: {
      type: 'object',
      properties: {
        bill:    { type: 'number',  description: 'Bill amount in dollars, 0 or more. Omit to keep the current bill.' },
        percent: { type: 'integer', description: 'Tip percent, whole number 0-100. Omit to keep the current tip.' },
        party:   { type: 'integer', description: 'Number of people splitting, 1-8. Omit to keep the current party size.' },
      },
    },
    execute: (args) => {
      args = args || {};
      const rejected = [];
      if (args.bill    != null && !setBill(args.bill))     rejected.push('bill (dollars, 0 or more)');
      if (args.percent != null && !setTip(args.percent))   rejected.push('percent (0-100)');
      if (args.party   != null && !setParty(args.party))   rejected.push('party (1-8)');
      const out = snapshot(CONFIRM);
      if (rejected.length) {
        out.error = true;
        out.message = 'Ignored invalid value(s): ' + rejected.join(', ') + '. Other values were applied.';
        out.next_action = 'Tell the wearer which value was ignored, give the current total, then stop.';
      }
      return out;
    },
  });
}
registerWebMcp();
