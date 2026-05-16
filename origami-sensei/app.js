(function () {
  'use strict';

  // ===========================================================
  //  MODEL DATA
  //  Each step: { type, text, svg }
  //  type ∈ START | VALLEY | MOUNTAIN | UNFOLD | SQUASH | PETAL | REVERSE | SHAPE
  //  SVGs are 200×200 viewBox. Diagram shows the BEFORE state with the
  //  fold-line + arrow indicating what to do next.
  // ===========================================================

  // Reusable arrow markers for diagrams.
  function curveArrow(d, head) {
    // d = path data; head = "x,y x2,y2 x3,y3" for arrowhead polygon
    return '<path class="arrow" d="' + d + '"/><polygon class="arrow-head" points="' + head + '"/>';
  }

  var MODELS = [
    // ──────────────────────────────────────────────────────
    {
      key: 'cup',
      name: 'PAPER CUP',
      kanji: '杯',
      difficulty: 1,
      steps: [
        {
          type: 'START',
          text: 'Square paper, <strong>color side down</strong>.',
          svg:
            '<svg viewBox="0 0 200 200">' +
              '<rect class="paper back" x="30" y="30" width="140" height="140" rx="2"/>' +
              '<text class="label" x="100" y="106">WHITE SIDE UP</text>' +
            '</svg>'
        },
        {
          type: 'VALLEY',
          text: 'Valley fold <strong>corner to corner</strong>.',
          svg:
            '<svg viewBox="0 0 200 200">' +
              '<rect class="paper back" x="30" y="30" width="140" height="140" rx="2"/>' +
              '<line class="valley" x1="30" y1="170" x2="170" y2="30"/>' +
              curveArrow('M 160,160 Q 100,100 45,45', '45,45 60,46 50,60') +
            '</svg>'
        },
        {
          type: 'VALLEY',
          text: 'Fold the <strong>right point</strong> across to the left edge.',
          svg:
            '<svg viewBox="0 0 200 200">' +
              '<polygon class="paper" points="100,40 30,170 170,170"/>' +
              '<line class="valley" x1="50" y1="135" x2="140" y2="100"/>' +
              curveArrow('M 168,168 Q 110,135 56,116', '56,116 70,112 68,126') +
            '</svg>'
        },
        {
          type: 'VALLEY',
          text: 'Fold the <strong>left point</strong> across to the right edge.',
          svg:
            '<svg viewBox="0 0 200 200">' +
              '<polygon class="paper" points="100,40 30,170 170,170"/>' +
              '<polygon class="paper shade2" points="170,170 140,100 100,116 100,170"/>' +
              '<line class="crease" x1="50" y1="135" x2="140" y2="100"/>' +
              '<line class="valley" x1="150" y1="135" x2="60" y2="100"/>' +
              curveArrow('M 32,168 Q 90,135 144,116', '144,116 130,112 132,126') +
            '</svg>'
        },
        {
          type: 'VALLEY',
          text: 'Fold the <strong>front top flap</strong> down into the pocket.',
          svg:
            '<svg viewBox="0 0 200 200">' +
              '<polygon class="paper shade" points="56,116 144,116 144,170 56,170"/>' +
              '<polygon class="paper" points="100,40 56,116 144,116"/>' +
              '<line class="valley" x1="56" y1="116" x2="144" y2="116"/>' +
              curveArrow('M 100,52 Q 100,90 100,108', '100,108 92,98 108,98') +
            '</svg>'
        },
        {
          type: 'SHAPE',
          text: 'Fold the <strong>back flap behind</strong>. Pop open the top. <strong>Done.</strong>',
          svg:
            '<svg viewBox="0 0 200 200">' +
              '<polygon class="paper shade" points="56,70 144,70 156,170 44,170"/>' +
              '<path class="paper back" d="M 56,70 Q 100,86 144,70 Q 100,80 56,70 Z"/>' +
              '<text class="label" x="100" y="60">完 · CUP</text>' +
            '</svg>'
        }
      ]
    },

    // ──────────────────────────────────────────────────────
    {
      key: 'hat',
      name: 'PAPER HAT',
      kanji: '帽',
      difficulty: 1,
      steps: [
        {
          type: 'START',
          text: 'Rectangle, <strong>long side horizontal</strong>.',
          svg:
            '<svg viewBox="0 0 200 200">' +
              '<rect class="paper" x="20" y="60" width="160" height="80" rx="2"/>' +
              '<text class="label" x="100" y="106">NEWSPAPER WORKS GREAT</text>' +
            '</svg>'
        },
        {
          type: 'VALLEY',
          text: 'Valley fold in half, <strong>top down to bottom</strong>.',
          svg:
            '<svg viewBox="0 0 200 200">' +
              '<rect class="paper" x="20" y="60" width="160" height="80" rx="2"/>' +
              '<line class="valley" x1="20" y1="100" x2="180" y2="100"/>' +
              curveArrow('M 100,66 Q 130,100 100,134', '100,134 90,124 110,124') +
            '</svg>'
        },
        {
          type: 'VALLEY',
          text: 'Fold <strong>top corners</strong> down to the center line.',
          svg:
            '<svg viewBox="0 0 200 200">' +
              '<rect class="paper" x="20" y="100" width="160" height="50" rx="2"/>' +
              '<line class="valley" x1="100" y1="100" x2="40" y2="150"/>' +
              '<line class="valley" x1="100" y1="100" x2="160" y2="150"/>' +
              curveArrow('M 30,104 Q 60,120 90,148', '90,148 92,134 78,140') +
              curveArrow('M 170,104 Q 140,120 110,148', '110,148 122,140 108,134') +
            '</svg>'
        },
        {
          type: 'VALLEY',
          text: 'Fold up the <strong>front bottom flap</strong>.',
          svg:
            '<svg viewBox="0 0 200 200">' +
              '<polygon class="paper" points="40,150 160,150 130,100 70,100"/>' +
              '<rect class="paper shade2" x="40" y="150" width="120" height="20"/>' +
              '<line class="valley" x1="40" y1="150" x2="160" y2="150"/>' +
              curveArrow('M 100,166 Q 100,154 100,142', '100,142 92,152 108,152') +
            '</svg>'
        },
        {
          type: 'SHAPE',
          text: 'Flip and <strong>fold the back flap up</strong>. Open at the bottom. <strong>Done.</strong>',
          svg:
            '<svg viewBox="0 0 200 200">' +
              '<polygon class="paper" points="40,150 160,150 130,80 70,80"/>' +
              '<rect class="paper shade" x="40" y="130" width="120" height="20"/>' +
              '<text class="label" x="100" y="70">完 · HAT</text>' +
            '</svg>'
        }
      ]
    },

    // ──────────────────────────────────────────────────────
    {
      key: 'plane',
      name: 'PAPER PLANE',
      kanji: '機',
      difficulty: 1,
      steps: [
        {
          type: 'START',
          text: 'A4 paper, <strong>portrait orientation</strong>.',
          svg:
            '<svg viewBox="0 0 200 200">' +
              '<rect class="paper" x="70" y="20" width="60" height="160" rx="2"/>' +
              '<text class="label" x="100" y="106">A4 OR LETTER</text>' +
            '</svg>'
        },
        {
          type: 'UNFOLD',
          text: 'Valley fold <strong>in half lengthwise</strong>, then unfold.',
          svg:
            '<svg viewBox="0 0 200 200">' +
              '<rect class="paper" x="70" y="20" width="60" height="160" rx="2"/>' +
              '<line class="valley" x1="100" y1="20" x2="100" y2="180"/>' +
              curveArrow('M 80,30 Q 100,50 80,70', '80,70 78,58 90,62') +
              '<text class="label" x="100" y="194">UNFOLD</text>' +
            '</svg>'
        },
        {
          type: 'VALLEY',
          text: 'Fold <strong>top corners</strong> down to the center crease.',
          svg:
            '<svg viewBox="0 0 200 200">' +
              '<rect class="paper" x="70" y="20" width="60" height="160" rx="2"/>' +
              '<line class="crease" x1="100" y1="20" x2="100" y2="180"/>' +
              '<line class="valley" x1="70" y1="20" x2="100" y2="58"/>' +
              '<line class="valley" x1="130" y1="20" x2="100" y2="58"/>' +
              curveArrow('M 64,24 Q 80,38 96,58', '96,58 96,46 86,52') +
              curveArrow('M 136,24 Q 120,38 104,58', '104,58 114,52 104,46') +
            '</svg>'
        },
        {
          type: 'VALLEY',
          text: 'Fold the <strong>new slanted edges</strong> to the center.',
          svg:
            '<svg viewBox="0 0 200 200">' +
              '<polygon class="paper" points="70,60 100,20 130,60 130,180 70,180"/>' +
              '<line class="crease" x1="100" y1="20" x2="100" y2="180"/>' +
              '<line class="valley" x1="70" y1="60" x2="100" y2="100"/>' +
              '<line class="valley" x1="130" y1="60" x2="100" y2="100"/>' +
              curveArrow('M 66,68 Q 82,80 94,98', '94,98 94,86 84,92') +
              curveArrow('M 134,68 Q 118,80 106,98', '106,98 116,92 106,86') +
            '</svg>'
        },
        {
          type: 'MOUNTAIN',
          text: 'Mountain fold <strong>in half</strong> along the center crease.',
          svg:
            '<svg viewBox="0 0 200 200">' +
              '<polygon class="paper" points="100,20 130,60 130,180 100,180"/>' +
              '<polygon class="paper shade2" points="100,20 70,60 70,180 100,180"/>' +
              '<line class="mountain" x1="100" y1="20" x2="100" y2="180"/>' +
              curveArrow('M 60,100 Q 86,90 96,100', '96,100 84,96 88,108') +
              curveArrow('M 140,100 Q 114,90 104,100', '104,100 116,96 112,108') +
            '</svg>'
        },
        {
          type: 'SHAPE',
          text: 'Fold <strong>each wing down</strong>. Launch with care. <strong>Done.</strong>',
          svg:
            '<svg viewBox="0 0 200 200">' +
              '<polygon class="paper" points="100,20 100,180 30,160"/>' +
              '<polygon class="paper shade2" points="100,20 100,180 170,160"/>' +
              '<line class="valley" x1="100" y1="40" x2="40" y2="155"/>' +
              '<line class="valley" x1="100" y1="40" x2="160" y2="155"/>' +
              '<text class="label" x="100" y="194">完 · DART</text>' +
            '</svg>'
        }
      ]
    },

    // ──────────────────────────────────────────────────────
    {
      key: 'heart',
      name: 'HEART',
      kanji: '心',
      difficulty: 2,
      steps: [
        {
          type: 'START',
          text: 'Square paper, <strong>color side up</strong>.',
          svg:
            '<svg viewBox="0 0 200 200">' +
              '<rect class="paper" x="30" y="30" width="140" height="140" rx="2"/>' +
              '<text class="label" x="100" y="106">COLOR SIDE UP</text>' +
            '</svg>'
        },
        {
          type: 'UNFOLD',
          text: 'Valley fold <strong>corner to corner</strong>, then unfold.',
          svg:
            '<svg viewBox="0 0 200 200">' +
              '<rect class="paper" x="30" y="30" width="140" height="140" rx="2"/>' +
              '<line class="valley" x1="30" y1="30" x2="170" y2="170"/>' +
              curveArrow('M 160,40 Q 100,100 40,160', '40,160 44,146 54,156') +
              '<text class="label" x="100" y="194">UNFOLD — KEEP CREASE</text>' +
            '</svg>'
        },
        {
          type: 'VALLEY',
          text: 'Fold the <strong>top corner down</strong> to the center.',
          svg:
            '<svg viewBox="0 0 200 200">' +
              '<rect class="paper" x="30" y="30" width="140" height="140" rx="2"/>' +
              '<line class="crease" x1="30" y1="30" x2="170" y2="170"/>' +
              '<line class="valley" x1="40" y1="60" x2="140" y2="160"/>' +
              curveArrow('M 36,38 Q 70,80 96,102', '96,102 88,92 84,104') +
            '</svg>'
        },
        {
          type: 'VALLEY',
          text: 'Fold the <strong>bottom corner up</strong> to the top edge.',
          svg:
            '<svg viewBox="0 0 200 200">' +
              '<polygon class="paper" points="170,30 170,170 30,170 60,120 90,90 120,60"/>' +
              '<polygon class="paper shade2" points="60,120 90,90 120,60 100,100"/>' +
              '<line class="valley" x1="40" y1="140" x2="140" y2="40"/>' +
              curveArrow('M 168,168 Q 110,110 60,60', '60,60 74,60 64,74') +
            '</svg>'
        },
        {
          type: 'VALLEY',
          text: 'Fold <strong>left and right corners</strong> up to the top.',
          svg:
            '<svg viewBox="0 0 200 200">' +
              '<polygon class="paper" points="30,140 170,140 100,70"/>' +
              '<polygon class="paper shade2" points="100,70 60,110 140,110"/>' +
              '<line class="valley" x1="30" y1="140" x2="100" y2="105"/>' +
              '<line class="valley" x1="170" y1="140" x2="100" y2="105"/>' +
              curveArrow('M 38,134 Q 70,80 92,80', '92,80 80,80 86,92') +
              curveArrow('M 162,134 Q 130,80 108,80', '108,80 120,80 114,92') +
            '</svg>'
        },
        {
          type: 'SHAPE',
          text: 'Mountain fold the <strong>four small corners</strong> behind to round. <strong>Done.</strong>',
          svg:
            '<svg viewBox="0 0 200 200">' +
              '<path class="paper" d="M 100,70 ' +
                'C 100,40 50,40 50,80 C 50,110 100,140 100,160 ' +
                'C 100,140 150,110 150,80 C 150,40 100,40 100,70 Z"/>' +
              '<text class="label" x="100" y="186">完 · HEART</text>' +
            '</svg>'
        }
      ]
    },

    // ──────────────────────────────────────────────────────
    {
      key: 'fortune',
      name: 'FORTUNE TELLER',
      kanji: '占',
      difficulty: 2,
      steps: [
        {
          type: 'START',
          text: 'Square paper, <strong>color side down</strong>.',
          svg:
            '<svg viewBox="0 0 200 200">' +
              '<rect class="paper back" x="30" y="30" width="140" height="140" rx="2"/>' +
              '<text class="label" x="100" y="106">WHITE SIDE UP</text>' +
            '</svg>'
        },
        {
          type: 'UNFOLD',
          text: 'Crease <strong>both diagonals</strong>, then unfold.',
          svg:
            '<svg viewBox="0 0 200 200">' +
              '<rect class="paper back" x="30" y="30" width="140" height="140" rx="2"/>' +
              '<line class="valley" x1="30" y1="30" x2="170" y2="170"/>' +
              '<line class="valley" x1="170" y1="30" x2="30" y2="170"/>' +
              '<text class="label" x="100" y="194">UNFOLD AFTER EACH</text>' +
            '</svg>'
        },
        {
          type: 'VALLEY',
          text: 'Fold <strong>all four corners</strong> to the center.',
          svg:
            '<svg viewBox="0 0 200 200">' +
              '<rect class="paper back" x="30" y="30" width="140" height="140" rx="2"/>' +
              '<line class="crease" x1="30" y1="30" x2="170" y2="170"/>' +
              '<line class="crease" x1="170" y1="30" x2="30" y2="170"/>' +
              '<line class="valley" x1="100" y1="30" x2="30" y2="100"/>' +
              '<line class="valley" x1="100" y1="30" x2="170" y2="100"/>' +
              '<line class="valley" x1="30" y1="100" x2="100" y2="170"/>' +
              '<line class="valley" x1="170" y1="100" x2="100" y2="170"/>' +
              curveArrow('M 36,36 Q 70,70 92,92', '92,92 82,84 80,96') +
              curveArrow('M 164,36 Q 130,70 108,92', '108,92 120,96 118,84') +
              curveArrow('M 36,164 Q 70,130 92,108', '92,108 80,104 82,116') +
              curveArrow('M 164,164 Q 130,130 108,108', '108,108 118,116 120,104') +
            '</svg>'
        },
        {
          type: 'SHAPE',
          text: '<strong>Flip the paper over.</strong>',
          svg:
            '<svg viewBox="0 0 200 200">' +
              '<polygon class="paper shade2" points="100,40 160,100 100,160 40,100"/>' +
              '<line class="crease" x1="100" y1="40" x2="100" y2="160"/>' +
              '<line class="crease" x1="40" y1="100" x2="160" y2="100"/>' +
              curveArrow('M 50,180 Q 100,170 150,180', '150,180 138,176 140,188') +
              '<text class="label" x="100" y="30">FLIP</text>' +
            '</svg>'
        },
        {
          type: 'VALLEY',
          text: 'Fold <strong>all four corners</strong> to the center again.',
          svg:
            '<svg viewBox="0 0 200 200">' +
              '<rect class="paper" x="30" y="30" width="140" height="140" rx="2"/>' +
              '<line class="crease" x1="30" y1="30" x2="170" y2="170"/>' +
              '<line class="crease" x1="170" y1="30" x2="30" y2="170"/>' +
              '<line class="valley" x1="100" y1="30" x2="30" y2="100"/>' +
              '<line class="valley" x1="100" y1="30" x2="170" y2="100"/>' +
              '<line class="valley" x1="30" y1="100" x2="100" y2="170"/>' +
              '<line class="valley" x1="170" y1="100" x2="100" y2="170"/>' +
              curveArrow('M 36,36 Q 70,70 92,92', '92,92 82,84 80,96') +
              curveArrow('M 164,164 Q 130,130 108,108', '108,108 118,116 120,104') +
            '</svg>'
        },
        {
          type: 'VALLEY',
          text: 'Fold <strong>in half</strong> horizontally.',
          svg:
            '<svg viewBox="0 0 200 200">' +
              '<rect class="paper shade" x="50" y="50" width="100" height="100" rx="2"/>' +
              '<line class="crease" x1="50" y1="100" x2="150" y2="100"/>' +
              '<line class="crease" x1="100" y1="50" x2="100" y2="150"/>' +
              '<line class="valley" x1="40" y1="100" x2="160" y2="100"/>' +
              curveArrow('M 100,60 Q 130,100 100,140', '100,140 90,130 110,130') +
            '</svg>'
        },
        {
          type: 'SHAPE',
          text: 'Slide <strong>thumbs and forefingers</strong> under the four flaps.',
          svg:
            '<svg viewBox="0 0 200 200">' +
              '<rect class="paper shade" x="40" y="80" width="120" height="60" rx="2"/>' +
              '<line class="crease" x1="100" y1="80" x2="100" y2="140"/>' +
              '<circle cx="56" cy="110" r="10" fill="none" stroke="#d83c2c" stroke-width="2"/>' +
              '<circle cx="144" cy="110" r="10" fill="none" stroke="#d83c2c" stroke-width="2"/>' +
              '<text class="label" x="100" y="168">UNDER EACH FLAP</text>' +
            '</svg>'
        },
        {
          type: 'SHAPE',
          text: '<strong>Pinch fingers together.</strong> Tell a fortune. <strong>Done.</strong>',
          svg:
            '<svg viewBox="0 0 200 200">' +
              '<polygon class="paper" points="100,40 160,100 100,160 40,100"/>' +
              '<polygon class="paper shade" points="100,100 100,40 160,100"/>' +
              '<polygon class="paper shade" points="100,100 100,160 40,100"/>' +
              '<line class="crease" x1="100" y1="40" x2="100" y2="160"/>' +
              '<line class="crease" x1="40" y1="100" x2="160" y2="100"/>' +
              '<text class="label" x="100" y="186">完 · TELLER</text>' +
            '</svg>'
        }
      ]
    },

    // ──────────────────────────────────────────────────────
    {
      key: 'crane',
      name: 'CRANE',
      kanji: '鶴',
      difficulty: 3,
      steps: [
        {
          type: 'START',
          text: 'Square paper, <strong>color side up</strong>.',
          svg:
            '<svg viewBox="0 0 200 200">' +
              '<rect class="paper" x="30" y="30" width="140" height="140" rx="2"/>' +
              '<text class="label" x="100" y="106">CHOOSE YOUR COLOR</text>' +
            '</svg>'
        },
        {
          type: 'UNFOLD',
          text: 'Crease <strong>both diagonals</strong>, then unfold.',
          svg:
            '<svg viewBox="0 0 200 200">' +
              '<rect class="paper" x="30" y="30" width="140" height="140" rx="2"/>' +
              '<line class="valley" x1="30" y1="30" x2="170" y2="170"/>' +
              '<line class="valley" x1="170" y1="30" x2="30" y2="170"/>' +
            '</svg>'
        },
        {
          type: 'UNFOLD',
          text: 'Flip. Crease <strong>both midlines</strong>, then unfold.',
          svg:
            '<svg viewBox="0 0 200 200">' +
              '<rect class="paper back" x="30" y="30" width="140" height="140" rx="2"/>' +
              '<line class="crease" x1="30" y1="30" x2="170" y2="170"/>' +
              '<line class="crease" x1="170" y1="30" x2="30" y2="170"/>' +
              '<line class="valley" x1="30" y1="100" x2="170" y2="100"/>' +
              '<line class="valley" x1="100" y1="30" x2="100" y2="170"/>' +
            '</svg>'
        },
        {
          type: 'SQUASH',
          text: 'Collapse into a <strong>square base</strong>: push sides in along the creases.',
          svg:
            '<svg viewBox="0 0 200 200">' +
              '<polygon class="paper" points="100,40 160,100 100,160 40,100"/>' +
              '<polygon class="paper shade" points="100,100 100,40 160,100"/>' +
              '<line class="crease" x1="100" y1="40" x2="100" y2="160"/>' +
              curveArrow('M 50,50 Q 80,80 96,96', '96,96 84,90 86,102') +
              curveArrow('M 150,50 Q 120,80 104,96', '104,96 114,102 116,90') +
              '<text class="label" x="100" y="186">SQUARE BASE</text>' +
            '</svg>'
        },
        {
          type: 'VALLEY',
          text: 'Fold <strong>front flap edges</strong> in to the center line.',
          svg:
            '<svg viewBox="0 0 200 200">' +
              '<polygon class="paper" points="100,40 160,100 100,160 40,100"/>' +
              '<line class="crease" x1="100" y1="40" x2="100" y2="160"/>' +
              '<line class="valley" x1="100" y1="40" x2="76" y2="148"/>' +
              '<line class="valley" x1="100" y1="40" x2="124" y2="148"/>' +
              curveArrow('M 50,108 Q 80,100 92,108', '92,108 80,104 84,116') +
              curveArrow('M 150,108 Q 120,100 108,108', '108,108 116,116 120,104') +
            '</svg>'
        },
        {
          type: 'VALLEY',
          text: 'Fold the <strong>top triangle</strong> down over the two flaps.',
          svg:
            '<svg viewBox="0 0 200 200">' +
              '<polygon class="paper" points="100,40 130,90 130,150 70,150 70,90"/>' +
              '<polygon class="paper shade" points="100,40 130,90 70,90"/>' +
              '<line class="valley" x1="70" y1="90" x2="130" y2="90"/>' +
              curveArrow('M 100,50 Q 120,80 100,98', '100,98 92,88 108,88') +
            '</svg>'
        },
        {
          type: 'UNFOLD',
          text: '<strong>Unfold</strong> the last three folds to reveal a kite-shaped crease pattern.',
          svg:
            '<svg viewBox="0 0 200 200">' +
              '<polygon class="paper" points="100,40 160,100 100,160 40,100"/>' +
              '<line class="crease" x1="100" y1="40" x2="100" y2="160"/>' +
              '<line class="crease" x1="100" y1="40" x2="76" y2="148"/>' +
              '<line class="crease" x1="100" y1="40" x2="124" y2="148"/>' +
              '<line class="crease" x1="70" y1="90" x2="130" y2="90"/>' +
            '</svg>'
        },
        {
          type: 'PETAL',
          text: '<strong>Petal fold</strong>: lift the bottom flap up using the new creases.',
          svg:
            '<svg viewBox="0 0 200 200">' +
              '<polygon class="paper" points="100,40 160,100 100,160 40,100"/>' +
              '<polygon class="paper shade" points="100,60 130,100 100,150 70,100"/>' +
              curveArrow('M 100,150 Q 130,100 100,60', '100,60 90,70 110,70') +
              '<text class="label" x="100" y="186">FLIP &amp; REPEAT BACK</text>' +
            '</svg>'
        },
        {
          type: 'PETAL',
          text: 'Flip over. <strong>Repeat the petal fold</strong> on the other side. Now: <strong>bird base</strong>.',
          svg:
            '<svg viewBox="0 0 200 200">' +
              '<polygon class="paper" points="100,30 150,150 100,120 50,150"/>' +
              '<polygon class="paper shade" points="100,30 100,120 50,150"/>' +
              '<line class="crease" x1="100" y1="30" x2="100" y2="120"/>' +
              '<text class="label" x="100" y="186">BIRD BASE</text>' +
            '</svg>'
        },
        {
          type: 'REVERSE',
          text: 'Narrow both bottom legs. <strong>Inside-reverse fold</strong> one tip up for the head.',
          svg:
            '<svg viewBox="0 0 200 200">' +
              '<polygon class="paper" points="100,30 160,160 100,120 40,160"/>' +
              '<line class="crease" x1="100" y1="30" x2="100" y2="120"/>' +
              '<line class="valley" x1="100" y1="100" x2="60" y2="40"/>' +
              curveArrow('M 56,148 Q 64,90 66,52', '66,52 58,62 74,60') +
            '</svg>'
        },
        {
          type: 'SHAPE',
          text: '<strong>Inside-reverse</strong> the tip to form the beak. Pull the wings open. <strong>Done.</strong>',
          svg:
            '<svg viewBox="0 0 200 200">' +
              '<path class="paper" d="M 60,80 L 30,40 L 50,90 L 100,110 L 170,150 L 130,90 L 100,80 Z"/>' +
              '<path class="paper shade" d="M 100,80 L 100,110 L 130,90 Z"/>' +
              '<line class="crease" x1="60" y1="80" x2="30" y2="40"/>' +
              '<text class="label" x="100" y="186">完 · CRANE</text>' +
            '</svg>'
        }
      ]
    }
  ];

  // ===========================================================
  //  STATE
  // ===========================================================
  var state = {
    screen: 'menu',
    menuIdx: 0,
    modelIdx: 0,
    stepIdx: 0,
    doneActionIdx: 0, // 0 = again, 1 = menu
    audioCtx: null,
    masterGain: null,
  };

  // ===========================================================
  //  AUDIO ENGINE — paper-crinkle "fold" and soft completion bell
  // ===========================================================
  function initAudio() {
    if (state.audioCtx) return;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    state.audioCtx = new Ctx();
    state.masterGain = state.audioCtx.createGain();
    state.masterGain.gain.setValueAtTime(0.5, state.audioCtx.currentTime);
    state.masterGain.connect(state.audioCtx.destination);
  }
  function resumeAudio() {
    if (state.audioCtx && state.audioCtx.state === 'suspended') state.audioCtx.resume();
  }

  function playFold() {
    initAudio();
    if (!state.audioCtx) return;
    resumeAudio();
    var ctx = state.audioCtx;
    var sr  = ctx.sampleRate;
    var dur = 0.16;
    var len = Math.ceil(dur * sr);
    var buf = ctx.createBuffer(1, len, sr);
    var d   = buf.getChannelData(0);
    for (var i = 0; i < len; i++) {
      var t = i / sr;
      var env = Math.exp(-t / 0.05) * (1 - Math.exp(-t / 0.003));
      d[i] = (Math.random() * 2 - 1) * env * 0.6;
    }
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2200, ctx.currentTime);
    bp.Q.setValueAtTime(0.9, ctx.currentTime);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.45, ctx.currentTime);
    src.connect(bp); bp.connect(g); g.connect(state.masterGain);
    src.start();
  }

  function playMenuTick() {
    initAudio();
    if (!state.audioCtx) return;
    resumeAudio();
    var ctx = state.audioCtx;
    var now = ctx.currentTime;
    var osc = ctx.createOscillator();
    var g   = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.16, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    osc.connect(g); g.connect(state.masterGain);
    osc.start(now); osc.stop(now + 0.10);
  }

  function playBell() {
    initAudio();
    if (!state.audioCtx) return;
    resumeAudio();
    var ctx = state.audioCtx;
    var now = ctx.currentTime;
    // two-tone Japanese bell-ish
    [880, 660, 1320].forEach(function (f, idx) {
      var osc = ctx.createOscillator();
      var g   = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + idx * 0.05);
      g.gain.setValueAtTime(0.0001, now + idx * 0.05);
      g.gain.exponentialRampToValueAtTime(0.18, now + idx * 0.05 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.05 + 1.2);
      osc.connect(g); g.connect(state.masterGain);
      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 1.3);
    });
  }

  // ===========================================================
  //  RENDER
  // ===========================================================
  function showScreen(name) {
    state.screen = name;
    ['menu', 'fold', 'done'].forEach(function (s) {
      var el = document.getElementById('screen-' + s);
      if (el) el.classList.toggle('hidden', s !== name);
    });
  }

  function difficultyStars(n) {
    var s = '';
    for (var i = 0; i < 3; i++) s += (i < n) ? '★' : '☆';
    return s;
  }

  function renderMenu() {
    var list = document.getElementById('menu-list');
    if (!list) return;
    list.innerHTML = '';
    MODELS.forEach(function (m, i) {
      var row = document.createElement('div');
      row.className = 'menu-row' + (i === state.menuIdx ? ' focused' : '');
      row.dataset.idx = i;
      row.innerHTML =
        '<span class="row-kanji">' + m.kanji + '</span>' +
        '<span class="row-name">' + m.name + '</span>' +
        '<span class="row-stars">' + difficultyStars(m.difficulty) + '</span>' +
        '<span class="row-meta">' + pad2(m.steps.length) + ' STEPS</span>';
      list.appendChild(row);
    });
    var serial = document.getElementById('menu-serial');
    if (serial) serial.textContent = numKanji(MODELS.length) + ' · MODELS';
  }

  function renderFold() {
    var m = MODELS[state.modelIdx];
    var step = m.steps[state.stepIdx];

    var mark = document.getElementById('fold-mark');
    if (mark) mark.textContent = m.kanji;

    var model = document.getElementById('fold-model');
    if (model) model.textContent = m.name;

    var counter = document.getElementById('fold-counter');
    if (counter) counter.textContent = pad2(state.stepIdx + 1) + ' / ' + pad2(m.steps.length);

    var diff = document.getElementById('fold-difficulty');
    if (diff) diff.textContent = difficultyStars(m.difficulty);

    var chip = document.getElementById('fold-type');
    if (chip) {
      chip.textContent = step.type;
      chip.className = 'fold-chip ' + step.type.toLowerCase();
    }

    var diagram = document.getElementById('diagram');
    if (diagram) {
      diagram.innerHTML = step.svg;
      diagram.classList.remove('tick');
      void diagram.offsetWidth;
      diagram.classList.add('tick');
    }

    var instr = document.getElementById('instruction');
    if (instr) instr.innerHTML = step.text;

    renderProgressDots();
  }

  function renderProgressDots() {
    var m = MODELS[state.modelIdx];
    var dots = document.getElementById('progress-dots');
    if (!dots) return;
    dots.innerHTML = '';
    for (var i = 0; i < m.steps.length; i++) {
      var d = document.createElement('span');
      d.className = 'dot' +
        (i < state.stepIdx ? ' done' : '') +
        (i === state.stepIdx ? ' current' : '');
      dots.appendChild(d);
    }
  }

  function renderDone() {
    var m = MODELS[state.modelIdx];
    var kanji = document.getElementById('done-kanji');
    if (kanji) kanji.textContent = m.kanji;
    var name = document.getElementById('done-name');
    if (name) name.textContent = m.name;
    var sub = document.getElementById('done-sub');
    if (sub) sub.textContent = m.steps.length + ' folds · well done';
    updateDoneFocus();
  }

  function updateDoneFocus() {
    var again = document.getElementById('doneAgainBtn');
    var menu  = document.getElementById('doneMenuBtn');
    if (again) again.classList.toggle('focused', state.doneActionIdx === 0);
    if (menu)  menu.classList.toggle('focused',  state.doneActionIdx === 1);
  }

  // ===========================================================
  //  NAV
  // ===========================================================
  function gotoMenu() {
    showScreen('menu');
    renderMenu();
  }

  function startModel(idx) {
    state.modelIdx = idx;
    state.stepIdx = 0;
    showScreen('fold');
    renderFold();
    playFold();
  }

  function nextStep() {
    var m = MODELS[state.modelIdx];
    if (state.stepIdx >= m.steps.length - 1) {
      state.doneActionIdx = 0;
      showScreen('done');
      renderDone();
      playBell();
      return;
    }
    state.stepIdx += 1;
    renderFold();
    playFold();
  }

  function prevStep() {
    if (state.stepIdx === 0) {
      gotoMenu();
      return;
    }
    state.stepIdx -= 1;
    renderFold();
    playMenuTick();
  }

  function menuMove(delta) {
    var n = MODELS.length;
    state.menuIdx = ((state.menuIdx + delta) % n + n) % n;
    renderMenu();
    playMenuTick();
  }

  function doneAction(which) {
    if (which === 'again') {
      startModel(state.modelIdx);
    } else {
      gotoMenu();
    }
  }

  function doneMove(delta) {
    state.doneActionIdx = (state.doneActionIdx + delta + 2) % 2;
    updateDoneFocus();
    playMenuTick();
  }

  // ===========================================================
  //  UTIL
  // ===========================================================
  function pad2(n) {
    var s = String(Math.max(0, Math.min(99, n|0)));
    return s.length < 2 ? '0' + s : s;
  }
  function numKanji(n) {
    var k = ['零','一','二','三','四','五','六','七','八','九','十'];
    return k[n] || String(n);
  }

  function setStatus(msg) {
    var el = document.getElementById('status');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('show', !!msg);
    if (msg) {
      clearTimeout(setStatus._t);
      setStatus._t = setTimeout(function () { el.classList.remove('show'); }, 1400);
    }
  }

  // ===========================================================
  //  EVENTS
  // ===========================================================
  function setupEvents() {
    document.addEventListener('click', function (e) {
      initAudio(); resumeAudio();
      var menuRow = e.target.closest('.menu-row');
      if (menuRow && state.screen === 'menu') {
        var idx = parseInt(menuRow.dataset.idx, 10);
        if (!isNaN(idx)) {
          state.menuIdx = idx;
          startModel(idx);
        }
        return;
      }
      var btn = e.target.closest('[data-action]');
      if (btn && state.screen === 'done') {
        doneAction(btn.dataset.action);
        return;
      }
      // tap diagram / instruction → next step
      if (state.screen === 'fold' &&
          (e.target.closest('.diagram-wrap') || e.target.closest('.instruction'))) {
        nextStep();
      }
    });

    document.addEventListener('keydown', function (e) {
      switch (state.screen) {
        case 'menu':   handleMenuKey(e);   break;
        case 'fold':   handleFoldKey(e);   break;
        case 'done':   handleDoneKey(e);   break;
      }
    });
  }

  function handleMenuKey(e) {
    switch (e.key) {
      case 'ArrowDown':
      case 'j': menuMove(1);  e.preventDefault(); break;
      case 'ArrowUp':
      case 'k': menuMove(-1); e.preventDefault(); break;
      case 'Enter':
      case ' ':
      case 'ArrowRight':
        startModel(state.menuIdx);
        e.preventDefault();
        break;
    }
  }

  function handleFoldKey(e) {
    switch (e.key) {
      case 'Enter':
      case ' ':
      case 'ArrowRight':
      case 'ArrowDown':
        nextStep();
        e.preventDefault();
        break;
      case 'ArrowLeft':
        prevStep();
        e.preventDefault();
        break;
      case 'ArrowUp':
      case 'Escape':
      case 'Backspace':
        gotoMenu();
        e.preventDefault();
        break;
    }
  }

  function handleDoneKey(e) {
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        doneMove(-1);
        e.preventDefault();
        break;
      case 'ArrowRight':
      case 'ArrowDown':
        doneMove(1);
        e.preventDefault();
        break;
      case 'Enter':
      case ' ':
        doneAction(state.doneActionIdx === 0 ? 'again' : 'menu');
        e.preventDefault();
        break;
      case 'Escape':
      case 'Backspace':
        gotoMenu();
        e.preventDefault();
        break;
    }
  }

  // ===========================================================
  //  INIT
  // ===========================================================
  function init() {
    renderMenu();
    showScreen('menu');
    setupEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
