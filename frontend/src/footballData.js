export const footballTeams = {
  ARS: { n: "Arsenal FC", c: "#E03A3E", l: "https://upload.wikimedia.org/wikipedia/en/thumb/5/53/Arsenal_FC.svg/330px-Arsenal_FC.svg.png" },
  CHE: { n: "Chelsea FC", c: "#034694", l: "https://upload.wikimedia.org/wikipedia/en/thumb/c/cc/Chelsea_FC.svg/330px-Chelsea_FC.svg.png" },
  MCI: { n: "Manchester City", c: "#6CABDD", l: "https://upload.wikimedia.org/wikipedia/en/thumb/e/eb/Manchester_City_FC_badge.svg/330px-Manchester_City_FC_badge.svg.png" },
  MUN: { n: "Manchester United", c: "#DA291C", l: "https://upload.wikimedia.org/wikipedia/en/thumb/7/7a/Manchester_United_FC_crest.svg/330px-Manchester_United_FC_crest.svg.png" },
  LIV: { n: "Liverpool FC", c: "#C8102E", l: "https://upload.wikimedia.org/wikipedia/en/thumb/0/0c/Liverpool_FC.svg/330px-Liverpool_FC.svg.png" },
  TOT: { n: "Tottenham Hotspur", c: "#132257", l: "https://upload.wikimedia.org/wikipedia/en/thumb/b/b4/Tottenham_Hotspur.svg/330px-Tottenham_Hotspur.svg.png" },
};

export const footballPtsData = [
  { t: 'MCI', p: 38, w: 28, d: 7, l: 3, gd: '+62', pt: 91 },
  { t: 'ARS', p: 38, w: 28, d: 5, l: 5, gd: '+62', pt: 89 },
  { t: 'LIV', p: 38, w: 24, d: 10, l: 4, gd: '+45', pt: 82 },
  { t: 'CHE', p: 38, w: 18, d: 9, l: 11, gd: '+14', pt: 63 },
  { t: 'TOT', p: 38, w: 20, d: 6, l: 12, gd: '+13', pt: 66 },
  { t: 'MUN', p: 38, w: 18, d: 6, l: 14, gd: '-1', pt: 60 },
];

export const footballScheduleData = [
  { id: 1, t1: 'ARS', t2: 'CHE', date: 'Aug 12', venue: 'Emirates Stadium', s: 'live', r: 'LIVE' },
  { id: 2, t1: 'MCI', t2: 'MUN', date: 'Aug 13', venue: 'Etihad Stadium', s: 'up', r: '4:30 PM GMT' },
  { id: 3, t1: 'LIV', t2: 'TOT', date: 'Aug 14', venue: 'Anfield', s: 'up', r: '8:00 PM GMT' },
];

export const footballLiveSequence = [
  { time: '12', team: 'CHE', type: 'foul', desc: 'Foul by Enzo Fernandez on Odegaard.' },
  { time: '24', team: 'ARS', type: 'shot', desc: 'Saka shoots from outside the box, narrowly misses the top corner.' },
  { time: '35', team: 'CHE', type: 'card', desc: 'Yellow card for Thiago Silva after a late tackle.', isYellow: true },
  { time: '44', team: 'ARS', type: 'goal', desc: 'GOAL! Martinelli finishes a beautiful team move.', isGoal: true },
  { time: '60', team: 'CHE', type: 'shot', desc: 'Sterling hits the post from close range!' },
  { time: '75', team: 'ARS', type: 'corner', desc: 'Arsenal win a corner after intense pressure.' },
  { time: '82', team: 'CHE', type: 'goal', desc: 'GOAL! Nkunku equalizes with a header from a cross.', isGoal: true },
  { time: '89', team: 'ARS', type: 'foul', desc: 'Dangerous free kick won by Jesus on the edge of the box.' },
  { time: '90+2', team: 'ARS', type: 'goal', desc: 'GOAL! Rice scores a dramatic late winner from the free kick rebound.', isGoal: true }
];

export const footballMatchContextInitial = {
  homeTeam: 'ARS',
  awayTeam: 'CHE',
  homeScore: 0,
  awayScore: 0,
  minute: '10',
  possession: { home: 55, away: 45 },
  xg: { home: 0.2, away: 0.1 },
  lastEvents: ['Kickoff', 'Arsenal dominating early possession']
};
