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
