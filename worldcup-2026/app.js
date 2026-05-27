(function () {
  'use strict';

  // ===========================================================
  //  TEAMS — FIFA code, flag, group
  // ===========================================================
  var TEAMS = {
    'Mexico':               { code: 'MEX', flag: '🇲🇽', group: 'A' },
    'South Africa':         { code: 'RSA', flag: '🇿🇦', group: 'A' },
    'South Korea':          { code: 'KOR', flag: '🇰🇷', group: 'A' },
    'Czech Republic':       { code: 'CZE', flag: '🇨🇿', group: 'A' },

    'Canada':               { code: 'CAN', flag: '🇨🇦', group: 'B' },
    'Bosnia & Herzegovina': { code: 'BIH', flag: '🇧🇦', group: 'B' },
    'Qatar':                { code: 'QAT', flag: '🇶🇦', group: 'B' },
    'Switzerland':          { code: 'SUI', flag: '🇨🇭', group: 'B' },

    'Brazil':               { code: 'BRA', flag: '🇧🇷', group: 'C' },
    'Morocco':              { code: 'MAR', flag: '🇲🇦', group: 'C' },
    'Haiti':                { code: 'HAI', flag: '🇭🇹', group: 'C' },
    'Scotland':             { code: 'SCO', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', group: 'C' },

    'USA':                  { code: 'USA', flag: '🇺🇸', group: 'D' },
    'Paraguay':             { code: 'PAR', flag: '🇵🇾', group: 'D' },
    'Australia':            { code: 'AUS', flag: '🇦🇺', group: 'D' },
    'Turkey':               { code: 'TUR', flag: '🇹🇷', group: 'D' },

    'Germany':              { code: 'GER', flag: '🇩🇪', group: 'E' },
    'Curaçao':              { code: 'CUW', flag: '🇨🇼', group: 'E' },
    'Ivory Coast':          { code: 'CIV', flag: '🇨🇮', group: 'E' },
    'Ecuador':              { code: 'ECU', flag: '🇪🇨', group: 'E' },

    'Netherlands':          { code: 'NED', flag: '🇳🇱', group: 'F' },
    'Japan':                { code: 'JPN', flag: '🇯🇵', group: 'F' },
    'Sweden':               { code: 'SWE', flag: '🇸🇪', group: 'F' },
    'Tunisia':              { code: 'TUN', flag: '🇹🇳', group: 'F' },

    'Belgium':              { code: 'BEL', flag: '🇧🇪', group: 'G' },
    'Egypt':                { code: 'EGY', flag: '🇪🇬', group: 'G' },
    'Iran':                 { code: 'IRN', flag: '🇮🇷', group: 'G' },
    'New Zealand':          { code: 'NZL', flag: '🇳🇿', group: 'G' },

    'Spain':                { code: 'ESP', flag: '🇪🇸', group: 'H' },
    'Cape Verde':           { code: 'CPV', flag: '🇨🇻', group: 'H' },
    'Saudi Arabia':         { code: 'KSA', flag: '🇸🇦', group: 'H' },
    'Uruguay':              { code: 'URU', flag: '🇺🇾', group: 'H' },

    'France':               { code: 'FRA', flag: '🇫🇷', group: 'I' },
    'Senegal':              { code: 'SEN', flag: '🇸🇳', group: 'I' },
    'Iraq':                 { code: 'IRQ', flag: '🇮🇶', group: 'I' },
    'Norway':               { code: 'NOR', flag: '🇳🇴', group: 'I' },

    'Argentina':            { code: 'ARG', flag: '🇦🇷', group: 'J' },
    'Algeria':              { code: 'ALG', flag: '🇩🇿', group: 'J' },
    'Austria':              { code: 'AUT', flag: '🇦🇹', group: 'J' },
    'Jordan':               { code: 'JOR', flag: '🇯🇴', group: 'J' },

    'Portugal':             { code: 'POR', flag: '🇵🇹', group: 'K' },
    'DR Congo':             { code: 'COD', flag: '🇨🇩', group: 'K' },
    'Uzbekistan':           { code: 'UZB', flag: '🇺🇿', group: 'K' },
    'Colombia':             { code: 'COL', flag: '🇨🇴', group: 'K' },

    'England':              { code: 'ENG', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', group: 'L' },
    'Croatia':              { code: 'CRO', flag: '🇭🇷', group: 'L' },
    'Ghana':                { code: 'GHA', flag: '🇬🇭', group: 'L' },
    'Panama':               { code: 'PAN', flag: '🇵🇦', group: 'L' },
  };

  var GROUPS = ['A','B','C','D','E','F','G','H','I','J','K','L'];

  // ===========================================================
  //  MATCHES — full schedule from openfootball/worldcup.json
  // ===========================================================
  var MATCHES = [
    {round:"Matchday 1", date:"2026-06-11", time:"13:00 UTC-6", team1:"Mexico", team2:"South Africa", group:"Group A", ground:"Mexico City"},
    {round:"Matchday 1", date:"2026-06-11", time:"20:00 UTC-6", team1:"South Korea", team2:"Czech Republic", group:"Group A", ground:"Guadalajara (Zapopan)"},
    {round:"Matchday 8", date:"2026-06-18", time:"12:00 UTC-4", team1:"Czech Republic", team2:"South Africa", group:"Group A", ground:"Atlanta"},
    {round:"Matchday 8", date:"2026-06-18", time:"19:00 UTC-6", team1:"Mexico", team2:"South Korea", group:"Group A", ground:"Guadalajara (Zapopan)"},
    {round:"Matchday 14", date:"2026-06-24", time:"19:00 UTC-6", team1:"Czech Republic", team2:"Mexico", group:"Group A", ground:"Mexico City"},
    {round:"Matchday 14", date:"2026-06-24", time:"19:00 UTC-6", team1:"South Africa", team2:"South Korea", group:"Group A", ground:"Monterrey (Guadalupe)"},
    {round:"Matchday 2", date:"2026-06-12", time:"15:00 UTC-4", team1:"Canada", team2:"Bosnia & Herzegovina", group:"Group B", ground:"Toronto"},
    {round:"Matchday 3", date:"2026-06-13", time:"12:00 UTC-7", team1:"Qatar", team2:"Switzerland", group:"Group B", ground:"San Francisco Bay Area (Santa Clara)"},
    {round:"Matchday 8", date:"2026-06-18", time:"12:00 UTC-7", team1:"Switzerland", team2:"Bosnia & Herzegovina", group:"Group B", ground:"Los Angeles (Inglewood)"},
    {round:"Matchday 8", date:"2026-06-18", time:"15:00 UTC-7", team1:"Canada", team2:"Qatar", group:"Group B", ground:"Vancouver"},
    {round:"Matchday 14", date:"2026-06-24", time:"12:00 UTC-7", team1:"Switzerland", team2:"Canada", group:"Group B", ground:"Vancouver"},
    {round:"Matchday 14", date:"2026-06-24", time:"12:00 UTC-7", team1:"Bosnia & Herzegovina", team2:"Qatar", group:"Group B", ground:"Seattle"},
    {round:"Matchday 3", date:"2026-06-13", time:"18:00 UTC-4", team1:"Brazil", team2:"Morocco", group:"Group C", ground:"New York/New Jersey (East Rutherford)"},
    {round:"Matchday 3", date:"2026-06-13", time:"21:00 UTC-4", team1:"Haiti", team2:"Scotland", group:"Group C", ground:"Boston (Foxborough)"},
    {round:"Matchday 9", date:"2026-06-19", time:"18:00 UTC-4", team1:"Scotland", team2:"Morocco", group:"Group C", ground:"Boston (Foxborough)"},
    {round:"Matchday 9", date:"2026-06-19", time:"20:30 UTC-4", team1:"Brazil", team2:"Haiti", group:"Group C", ground:"Philadelphia"},
    {round:"Matchday 14", date:"2026-06-24", time:"18:00 UTC-4", team1:"Scotland", team2:"Brazil", group:"Group C", ground:"Miami (Miami Gardens)"},
    {round:"Matchday 14", date:"2026-06-24", time:"18:00 UTC-4", team1:"Morocco", team2:"Haiti", group:"Group C", ground:"Atlanta"},
    {round:"Matchday 2", date:"2026-06-12", time:"18:00 UTC-7", team1:"USA", team2:"Paraguay", group:"Group D", ground:"Los Angeles (Inglewood)"},
    {round:"Matchday 3", date:"2026-06-13", time:"21:00 UTC-7", team1:"Australia", team2:"Turkey", group:"Group D", ground:"Vancouver"},
    {round:"Matchday 9", date:"2026-06-19", time:"12:00 UTC-7", team1:"USA", team2:"Australia", group:"Group D", ground:"Seattle"},
    {round:"Matchday 9", date:"2026-06-19", time:"20:00 UTC-7", team1:"Turkey", team2:"Paraguay", group:"Group D", ground:"San Francisco Bay Area (Santa Clara)"},
    {round:"Matchday 15", date:"2026-06-25", time:"19:00 UTC-7", team1:"Turkey", team2:"USA", group:"Group D", ground:"Los Angeles (Inglewood)"},
    {round:"Matchday 15", date:"2026-06-25", time:"19:00 UTC-7", team1:"Paraguay", team2:"Australia", group:"Group D", ground:"San Francisco Bay Area (Santa Clara)"},
    {round:"Matchday 4", date:"2026-06-14", time:"12:00 UTC-5", team1:"Germany", team2:"Curaçao", group:"Group E", ground:"Houston"},
    {round:"Matchday 4", date:"2026-06-14", time:"19:00 UTC-4", team1:"Ivory Coast", team2:"Ecuador", group:"Group E", ground:"Philadelphia"},
    {round:"Matchday 10", date:"2026-06-20", time:"16:00 UTC-4", team1:"Germany", team2:"Ivory Coast", group:"Group E", ground:"Toronto"},
    {round:"Matchday 10", date:"2026-06-20", time:"19:00 UTC-5", team1:"Ecuador", team2:"Curaçao", group:"Group E", ground:"Kansas City"},
    {round:"Matchday 15", date:"2026-06-25", time:"16:00 UTC-4", team1:"Curaçao", team2:"Ivory Coast", group:"Group E", ground:"Philadelphia"},
    {round:"Matchday 15", date:"2026-06-25", time:"16:00 UTC-4", team1:"Ecuador", team2:"Germany", group:"Group E", ground:"New York/New Jersey (East Rutherford)"},
    {round:"Matchday 4", date:"2026-06-14", time:"15:00 UTC-5", team1:"Netherlands", team2:"Japan", group:"Group F", ground:"Dallas (Arlington)"},
    {round:"Matchday 4", date:"2026-06-14", time:"20:00 UTC-6", team1:"Sweden", team2:"Tunisia", group:"Group F", ground:"Monterrey (Guadalupe)"},
    {round:"Matchday 10", date:"2026-06-20", time:"12:00 UTC-5", team1:"Netherlands", team2:"Sweden", group:"Group F", ground:"Houston"},
    {round:"Matchday 10", date:"2026-06-20", time:"22:00 UTC-6", team1:"Tunisia", team2:"Japan", group:"Group F", ground:"Monterrey (Guadalupe)"},
    {round:"Matchday 15", date:"2026-06-25", time:"18:00 UTC-5", team1:"Japan", team2:"Sweden", group:"Group F", ground:"Dallas (Arlington)"},
    {round:"Matchday 15", date:"2026-06-25", time:"18:00 UTC-5", team1:"Tunisia", team2:"Netherlands", group:"Group F", ground:"Kansas City"},
    {round:"Matchday 5", date:"2026-06-15", time:"12:00 UTC-7", team1:"Belgium", team2:"Egypt", group:"Group G", ground:"Seattle"},
    {round:"Matchday 5", date:"2026-06-15", time:"18:00 UTC-7", team1:"Iran", team2:"New Zealand", group:"Group G", ground:"Los Angeles (Inglewood)"},
    {round:"Matchday 11", date:"2026-06-21", time:"12:00 UTC-7", team1:"Belgium", team2:"Iran", group:"Group G", ground:"Los Angeles (Inglewood)"},
    {round:"Matchday 11", date:"2026-06-21", time:"18:00 UTC-7", team1:"New Zealand", team2:"Egypt", group:"Group G", ground:"Vancouver"},
    {round:"Matchday 16", date:"2026-06-26", time:"20:00 UTC-7", team1:"Egypt", team2:"Iran", group:"Group G", ground:"Seattle"},
    {round:"Matchday 16", date:"2026-06-26", time:"20:00 UTC-7", team1:"New Zealand", team2:"Belgium", group:"Group G", ground:"Vancouver"},
    {round:"Matchday 5", date:"2026-06-15", time:"12:00 UTC-4", team1:"Spain", team2:"Cape Verde", group:"Group H", ground:"Atlanta"},
    {round:"Matchday 5", date:"2026-06-15", time:"18:00 UTC-4", team1:"Saudi Arabia", team2:"Uruguay", group:"Group H", ground:"Miami (Miami Gardens)"},
    {round:"Matchday 11", date:"2026-06-21", time:"12:00 UTC-4", team1:"Spain", team2:"Saudi Arabia", group:"Group H", ground:"Atlanta"},
    {round:"Matchday 11", date:"2026-06-21", time:"18:00 UTC-4", team1:"Uruguay", team2:"Cape Verde", group:"Group H", ground:"Miami (Miami Gardens)"},
    {round:"Matchday 16", date:"2026-06-26", time:"19:00 UTC-5", team1:"Cape Verde", team2:"Saudi Arabia", group:"Group H", ground:"Houston"},
    {round:"Matchday 16", date:"2026-06-26", time:"18:00 UTC-6", team1:"Uruguay", team2:"Spain", group:"Group H", ground:"Guadalajara (Zapopan)"},
    {round:"Matchday 6", date:"2026-06-16", time:"15:00 UTC-4", team1:"France", team2:"Senegal", group:"Group I", ground:"New York/New Jersey (East Rutherford)"},
    {round:"Matchday 6", date:"2026-06-16", time:"18:00 UTC-4", team1:"Iraq", team2:"Norway", group:"Group I", ground:"Boston (Foxborough)"},
    {round:"Matchday 12", date:"2026-06-22", time:"17:00 UTC-4", team1:"France", team2:"Iraq", group:"Group I", ground:"Philadelphia"},
    {round:"Matchday 12", date:"2026-06-22", time:"20:00 UTC-4", team1:"Norway", team2:"Senegal", group:"Group I", ground:"New York/New Jersey (East Rutherford)"},
    {round:"Matchday 16", date:"2026-06-26", time:"15:00 UTC-4", team1:"Norway", team2:"France", group:"Group I", ground:"Boston (Foxborough)"},
    {round:"Matchday 16", date:"2026-06-26", time:"15:00 UTC-4", team1:"Senegal", team2:"Iraq", group:"Group I", ground:"Toronto"},
    {round:"Matchday 6", date:"2026-06-16", time:"20:00 UTC-5", team1:"Argentina", team2:"Algeria", group:"Group J", ground:"Kansas City"},
    {round:"Matchday 6", date:"2026-06-16", time:"21:00 UTC-7", team1:"Austria", team2:"Jordan", group:"Group J", ground:"San Francisco Bay Area (Santa Clara)"},
    {round:"Matchday 12", date:"2026-06-22", time:"12:00 UTC-5", team1:"Argentina", team2:"Austria", group:"Group J", ground:"Dallas (Arlington)"},
    {round:"Matchday 12", date:"2026-06-22", time:"20:00 UTC-7", team1:"Jordan", team2:"Algeria", group:"Group J", ground:"San Francisco Bay Area (Santa Clara)"},
    {round:"Matchday 17", date:"2026-06-27", time:"21:00 UTC-5", team1:"Algeria", team2:"Austria", group:"Group J", ground:"Kansas City"},
    {round:"Matchday 17", date:"2026-06-27", time:"21:00 UTC-5", team1:"Jordan", team2:"Argentina", group:"Group J", ground:"Dallas (Arlington)"},
    {round:"Matchday 7", date:"2026-06-17", time:"12:00 UTC-5", team1:"Portugal", team2:"DR Congo", group:"Group K", ground:"Houston"},
    {round:"Matchday 7", date:"2026-06-17", time:"20:00 UTC-6", team1:"Uzbekistan", team2:"Colombia", group:"Group K", ground:"Mexico City"},
    {round:"Matchday 13", date:"2026-06-23", time:"12:00 UTC-5", team1:"Portugal", team2:"Uzbekistan", group:"Group K", ground:"Houston"},
    {round:"Matchday 13", date:"2026-06-23", time:"20:00 UTC-6", team1:"Colombia", team2:"DR Congo", group:"Group K", ground:"Guadalajara (Zapopan)"},
    {round:"Matchday 17", date:"2026-06-27", time:"19:30 UTC-4", team1:"Colombia", team2:"Portugal", group:"Group K", ground:"Miami (Miami Gardens)"},
    {round:"Matchday 17", date:"2026-06-27", time:"19:30 UTC-4", team1:"DR Congo", team2:"Uzbekistan", group:"Group K", ground:"Atlanta"},
    {round:"Matchday 7", date:"2026-06-17", time:"15:00 UTC-5", team1:"England", team2:"Croatia", group:"Group L", ground:"Dallas (Arlington)"},
    {round:"Matchday 7", date:"2026-06-17", time:"19:00 UTC-4", team1:"Ghana", team2:"Panama", group:"Group L", ground:"Toronto"},
    {round:"Matchday 13", date:"2026-06-23", time:"16:00 UTC-4", team1:"England", team2:"Ghana", group:"Group L", ground:"Boston (Foxborough)"},
    {round:"Matchday 13", date:"2026-06-23", time:"19:00 UTC-4", team1:"Panama", team2:"Croatia", group:"Group L", ground:"Toronto"},
    {round:"Matchday 17", date:"2026-06-27", time:"17:00 UTC-4", team1:"Panama", team2:"England", group:"Group L", ground:"New York/New Jersey (East Rutherford)"},
    {round:"Matchday 17", date:"2026-06-27", time:"17:00 UTC-4", team1:"Croatia", team2:"Ghana", group:"Group L", ground:"Philadelphia"},
    {round:"Round of 32", num:73, date:"2026-06-28", time:"12:00 UTC-7", team1:"2A", team2:"2B", ground:"Los Angeles (Inglewood)"},
    {round:"Round of 32", num:74, date:"2026-06-29", time:"16:30 UTC-4", team1:"1E", team2:"3A/B/C/D/F", ground:"Boston (Foxborough)"},
    {round:"Round of 32", num:75, date:"2026-06-29", time:"19:00 UTC-6", team1:"1F", team2:"2C", ground:"Monterrey (Guadalupe)"},
    {round:"Round of 32", num:76, date:"2026-06-29", time:"12:00 UTC-5", team1:"1C", team2:"2F", ground:"Houston"},
    {round:"Round of 32", num:77, date:"2026-06-30", time:"17:00 UTC-4", team1:"1I", team2:"3C/D/F/G/H", ground:"New York/New Jersey (East Rutherford)"},
    {round:"Round of 32", num:78, date:"2026-06-30", time:"12:00 UTC-5", team1:"2E", team2:"2I", ground:"Dallas (Arlington)"},
    {round:"Round of 32", num:79, date:"2026-06-30", time:"19:00 UTC-6", team1:"1A", team2:"3C/E/F/H/I", ground:"Mexico City"},
    {round:"Round of 32", num:80, date:"2026-07-01", time:"12:00 UTC-4", team1:"1L", team2:"3E/H/I/J/K", ground:"Atlanta"},
    {round:"Round of 32", num:81, date:"2026-07-01", time:"17:00 UTC-7", team1:"1D", team2:"3B/E/F/I/J", ground:"San Francisco Bay Area (Santa Clara)"},
    {round:"Round of 32", num:82, date:"2026-07-01", time:"13:00 UTC-7", team1:"1G", team2:"3A/E/H/I/J", ground:"Seattle"},
    {round:"Round of 32", num:83, date:"2026-07-02", time:"19:00 UTC-4", team1:"2K", team2:"2L", ground:"Toronto"},
    {round:"Round of 32", num:84, date:"2026-07-02", time:"12:00 UTC-7", team1:"1H", team2:"2J", ground:"Los Angeles (Inglewood)"},
    {round:"Round of 32", num:85, date:"2026-07-02", time:"20:00 UTC-7", team1:"1B", team2:"3E/F/G/I/J", ground:"Vancouver"},
    {round:"Round of 32", num:86, date:"2026-07-03", time:"18:00 UTC-4", team1:"1J", team2:"2H", ground:"Miami (Miami Gardens)"},
    {round:"Round of 32", num:87, date:"2026-07-03", time:"20:30 UTC-5", team1:"1K", team2:"3D/E/I/J/L", ground:"Kansas City"},
    {round:"Round of 32", num:88, date:"2026-07-03", time:"13:00 UTC-5", team1:"2D", team2:"2G", ground:"Dallas (Arlington)"},
    {round:"Round of 16", num:89, date:"2026-07-04", time:"17:00 UTC-4", team1:"W74", team2:"W77", ground:"Philadelphia"},
    {round:"Round of 16", num:90, date:"2026-07-04", time:"12:00 UTC-5", team1:"W73", team2:"W75", ground:"Houston"},
    {round:"Round of 16", num:91, date:"2026-07-05", time:"16:00 UTC-4", team1:"W76", team2:"W78", ground:"New York/New Jersey (East Rutherford)"},
    {round:"Round of 16", num:92, date:"2026-07-05", time:"18:00 UTC-6", team1:"W79", team2:"W80", ground:"Mexico City"},
    {round:"Round of 16", num:93, date:"2026-07-06", time:"14:00 UTC-5", team1:"W83", team2:"W84", ground:"Dallas (Arlington)"},
    {round:"Round of 16", num:94, date:"2026-07-06", time:"17:00 UTC-7", team1:"W81", team2:"W82", ground:"Seattle"},
    {round:"Round of 16", num:95, date:"2026-07-07", time:"12:00 UTC-4", team1:"W86", team2:"W88", ground:"Atlanta"},
    {round:"Round of 16", num:96, date:"2026-07-07", time:"13:00 UTC-7", team1:"W85", team2:"W87", ground:"Vancouver"},
    {round:"Quarter-final", num:97, date:"2026-07-09", time:"16:00 UTC-4", team1:"W89", team2:"W90", ground:"Boston (Foxborough)"},
    {round:"Quarter-final", num:98, date:"2026-07-10", time:"12:00 UTC-7", team1:"W93", team2:"W94", ground:"Los Angeles (Inglewood)"},
    {round:"Quarter-final", num:99, date:"2026-07-11", time:"17:00 UTC-4", team1:"W91", team2:"W92", ground:"Miami (Miami Gardens)"},
    {round:"Quarter-final", num:100, date:"2026-07-11", time:"20:00 UTC-5", team1:"W95", team2:"W96", ground:"Kansas City"},
    {round:"Semi-final", num:101, date:"2026-07-14", time:"14:00 UTC-5", team1:"W97", team2:"W98", ground:"Dallas (Arlington)"},
    {round:"Semi-final", num:102, date:"2026-07-15", time:"15:00 UTC-4", team1:"W99", team2:"W100", ground:"Atlanta"},
    {round:"Match for third place", date:"2026-07-18", time:"17:00 UTC-4", team1:"L101", team2:"L102", ground:"Miami (Miami Gardens)"},
    {round:"Final", date:"2026-07-19", time:"15:00 UTC-4", team1:"W101", team2:"W102", ground:"New York/New Jersey (East Rutherford)"},
  ];

  // ===========================================================
  //  CONFIG
  // ===========================================================
  var TOURNAMENT_START = parseMatchInstant('2026-06-11', '13:00 UTC-6'); // opening kickoff
  var TOURNAMENT_END   = parseMatchInstant('2026-07-19', '15:00 UTC-4'); // final kickoff
  // Optional: plug a football-data.org key here to pull live data (see README).
  // We don't ship one — when LIVE_API_KEY is empty the app falls back to the
  // deterministic mock results below.
  var LIVE_API_KEY = '';

  // Deterministic mock results so live mode renders something convincing
  // when no API key is configured. Keyed by match index in MATCHES.
  // Group-stage matches only (indices 0..71); knockouts derive from these.
  var MOCK_GROUP_RESULTS = (function () {
    // Plausible scoreline per match — manually curated, indexed by MATCHES idx
    // for the 72 group-stage games.
    var s = [
      [2,0],[1,1],[0,2],[2,1],[1,0],[1,1],   // Group A (6)
      [1,0],[1,2],[0,1],[2,1],[1,2],[1,1],   // Group B
      [3,0],[1,2],[1,0],[4,0],[1,2],[2,0],   // Group C
      [2,1],[2,2],[3,1],[2,1],[1,2],[1,0],   // Group D
      [3,1],[0,2],[2,2],[1,3],[1,1],[1,2],   // Group E
      [2,1],[3,0],[1,1],[0,2],[2,1],[0,2],   // Group F
      [1,1],[2,0],[2,1],[1,1],[0,1],[0,2],   // Group G
      [3,1],[1,3],[2,0],[2,1],[0,2],[2,3],   // Group H
      [3,1],[1,2],[2,1],[0,1],[2,2],[1,2],   // Group I
      [3,0],[2,1],[2,2],[0,1],[0,3],[0,2],   // Group J
      [2,1],[0,2],[2,1],[1,1],[1,2],[1,2],   // Group K
      [3,2],[2,1],[2,0],[1,1],[1,3],[2,3],   // Group L
    ];
    return s;
  })();

  // ===========================================================
  //  STATE
  // ===========================================================
  var state = {
    screen:        'home',
    mode:          'auto',         // 'auto' | 'pre' | 'live'
    menuIdx:       0,              // 0..3
    groupIdx:      0,              // 0..11
    groupTab:      'fixtures',     // 'fixtures' | 'standings'
    teamIdx:       0,              // index into TEAM_NAMES
    favoriteTeam:  null,           // string name
    bracketRound:  0,              // 0..5
    fixtureDay:    0,              // index into DAYS
    lastTeamFromDetail: false,
  };

  // ===========================================================
  //  DERIVED CONSTANTS
  // ===========================================================
  var TEAM_NAMES = Object.keys(TEAMS).sort();      // alphabetical
  var GROUP_FIXTURES = {};                          // 'A' -> [matches]
  var GROUP_TEAMS    = {};                          // 'A' -> [team names]
  MATCHES.forEach(function (m) {
    if (m.group) {
      var letter = m.group.replace('Group ', '');
      (GROUP_FIXTURES[letter] = GROUP_FIXTURES[letter] || []).push(m);
    }
  });
  Object.keys(TEAMS).forEach(function (n) {
    var g = TEAMS[n].group;
    (GROUP_TEAMS[g] = GROUP_TEAMS[g] || []).push(n);
  });

  var ROUNDS = [
    { label: 'R32',   matches: MATCHES.filter(function (m){ return m.round === 'Round of 32'; }) },
    { label: 'R16',   matches: MATCHES.filter(function (m){ return m.round === 'Round of 16'; }) },
    { label: 'QF',    matches: MATCHES.filter(function (m){ return m.round === 'Quarter-final'; }) },
    { label: 'SF',    matches: MATCHES.filter(function (m){ return m.round === 'Semi-final'; }) },
    { label: '3RD',   matches: MATCHES.filter(function (m){ return m.round === 'Match for third place'; }) },
    { label: 'FINAL', matches: MATCHES.filter(function (m){ return m.round === 'Final'; }) },
  ];

  // unique sorted match days
  var DAYS = (function () {
    var seen = {};
    MATCHES.forEach(function (m) { seen[m.date] = true; });
    return Object.keys(seen).sort();
  })();

  // ===========================================================
  //  TIME PARSING
  // ===========================================================
  function parseMatchInstant(dateStr, timeStr) {
    // "2026-06-11", "13:00 UTC-6"  →  Date in UTC
    var m = timeStr.match(/^(\d{2}):(\d{2})\s+UTC([+-]\d+)/);
    if (!m) return null;
    var h   = parseInt(m[1], 10);
    var min = parseInt(m[2], 10);
    var off = parseInt(m[3], 10);
    var p   = dateStr.split('-').map(Number);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2], h - off, min));
  }
  function localDayLabel(d) {
    var dn = ['SUN','MON','TUE','WED','THU','FRI','SAT'][d.getDay()];
    var mn = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][d.getMonth()];
    return dn + ' · ' + mn + ' ' + d.getDate();
  }
  function localTimeLabel(d) {
    var h = d.getHours();
    var m = d.getMinutes();
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }
  function shortGround(g) {
    return g.replace(/\s*\([^)]*\)/, '');
  }

  // ===========================================================
  //  MODE
  // ===========================================================
  function effectiveMode() {
    if (state.mode === 'pre' || state.mode === 'live') return state.mode;
    var now = new Date();
    return now >= TOURNAMENT_START ? 'live' : 'pre';
  }
  // When mode is force-set to 'live' (e.g. via ?state=live before kickoff),
  // pretend the clock sits mid-tournament so standings and scores populate
  // instead of being empty. 'auto' uses the wall clock.
  function clockRef() {
    if (state.mode === 'live') {
      // simulate ~9 days into the tournament — group stage mostly played
      return new Date(TOURNAMENT_START.getTime() + 9 * 86400000);
    }
    if (state.mode === 'pre') {
      return new Date(TOURNAMENT_START.getTime() - 86400000);
    }
    return new Date();
  }
  function isMatchLive(m) {
    if (effectiveMode() !== 'live') return false;
    var start = parseMatchInstant(m.date, m.time);
    if (!start) return false;
    var diff = clockRef() - start;
    return diff >= 0 && diff < 110 * 60 * 1000;
  }
  function isMatchPlayed(m) {
    if (effectiveMode() !== 'live') return false;
    var start = parseMatchInstant(m.date, m.time);
    if (!start) return false;
    return clockRef() - start > 110 * 60 * 1000;
  }
  function matchResult(m) {
    // returns [s1, s2] or null
    if (!m.group) return null;
    var idx = MATCHES.indexOf(m);
    if (idx < 0 || idx >= MOCK_GROUP_RESULTS.length) return null;
    return MOCK_GROUP_RESULTS[idx];
  }
  // group standings derived from mock results (only when live/played)
  function standingsFor(letter) {
    var teams = GROUP_TEAMS[letter].slice();
    var rows = {};
    teams.forEach(function (t) {
      rows[t] = { team: t, pld: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
    });
    var fixtures = GROUP_FIXTURES[letter] || [];
    fixtures.forEach(function (m) {
      if (!isMatchPlayed(m)) return;
      var sc = matchResult(m);
      if (!sc) return;
      var a = rows[m.team1], b = rows[m.team2];
      if (!a || !b) return;
      a.pld++; b.pld++;
      a.gf += sc[0]; a.ga += sc[1];
      b.gf += sc[1]; b.ga += sc[0];
      if (sc[0] > sc[1])      { a.w++; b.l++; a.pts += 3; }
      else if (sc[0] < sc[1]) { b.w++; a.l++; b.pts += 3; }
      else                    { a.d++; b.d++; a.pts++; b.pts++; }
    });
    return teams.map(function (t) { return rows[t]; }).sort(function (x, y) {
      if (y.pts !== x.pts) return y.pts - x.pts;
      if ((y.gf - y.ga) !== (x.gf - x.ga)) return (y.gf - y.ga) - (x.gf - x.ga);
      return y.gf - x.gf;
    });
  }

  // ===========================================================
  //  FAVORITE TEAM (localStorage)
  // ===========================================================
  var FAV_KEY = 'mdg_wc2026_fav_v1';
  function loadFav() {
    try { return localStorage.getItem(FAV_KEY); } catch (e) { return null; }
  }
  function saveFav(name) {
    try {
      if (name) localStorage.setItem(FAV_KEY, name);
      else      localStorage.removeItem(FAV_KEY);
    } catch (e) { /* ignore */ }
  }

  // ===========================================================
  //  SCREEN SWITCHING
  // ===========================================================
  var SCREENS = ['home','groups','group','teams','team-detail','bracket','fixtures','match-live'];
  function showScreen(name) {
    state.screen = name;
    SCREENS.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.classList.toggle('hidden', id !== name);
    });
    if (name === 'home')         renderHome();
    if (name === 'groups')       renderGroups();
    if (name === 'group')        renderGroup();
    if (name === 'teams')        renderTeams();
    if (name === 'team-detail')  renderTeamDetail();
    if (name === 'bracket')      renderBracket();
    if (name === 'fixtures')     renderFixtures();
    if (name === 'match-live')   renderMatchLive();
  }

  // ===========================================================
  //  HOME
  // ===========================================================
  function renderHome() {
    var mode  = effectiveMode();
    var pill  = document.getElementById('mode-pill');
    var hero  = document.getElementById('home-hero');
    var eb    = document.getElementById('hero-eyebrow');
    var sub   = document.getElementById('hero-sub');
    var feat  = document.getElementById('feat-card');
    var fav   = state.favoriteTeam = loadFav();

    pill.classList.toggle('live', mode === 'live');
    pill.textContent = mode === 'live' ? 'LIVE' : 'COUNTDOWN';
    hero.classList.toggle('live', mode === 'live');

    // Pick the "featured match" for the home card:
    //   - if fav set → fav's next match
    //   - else if live → the next upcoming match overall
    //   - else → opening match
    var featured = null;
    var label = 'OPENING MATCH';
    if (fav) {
      featured = nextMatchFor(fav);
      label = '★ ' + (TEAMS[fav].code) + ' · NEXT MATCH';
    } else if (mode === 'live') {
      featured = nextUpcomingNamedMatch();
      label = 'NEXT KICKOFF';
    } else {
      featured = MATCHES[0]; // opening match
      label = 'OPENING MATCH';
    }

    feat.classList.toggle('fav', !!fav);
    feat.classList.toggle('live', mode === 'live' && !fav);
    document.getElementById('feat-label').textContent = label;

    if (featured) {
      paintFeaturedMatch(featured);
    }

    // Countdown target
    var target;
    if (fav && featured) {
      var inst = parseMatchInstant(featured.date, featured.time);
      target = inst || TOURNAMENT_START;
      eb.textContent = 'YOUR TEAM KICKS OFF IN';
    } else if (mode === 'live') {
      var nm = nextUpcomingNamedMatch();
      target = nm ? parseMatchInstant(nm.date, nm.time) : TOURNAMENT_END;
      eb.textContent = 'NEXT MATCH IN';
    } else {
      target = TOURNAMENT_START;
      eb.textContent = 'KICKS OFF IN';
    }
    paintCountdown(target);

    // sub-line under countdown
    if (featured) {
      var inst2 = parseMatchInstant(featured.date, featured.time);
      var loc   = inst2 ? (localDayLabel(inst2) + ' · ' + localTimeLabel(inst2)) : '';
      sub.textContent = loc + ' · ' + shortGround(featured.ground).toUpperCase();
    } else {
      sub.textContent = '';
    }

    // Focus the current menu tile
    applyMenuFocus();
  }

  function paintFeaturedMatch(m) {
    var t1 = TEAMS[m.team1], t2 = TEAMS[m.team2];
    document.getElementById('feat-flag-1').textContent = (t1 && t1.flag) || '⚽';
    document.getElementById('feat-flag-2').textContent = (t2 && t2.flag) || '⚽';
    document.getElementById('feat-code-1').textContent = (t1 && t1.code) || m.team1;
    document.getElementById('feat-code-2').textContent = (t2 && t2.code) || m.team2;
    var meta = (m.group ? m.group.toUpperCase() : m.round.toUpperCase()) +
               ' · ' + m.round.toUpperCase();
    document.getElementById('feat-meta').textContent = meta;
  }

  function paintCountdown(target) {
    var d = document.getElementById('cd-days');
    var h = document.getElementById('cd-hours');
    var mi = document.getElementById('cd-mins');
    if (!target) {
      d.textContent = '--'; h.textContent = '--'; mi.textContent = '--';
      return;
    }
    var diff = target - new Date();
    if (diff <= 0) {
      d.textContent = '00'; h.textContent = '00'; mi.textContent = '00';
      return;
    }
    var totalMin = Math.floor(diff / 60000);
    var days = Math.floor(totalMin / 1440);
    var hours = Math.floor((totalMin % 1440) / 60);
    var mins  = totalMin % 60;
    d.textContent = String(days);
    h.textContent = (hours < 10 ? '0' : '') + hours;
    mi.textContent = (mins  < 10 ? '0' : '') + mins;
  }

  function applyMenuFocus() {
    var tiles = document.querySelectorAll('#menu-grid .menu-tile');
    tiles.forEach(function (t, i) {
      if (i === state.menuIdx) try { t.focus(); } catch (e) {}
    });
  }

  function nextMatchFor(team) {
    var now = new Date();
    var list = MATCHES.filter(function (m) {
      return (m.team1 === team || m.team2 === team);
    });
    var future = list.filter(function (m) {
      var i = parseMatchInstant(m.date, m.time);
      return i && i > now;
    });
    if (future.length) return future[0];
    return list[0]; // before tournament: first group-stage game
  }

  function nextUpcomingNamedMatch() {
    var now = new Date();
    for (var i = 0; i < MATCHES.length; i++) {
      var m = MATCHES[i];
      if (!TEAMS[m.team1] || !TEAMS[m.team2]) continue;
      var inst = parseMatchInstant(m.date, m.time);
      if (inst && inst > now) return m;
    }
    return MATCHES[0];
  }

  // ===========================================================
  //  GROUPS — single-card carousel
  // ===========================================================
  function renderGroups() {
    var letter = GROUPS[state.groupIdx];
    document.getElementById('group-letter').textContent = letter;
    document.getElementById('group-count').textContent = letter + ' / L';

    var fav = state.favoriteTeam = loadFav();
    var rows = document.getElementById('group-rows');
    rows.innerHTML = '';
    var standings = standingsFor(letter);
    var played = standings.some(function (s) { return s.pld > 0; });
    standings.forEach(function (row, i) {
      var t = TEAMS[row.team];
      var div = document.createElement('div');
      div.className = 'group-row';
      if (fav && row.team === fav) div.classList.add('fav');
      if (played && i < 2) div.classList.add('advance');
      div.innerHTML =
        '<span class="gr-rank">' + (i + 1) + '</span>' +
        '<span class="gr-flag">' + t.flag + '</span>' +
        '<span class="gr-code mono">' + t.code + '</span>' +
        '<span class="gr-name">' + row.team + '</span>' +
        '<span class="gr-row-stats">' +
          (played
            ? '<span class="gr-pts">' + row.pts + '</span>'
            : '<span class="gr-pts" style="color:var(--text-4);font-size:11px;">—</span>') +
        '</span>';
      rows.appendChild(div);
    });

    var fixtures = GROUP_FIXTURES[letter] || [];
    var dates = fixtures.map(function (m){ return m.date; }).sort();
    var firstD = dates[0], lastD = dates[dates.length - 1];
    function shortDate(s) {
      var p = s.split('-').map(Number);
      var d = new Date(Date.UTC(p[0], p[1] - 1, p[2], 12));
      var mn = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][d.getMonth()];
      return mn + ' ' + d.getDate();
    }
    document.getElementById('group-foot').textContent =
      '6 MATCHES · ' + shortDate(firstD) + ' → ' + shortDate(lastD);

    // dots
    var dots = document.getElementById('group-dots');
    dots.innerHTML = '';
    GROUPS.forEach(function (g, i) {
      var d = document.createElement('i');
      d.className = 'dot' + (i === state.groupIdx ? ' on' : '');
      dots.appendChild(d);
    });
  }

  // ===========================================================
  //  GROUP DETAIL — fixtures / standings
  // ===========================================================
  function renderGroup() {
    var letter = GROUPS[state.groupIdx];
    document.getElementById('gd-letter').textContent = 'GROUP ' + letter;
    var tabs = document.querySelectorAll('#group .gd-tab');
    tabs.forEach(function (t) {
      t.classList.toggle('active', t.dataset.tab === state.groupTab);
    });
    document.getElementById('gd-count').textContent =
      state.groupTab === 'fixtures' ? '6 FIXTURES' : 'STANDINGS';

    var list = document.getElementById('gd-list');
    list.innerHTML = '';

    if (state.groupTab === 'fixtures') {
      var fixtures = GROUP_FIXTURES[letter] || [];
      fixtures.forEach(function (m) {
        list.appendChild(buildMatchRow(m, { showDay: true }));
      });
    } else {
      // standings table
      var standings = standingsFor(letter);
      var played    = standings.some(function (s) { return s.pld > 0; });
      var fav       = loadFav();
      standings.forEach(function (row, i) {
        var t = TEAMS[row.team];
        var div = document.createElement('div');
        div.className = 'group-row';
        if (fav && row.team === fav) div.classList.add('fav');
        if (played && i < 2)         div.classList.add('advance');
        div.innerHTML =
          '<span class="gr-rank">' + (i + 1) + '</span>' +
          '<span class="gr-flag">' + t.flag + '</span>' +
          '<span class="gr-code mono">' + t.code + '</span>' +
          '<span class="gr-name">' + row.team + '</span>' +
          '<span class="gr-row-stats">' +
            (played
              ? '<span class="gr-pts mono" style="font-size:10px;color:var(--text-3);">' + row.pld + 'P</span>' +
                '<span class="gr-pts mono" style="font-size:10px;color:var(--text-3);">' + (row.gf - row.ga >= 0 ? '+' : '') + (row.gf - row.ga) + '</span>' +
                '<span class="gr-pts">' + row.pts + '</span>'
              : '<span class="gr-pts" style="color:var(--text-4);font-size:11px;">—</span>') +
          '</span>';
        list.appendChild(div);
      });
    }
  }

  // ===========================================================
  //  MATCH ROW BUILDER (reused by group, team-detail, bracket, fixtures)
  // ===========================================================
  function buildMatchRow(m, opts) {
    opts = opts || {};
    var fav = loadFav();
    var div = document.createElement('div');
    div.className = 'match-row';
    var played = isMatchPlayed(m);
    var live   = isMatchLive(m);
    if (live)   div.classList.add('live');
    if (played) div.classList.add('played');
    if (fav && (m.team1 === fav || m.team2 === fav)) div.classList.add('fav');

    var inst = parseMatchInstant(m.date, m.time);
    var when = inst ? (
      '<span class="mr-day">' + (opts.showDay ? localDayLabel(inst).replace('·','') : 'KO') + '</span>' +
      '<span class="mr-time">' + localTimeLabel(inst) + '</span>'
    ) : '';

    var t1 = TEAMS[m.team1], t2 = TEAMS[m.team2];
    var left  = t1
      ? '<span class="mr-flag">' + t1.flag + '</span><span class="mr-code">' + t1.code + '</span>'
      : '<span class="mr-tag">' + m.team1 + '</span>';
    var right = t2
      ? '<span class="mr-flag">' + t2.flag + '</span><span class="mr-code">' + t2.code + '</span>'
      : '<span class="mr-tag">' + m.team2 + '</span>';

    var mid;
    var sc = matchResult(m);
    if ((played || live) && sc) {
      mid =
        '<div class="mr-score">' +
          '<span class="mr-score-num">' + sc[0] + '</span>' +
          '<span class="mr-score-sep">–</span>' +
          '<span class="mr-score-num">' + sc[1] + '</span>' +
        '</div>';
    } else {
      mid = '<span class="mr-vs">vs</span>';
    }

    div.innerHTML =
      '<div class="mr-when">' + when + '</div>' +
      '<div class="mr-team">' + left + '</div>' +
      mid +
      '<div class="mr-team right">' + right + '</div>';
    return div;
  }

  // ===========================================================
  //  TEAMS PICKER
  // ===========================================================
  function renderTeams() {
    var name = TEAM_NAMES[state.teamIdx];
    var t = TEAMS[name];
    var fav = loadFav();
    document.getElementById('team-flag').textContent = t.flag;
    document.getElementById('team-code').textContent = t.code;
    document.getElementById('team-name').textContent = name.toUpperCase();
    document.getElementById('team-group').textContent = 'GROUP ' + t.group;
    document.getElementById('team-count').textContent = (state.teamIdx + 1) + ' / ' + TEAM_NAMES.length;

    var card = document.getElementById('team-card');
    var fs   = document.getElementById('team-fav-state');
    if (fav === name) {
      card.classList.add('fav');
      fs.textContent = '★ FOLLOWING · ENTER TO UNFOLLOW';
    } else {
      card.classList.remove('fav');
      fs.textContent = 'PRESS ENTER · FOLLOW';
    }
  }

  // ===========================================================
  //  TEAM DETAIL
  // ===========================================================
  function renderTeamDetail() {
    var name = TEAM_NAMES[state.teamIdx];
    var t = TEAMS[name];
    var fav = loadFav();
    document.getElementById('td-title').textContent = name.toUpperCase();
    document.getElementById('td-flag').textContent = t.flag;
    document.getElementById('td-code').textContent = t.code;
    document.getElementById('td-group').textContent = 'GROUP ' + t.group;
    document.getElementById('td-fav').classList.toggle('hidden', fav !== name);

    // Find all matches involving this team. Group-stage are direct;
    // knockouts only appear if the team is mocked into them — for now we
    // only show their group-stage 3 matches (knockouts aren't deterministic
    // in mock mode).
    var ms = MATCHES.filter(function (m) {
      return m.team1 === name || m.team2 === name;
    });
    document.getElementById('td-count').textContent = ms.length + ' MATCHES';

    var list = document.getElementById('td-list');
    list.innerHTML = '';
    ms.forEach(function (m) {
      list.appendChild(buildMatchRow(m, { showDay: true }));
    });
  }

  // ===========================================================
  //  BRACKET
  // ===========================================================
  function renderBracket() {
    var r = ROUNDS[state.bracketRound];
    document.getElementById('bracket-round-name').textContent = r.label;
    var tabs = document.querySelectorAll('#round-tabs .round-tab');
    tabs.forEach(function (t, i) {
      t.classList.toggle('active', i === state.bracketRound);
    });
    var list = document.getElementById('bracket-list');
    list.innerHTML = '';
    r.matches.forEach(function (m) {
      list.appendChild(buildMatchRow(m, { showDay: true }));
    });
  }

  // ===========================================================
  //  FIXTURES — day by day
  // ===========================================================
  function renderFixtures() {
    var day = DAYS[state.fixtureDay];
    var inst = parseMatchInstant(day, '12:00 UTC+0');
    document.getElementById('fix-count').textContent =
      (state.fixtureDay + 1) + ' / ' + DAYS.length;
    document.getElementById('fix-day').textContent =
      (inst ? localDayLabel(inst) : day).toUpperCase();
    var dayMatches = MATCHES.filter(function (m) { return m.date === day; });
    var dayIndex = DAYS.indexOf(day);
    document.getElementById('fix-day-sub').textContent =
      'DAY ' + (dayIndex + 1) + ' · ' + dayMatches.length + ' MATCH' + (dayMatches.length === 1 ? '' : 'ES');
    var list = document.getElementById('fix-list');
    list.innerHTML = '';
    dayMatches.forEach(function (m) {
      list.appendChild(buildMatchRow(m, { showDay: false }));
    });
  }

  // ===========================================================
  //  LIVE MATCH (mock)
  // ===========================================================
  // tiny pool of plausible surnames per nation for synthesized event ticker
  var STAR_PLAYERS = {
    'Argentina':[ 'MESSI','ALVAREZ','LO CELSO','MAC ALLISTER' ],
    'Brazil':   [ 'VINICIUS','RODRYGO','RAPHINHA','NEYMAR' ],
    'France':   [ 'MBAPPÉ','GRIEZMANN','DEMBÉLÉ','THURAM' ],
    'England':  [ 'BELLINGHAM','KANE','SAKA','FODEN' ],
    'Spain':    [ 'YAMAL','RODRI','MORATA','OLMO' ],
    'Germany':  [ 'MUSIALA','WIRTZ','HAVERTZ','SANÉ' ],
    'Portugal': [ 'RONALDO','BERNARDO','LEÃO','FELIX' ],
    'Netherlands':['DEPAY','GAKPO','XAVI','REIJNDERS' ],
    'Belgium':  [ 'DE BRUYNE','LUKAKU','DOKU','TIELEMANS' ],
    'Croatia':  [ 'MODRIĆ','KOVAČIĆ','KRAMARIĆ','PERIŠIĆ' ],
    'USA':      [ 'PULISIC','MCKENNIE','REYNA','BALOGUN' ],
    'Mexico':   [ 'CHICHARITO','LOZANO','ANTUNA','ALVAREZ' ],
    'Morocco':  [ 'HAKIMI','ZIYECH','EN-NESYRI','OUNAHI' ],
    'Algeria':  [ 'MAHREZ','BENNACER','SLIMANI','BELAILI' ],
    'Japan':    [ 'KUBO','MITOMA','MINAMINO','ITO' ],
    'Senegal':  [ 'MANÉ','KOULIBALY','SARR','GUEYE' ],
    'Uruguay':  [ 'VALVERDE','NUÑEZ','PELLISTRI','ARAÚJO' ],
    'Colombia': [ 'JAMES','DÍAZ','BORJA','LERMA' ],
  };
  function eventsFor(m, sc, minute) {
    // synthesize a plausible scoring timeline from the result + current minute
    var goals = (sc[0] || 0) + (sc[1] || 0);
    if (goals === 0) return [{ minute:0, side:0, who:'NO GOALS YET' }];
    var entries = [];
    var slots = [];
    for (var i = 1; i <= goals; i++) slots.push(Math.floor((i / (goals + 1)) * Math.min(minute, 88)));
    // distribute scorers across home/away by score
    var side = 0;
    var lefts = sc[0], rights = sc[1];
    for (var j = 0; j < slots.length; j++) {
      if (lefts > 0 && rights > 0) side = (j % 2);
      else if (lefts > 0)          side = 0;
      else                         side = 1;
      if (side === 0) lefts--;
      else            rights--;
      var team = side === 0 ? m.team1 : m.team2;
      var pool = STAR_PLAYERS[team] || ['SCORER'];
      var who  = pool[j % pool.length];
      var code = (TEAMS[team] && TEAMS[team].code) || team;
      entries.push({ minute: slots[j] || (j + 1) * 7, side: side, who: who + ' · ' + code });
    }
    return entries.reverse(); // newest first
  }

  function renderMatchLive() {
    var fav  = loadFav();
    var live = MATCHES.filter(isMatchLive);
    var m = (fav && live.filter(function (x){ return x.team1===fav||x.team2===fav; })[0])
         || live[0]
         || (state.demoMatchIdx != null ? MATCHES[state.demoMatchIdx] : null)
         || nextUpcomingNamedMatch();
    if (!m) return;
    var t1 = TEAMS[m.team1], t2 = TEAMS[m.team2];
    document.getElementById('live-flag-1').textContent = (t1 && t1.flag) || '⚽';
    document.getElementById('live-flag-2').textContent = (t2 && t2.flag) || '⚽';
    document.getElementById('live-code-1').textContent = (t1 && t1.code) || m.team1;
    document.getElementById('live-code-2').textContent = (t2 && t2.code) || m.team2;
    var sc = matchResult(m) || [0, 0];
    document.getElementById('live-score').textContent = sc[0] + ' – ' + sc[1];

    var minute = 67;
    var inst = parseMatchInstant(m.date, m.time);
    if (inst) {
      var elapsed = Math.floor((clockRef() - inst) / 60000);
      if (elapsed >= 0 && elapsed <= 95) minute = elapsed;
    }
    document.getElementById('live-minute').textContent   = minute + "'";
    document.getElementById('live-minute-2').textContent = minute + "'";
    document.getElementById('live-bar-fill').style.width = Math.min(100, (minute / 90) * 100) + '%';
    document.getElementById('live-foot').textContent =
      (m.group ? m.group.toUpperCase() : m.round.toUpperCase()) +
      ' · ' + shortGround(m.ground).toUpperCase();

    // events list
    var ev = document.getElementById('live-events');
    ev.innerHTML = '';
    eventsFor(m, sc, minute).forEach(function (e) {
      var row = document.createElement('div');
      row.className = 'live-event';
      row.innerHTML =
        '<span class="le-time mono">' + (e.minute || 0) + "'</span>" +
        '<span class="le-icon">' + (e.who === 'NO GOALS YET' ? '·' : '⚽') + '</span>' +
        '<span class="le-text">' + e.who + '</span>';
      ev.appendChild(row);
    });
  }

  // ===========================================================
  //  KEY HANDLING
  // ===========================================================
  function onKey(e) {
    var k = e.key;
    if (state.screen === 'home') {
      // 2x2 grid:  0 1 / 2 3
      if (k === 'ArrowLeft')  { state.menuIdx = state.menuIdx ^ 1; applyMenuFocus(); e.preventDefault(); return; }
      if (k === 'ArrowRight') { state.menuIdx = state.menuIdx ^ 1; applyMenuFocus(); e.preventDefault(); return; }
      if (k === 'ArrowUp')    { state.menuIdx = state.menuIdx % 2; applyMenuFocus(); e.preventDefault(); return; }
      if (k === 'ArrowDown')  { state.menuIdx = (state.menuIdx % 2) + 2; applyMenuFocus(); e.preventDefault(); return; }
      if (k === 'Enter' || k === ' ') {
        var dest = ['groups','teams','bracket','fixtures'][state.menuIdx];
        showScreen(dest);
        e.preventDefault();
      }
      return;
    }

    if (state.screen === 'groups') {
      if (k === 'ArrowLeft')  { state.groupIdx = (state.groupIdx - 1 + GROUPS.length) % GROUPS.length; renderGroups(); e.preventDefault(); return; }
      if (k === 'ArrowRight') { state.groupIdx = (state.groupIdx + 1) % GROUPS.length; renderGroups(); e.preventDefault(); return; }
      if (k === 'ArrowUp')    { showScreen('home'); e.preventDefault(); return; }
      if (k === 'Enter' || k === ' ') { state.groupTab = 'fixtures'; showScreen('group'); e.preventDefault(); return; }
      return;
    }

    if (state.screen === 'group') {
      if (k === 'ArrowLeft')  { state.groupIdx = (state.groupIdx - 1 + GROUPS.length) % GROUPS.length; renderGroup(); e.preventDefault(); return; }
      if (k === 'ArrowRight') { state.groupIdx = (state.groupIdx + 1) % GROUPS.length; renderGroup(); e.preventDefault(); return; }
      if (k === 'ArrowUp')    { state.groupTab = 'fixtures';  renderGroup(); e.preventDefault(); return; }
      if (k === 'ArrowDown')  { state.groupTab = 'standings'; renderGroup(); e.preventDefault(); return; }
      if (k === 'Enter' || k === ' ') { showScreen('groups'); e.preventDefault(); return; }
      return;
    }

    if (state.screen === 'teams') {
      if (k === 'ArrowLeft')  { state.teamIdx = (state.teamIdx - 1 + TEAM_NAMES.length) % TEAM_NAMES.length; renderTeams(); e.preventDefault(); return; }
      if (k === 'ArrowRight') { state.teamIdx = (state.teamIdx + 1) % TEAM_NAMES.length; renderTeams(); e.preventDefault(); return; }
      if (k === 'ArrowUp')    {
        // jump to next group's first team
        var here = TEAMS[TEAM_NAMES[state.teamIdx]].group;
        var idx = GROUPS.indexOf(here);
        var nextG = GROUPS[(idx + 1) % GROUPS.length];
        var firstIdx = TEAM_NAMES.findIndex(function (n){ return TEAMS[n].group === nextG; });
        if (firstIdx >= 0) state.teamIdx = firstIdx;
        renderTeams(); e.preventDefault(); return;
      }
      if (k === 'ArrowDown')  { showScreen('team-detail'); e.preventDefault(); return; }
      if (k === 'Enter' || k === ' ') {
        var name = TEAM_NAMES[state.teamIdx];
        var cur = loadFav();
        saveFav(cur === name ? null : name);
        state.favoriteTeam = loadFav();
        renderTeams();
        e.preventDefault();
        return;
      }
      // Pressing Escape (browser dev only) returns home; we don't document it.
      return;
    }

    if (state.screen === 'team-detail') {
      if (k === 'ArrowLeft')  { state.teamIdx = (state.teamIdx - 1 + TEAM_NAMES.length) % TEAM_NAMES.length; renderTeamDetail(); e.preventDefault(); return; }
      if (k === 'ArrowRight') { state.teamIdx = (state.teamIdx + 1) % TEAM_NAMES.length; renderTeamDetail(); e.preventDefault(); return; }
      if (k === 'ArrowUp')    { showScreen('teams'); e.preventDefault(); return; }
      if (k === 'Enter' || k === ' ') {
        var name2 = TEAM_NAMES[state.teamIdx];
        var cur2 = loadFav();
        saveFav(cur2 === name2 ? null : name2);
        state.favoriteTeam = loadFav();
        renderTeamDetail(); e.preventDefault(); return;
      }
      return;
    }

    if (state.screen === 'bracket') {
      if (k === 'ArrowLeft')  { state.bracketRound = (state.bracketRound - 1 + ROUNDS.length) % ROUNDS.length; renderBracket(); e.preventDefault(); return; }
      if (k === 'ArrowRight') { state.bracketRound = (state.bracketRound + 1) % ROUNDS.length; renderBracket(); e.preventDefault(); return; }
      if (k === 'ArrowUp')    { var l = document.getElementById('bracket-list'); l.scrollTop -= 60; e.preventDefault(); return; }
      if (k === 'ArrowDown')  { var l2 = document.getElementById('bracket-list'); l2.scrollTop += 60; e.preventDefault(); return; }
      if (k === 'Enter' || k === ' ') { showScreen('home'); e.preventDefault(); return; }
      return;
    }

    if (state.screen === 'fixtures') {
      if (k === 'ArrowLeft')  { state.fixtureDay = (state.fixtureDay - 1 + DAYS.length) % DAYS.length; renderFixtures(); e.preventDefault(); return; }
      if (k === 'ArrowRight') { state.fixtureDay = (state.fixtureDay + 1) % DAYS.length; renderFixtures(); e.preventDefault(); return; }
      if (k === 'ArrowUp')    { state.fixtureDay = Math.max(0, state.fixtureDay - 7); renderFixtures(); e.preventDefault(); return; }
      if (k === 'ArrowDown')  { state.fixtureDay = Math.min(DAYS.length - 1, state.fixtureDay + 7); renderFixtures(); e.preventDefault(); return; }
      if (k === 'Enter' || k === ' ') { showScreen('home'); e.preventDefault(); return; }
      return;
    }

    if (state.screen === 'match-live') {
      if (k === 'Enter' || k === ' ' || k === 'ArrowUp' || k === 'ArrowDown') {
        showScreen('home');
        e.preventDefault();
        return;
      }
      return;
    }
  }

  // ===========================================================
  //  TOUCH SWIPE — mirrors arrow keys
  // ===========================================================
  function setupSwipe() {
    var SWIPE_MIN = 30;
    var sx = 0, sy = 0, tracking = false;
    function down(e) {
      var p = e.touches ? e.touches[0] : e;
      sx = p.clientX; sy = p.clientY;
      tracking = true;
    }
    function up(e) {
      if (!tracking) return;
      tracking = false;
      var p = (e.changedTouches && e.changedTouches[0]) || e;
      var dx = p.clientX - sx, dy = p.clientY - sy;
      var ax = Math.abs(dx), ay = Math.abs(dy);
      if (ax < SWIPE_MIN && ay < SWIPE_MIN) return;
      var key = (ay > ax)
        ? (dy < 0 ? 'ArrowUp' : 'ArrowDown')
        : (dx < 0 ? 'ArrowRight' : 'ArrowLeft');
      onKey({ key: key, preventDefault: function () {} });
    }
    document.addEventListener('touchstart', down, { passive: true });
    document.addEventListener('touchend',   up);
    document.addEventListener('mousedown',  down);
    document.addEventListener('mouseup',    up);
  }

  // ===========================================================
  //  POINTER FALLBACK
  // ===========================================================
  function onClick(e) {
    var t = e.target.closest('[data-menu]');
    if (t && state.screen === 'home') {
      state.menuIdx = parseInt(t.dataset.idx, 10);
      var dest = ['groups','teams','bracket','fixtures'][state.menuIdx];
      showScreen(dest);
      return;
    }
    var step = e.target.closest('[data-team-step]');
    if (step && state.screen === 'teams') {
      var dir = parseInt(step.dataset.teamStep, 10);
      state.teamIdx = (state.teamIdx + dir + TEAM_NAMES.length) % TEAM_NAMES.length;
      renderTeams();
      return;
    }
    var tab = e.target.closest('#group .gd-tab');
    if (tab && state.screen === 'group') {
      state.groupTab = tab.dataset.tab;
      renderGroup();
      return;
    }
    var rt = e.target.closest('#round-tabs .round-tab');
    if (rt && state.screen === 'bracket') {
      state.bracketRound = parseInt(rt.dataset.round, 10);
      renderBracket();
      return;
    }
  }

  // ===========================================================
  //  COUNTDOWN TICK
  // ===========================================================
  function tick() {
    if (state.screen === 'home') {
      // re-render to refresh countdown digits (every 30s is enough — minutes update)
      var fav = loadFav();
      var featured;
      if (fav) featured = nextMatchFor(fav);
      else if (effectiveMode() === 'live') featured = nextUpcomingNamedMatch();
      var target = featured ? parseMatchInstant(featured.date, featured.time) : TOURNAMENT_START;
      paintCountdown(target);
    }
    if (state.screen === 'match-live') {
      renderMatchLive(); // minute ticks
    }
  }

  // ===========================================================
  //  URL STATE (for screenshots / deep-linking)
  // ===========================================================
  function applyUrlState() {
    if (typeof URLSearchParams === 'undefined') return false;
    var p = new URLSearchParams(location.search);
    var s = p.get('state');
    if (!s) return false;

    if (s === 'pre')  state.mode = 'pre';
    if (s === 'live') state.mode = 'live';

    if (s === 'home' || s === 'pre') { showScreen('home'); return true; }
    if (s === 'home-fav')        { saveFav('Argentina'); showScreen('home'); return true; }
    if (s === 'home-live' || s === 'live') { state.mode = 'live'; showScreen('home'); return true; }
    if (s === 'group-fixtures')  { state.groupIdx = 2; state.groupTab = 'fixtures'; showScreen('group'); return true; }
    if (s.indexOf('groups-') === 0) {
      var letter = s.slice('groups-'.length).toUpperCase();
      var gi = GROUPS.indexOf(letter);
      if (gi >= 0) { state.groupIdx = gi; state.mode = 'live'; showScreen('groups'); return true; }
    }
    if (s.indexOf('group-') === 0) {
      var letter2 = s.slice('group-'.length).toUpperCase();
      var gi2 = GROUPS.indexOf(letter2);
      if (gi2 >= 0) { state.groupIdx = gi2; state.mode = 'live'; state.groupTab = 'standings'; showScreen('group'); return true; }
    }
    if (s === 'teams')          { state.teamIdx = TEAM_NAMES.indexOf('Argentina'); showScreen('teams'); return true; }
    if (s === 'team-fav')       { saveFav('Argentina'); state.teamIdx = TEAM_NAMES.indexOf('Argentina'); showScreen('team-detail'); return true; }
    if (s === 'team-detail')    { state.teamIdx = TEAM_NAMES.indexOf('Brazil'); showScreen('team-detail'); return true; }
    if (s === 'bracket-r32')    { state.bracketRound = 0; showScreen('bracket'); return true; }
    if (s === 'bracket-r16')    { state.bracketRound = 1; showScreen('bracket'); return true; }
    if (s === 'bracket-qf')     { state.bracketRound = 2; showScreen('bracket'); return true; }
    if (s === 'bracket-final')  { state.bracketRound = 5; showScreen('bracket'); return true; }
    if (s === 'fixtures')       { state.fixtureDay = 0; showScreen('fixtures'); return true; }
    if (s === 'fixtures-day3')  { state.fixtureDay = 2; showScreen('fixtures'); return true; }
    if (s === 'match-live') {
      // Pin to a marquee Group I match — France vs Senegal, mocked 3-1 —
      // so the synthesized event ticker reads true to the displayed score.
      state.mode = 'live';
      saveFav('France');
      state.demoMatchIdx = MATCHES.findIndex(function (m){
        return m.team1 === 'France' && m.team2 === 'Senegal';
      });
      showScreen('match-live'); return true;
    }
    return false;
  }

  // ===========================================================
  //  INIT
  // ===========================================================
  function init() {
    state.favoriteTeam = loadFav();
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick);
    setupSwipe();
    setInterval(tick, 30000);
    if (!applyUrlState()) showScreen('home');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
