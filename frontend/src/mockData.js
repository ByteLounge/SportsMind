export const mockData = {
  cricket: {
    name: 'Cricket',
    color: '#00B894',
    match: {
      team1: { name: 'Mumbai Indians', short: 'MI', color: '#004BA0', score: '156/5', overs: '18.2' },
      team2: { name: 'Royal Challengers', short: 'RCB', color: '#EC1C24' },
      status: 'Need 31 off 10',
      batsmen: [
        { name: 'Hardik Pandya', runs: 45, balls: 28 },
        { name: 'Tim David', runs: 18, balls: 9 }
      ],
      bowler: { name: 'Mohammed Siraj', overs: '3.2', runs: 32, wickets: 2 }
    },
    news: [
      "Rohit Sharma's retirement sparks succession debate — Who leads India next?",
      "IPL 2026: Top 5 performers of the season so far — Kohli leads the charts",
      "MI's death bowling woes — Can Bumrah carry them alone?",
      "RCB's batting lineup: Most explosive top 3 in IPL history?",
      "Women's IPL 2026: Mumbai Indians W dominate group stage",
      "BCCI confirms IPL 2027 will have 12 teams — two new franchises announced"
    ],
    players: [
      { name: 'Virat Kohli', team: 'RCB', role: 'Batter', stats: '482 runs', form: 'Hot' },
      { name: 'Jasprit Bumrah', team: 'MI', role: 'Bowler', stats: '14 wkts', form: 'Hot' },
      { name: 'Hardik Pandya', team: 'MI', role: 'All-rounder', stats: '210 runs, 6 wkts', form: 'Average' }
    ]
  },
  football: {
    name: 'Football',
    color: '#0066FF',
    match: {
      team1: { name: 'Manchester City', short: 'MCI', color: '#6CABDD', score: '1' },
      team2: { name: 'Arsenal', short: 'ARS', color: '#EF0107', score: '1' },
      status: "67'",
      events: ["Yellow card Rodri 45'", "Goal Saka 51'", "Sub Martinelli on 60'"],
      stats: { possession: '58% - 42%', shots: '5 - 3', corners: '4 - 2' }
    },
    news: [
      "Haaland breaks Premier League scoring record — 37 goals in a season",
      "Mbappé to City: What it means for Haaland's role — Pep has a selection headache",
      "Arsenal's title dream alive — Arteta: We believe until the last whistle",
      "Champions League semi-final preview: El Clasico at the Bernabeu — tactical breakdown",
      "VAR controversy: Three key decisions this weekend that changed results",
      "Premier League: Full fixture list for remaining GW35-38"
    ],
    players: [
      { name: 'Erling Haaland', team: 'MCI', role: 'Striker', stats: '37 goals', form: 'Hot' },
      { name: 'Bukayo Saka', team: 'ARS', role: 'Winger', stats: '14 goals, 11 ast', form: 'Hot' },
      { name: 'Kevin De Bruyne', team: 'MCI', role: 'Midfielder', stats: '18 ast', form: 'Average' }
    ]
  },
  basketball: {
    name: 'Basketball',
    color: '#FF6B00',
    match: {
      team1: { name: 'LA Lakers', short: 'LAL', color: '#552583', score: '98' },
      team2: { name: 'Boston Celtics', short: 'BOS', color: '#007A33', score: '102' },
      status: "Q4 2:34",
      quarters: "Q1: 28-24 | Q2: 22-26 | Q3: 24-28",
      stats: { topScorer1: 'LeBron 34pts', topScorer2: 'Tatum 28pts' }
    },
    news: [
      "LeBron James: One win away from his 5th championship ring",
      "Celtics' defensive scheme dissected — How Brown is shutting down Davis",
      "NBA Finals ratings: Highest since 2016 — 28 million viewers for Game 5",
      "Off-season trades: Every team's biggest need heading into free agency"
    ],
    players: [
      { name: 'LeBron James', team: 'LAL', role: 'Forward', stats: '28.4 ppg', form: 'Hot' },
      { name: 'Jayson Tatum', team: 'BOS', role: 'Forward', stats: '26.8 ppg', form: 'Hot' },
      { name: 'Anthony Davis', team: 'LAL', role: 'Center', stats: '12.4 rpg', form: 'Average' }
    ]
  },
  tennis: {
    name: 'Tennis',
    color: '#FFD700',
    match: {
      team1: { name: 'Carlos Alcaraz', short: 'CA', color: '#FFD700', score: '6 3 4' },
      team2: { name: 'Novak Djokovic', short: 'ND', color: '#0066FF', score: '4 6 3' },
      status: "3rd Set - 30-40 Break Point",
      stats: { aces: '8 - 4', unforced: '24 - 19', serveSpeed: '196 km/h' }
    },
    news: [
      "Alcaraz vs Djokovic: The rivalry that defines a generation — stat breakdown",
      "French Open women's semi-finals: Swiatek faces surprise qualifier",
      "Wimbledon wildcard list confirmed — 5 players to watch on grass",
      "ATP rankings after Roland Garros: Sinner holds No.1 despite early exit"
    ],
    players: [
      { name: 'Carlos Alcaraz', team: 'ESP', role: 'Player', stats: '2 Slams', form: 'Hot' },
      { name: 'Novak Djokovic', team: 'SRB', role: 'Player', stats: '24 Slams', form: 'Average' }
    ]
  },
  f1: {
    name: 'Formula 1',
    color: '#E8002D',
    match: {
      team1: { name: 'Max Verstappen', short: 'VER', color: '#0600EF', score: 'P1' },
      team2: { name: 'Charles Leclerc', short: 'LEC', color: '#DC0000', score: 'P2' },
      status: "Lap 52/78 (Safety Car IN)",
      stats: { gap: '+3.2s', fastestLap: 'Leclerc - 1:13.241' }
    },
    news: [
      "Leclerc's home race glory? Ferrari strategist reveals tyre plan for closing laps",
      "Verstappen's 100th podium: The stats that make him the greatest of his generation",
      "2026 regulation changes: How the new power unit rules will shake up the grid",
      "Hamilton to Ferrari — 6 months in: Has it worked? A midseason report card"
    ],
    players: [
      { name: 'Max Verstappen', team: 'Red Bull', role: 'Driver', stats: '98 pts', form: 'Hot' },
      { name: 'Charles Leclerc', team: 'Ferrari', role: 'Driver', stats: '84 pts', form: 'Hot' }
    ]
  },
  hockey: {
    name: 'Hockey',
    color: '#00CC66',
    match: {
      team1: { name: 'India', short: 'IND', color: '#FF9933', score: '2' },
      team2: { name: 'Australia', short: 'AUS', color: '#00843D', score: '1' },
      status: "Q3 - 32'",
      stats: { goals: "Harmanpreet 14', Mandeep 28' | Craig 21'" }
    },
    news: [
      "India's Pro League campaign: Harmanpreet leading from the front",
      "Paris Olympics 2024 hangover gone — India eye back-to-back gold",
      "Australia's defensive crisis: Three key players injured ahead of crucial stretch"
    ],
    players: [
      { name: 'Harmanpreet Singh', team: 'IND', role: 'Defender', stats: '8 goals', form: 'Hot' }
    ]
  }
};

export const globalNews = [
  { title: "BREAKING: Virat Kohli scores century in IPL 2026 qualifier — RCB beat MI in thriller", url: "#", source: { name: "SportsMind AI" } },
  { title: "TRANSFER: Kylian Mbappé completes move to Premier League — Manchester City confirm signing", url: "#", source: { name: "FootyNews" } },
  { title: "NBA FINALS: LeBron James leads Lakers to Game 7 victory — Series tied 3-3", url: "#", source: { name: "HoopsHub" } },
  { title: "WIMBLEDON: Jannik Sinner retains world No.1 ranking after French Open victory", url: "#", source: { name: "TennisPro" } },
  { title: "F1: Max Verstappen dominates Monaco GP — Red Bull 1-2 finish", url: "#", source: { name: "FastTrack" } }
];
