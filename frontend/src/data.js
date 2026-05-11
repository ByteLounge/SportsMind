export const teams = {
  MI: { n: "Mumbai Indians", c: "#004BA0", l: "https://upload.wikimedia.org/wikipedia/en/thumb/c/cd/Mumbai_Indians_Logo.svg/330px-Mumbai_Indians_Logo.svg.png" },
  CSK: { n: "Chennai Super Kings", c: "#F7A721", l: "https://upload.wikimedia.org/wikipedia/en/thumb/2/2b/Chennai_Super_Kings_Logo.svg/330px-Chennai_Super_Kings_Logo.svg.png" },
  RCB: { n: "Royal Challengers", c: "#EC1C24", l: "https://upload.wikimedia.org/wikipedia/en/thumb/d/d4/Royal_Challengers_Bengaluru_Logo.svg/330px-Royal_Challengers_Bengaluru_Logo.svg.png" },
  KKR: { n: "Kolkata Knight Riders", c: "#3A225D", l: "https://upload.wikimedia.org/wikipedia/en/thumb/4/4c/Kolkata_Knight_Riders_Logo.svg/330px-Kolkata_Knight_Riders_Logo.svg.png" },
  DC: { n: "Delhi Capitals", c: "#0078BC", l: "https://upload.wikimedia.org/wikipedia/en/thumb/2/2f/Delhi_Capitals.svg/330px-Delhi_Capitals.svg.png" },
  RR: { n: "Rajasthan Royals", c: "#EA1A85", l: "https://upload.wikimedia.org/wikipedia/en/thumb/5/5c/This_is_the_logo_for_Rajasthan_Royals%2C_a_cricket_team_playing_in_the_Indian_Premier_League_%28IPL%29.svg/330px-This_is_the_logo_for_Rajasthan_Royals%2C_a_cricket_team_playing_in_the_Indian_Premier_League_%28IPL%29.svg.png" },
  PBKS: { n: "Punjab Kings", c: "#ED1B24", l: "https://upload.wikimedia.org/wikipedia/en/thumb/d/d4/Punjab_Kings_Logo.svg/330px-Punjab_Kings_Logo.svg.png" },
  SRH: { n: "Sunrisers Hyderabad", c: "#F7A721", l: "https://upload.wikimedia.org/wikipedia/en/thumb/5/51/Sunrisers_Hyderabad_Logo.svg/330px-Sunrisers_Hyderabad_Logo.svg.png" },
  LSG: { n: "Lucknow Super Giants", c: "#A72B2A", l: "https://upload.wikimedia.org/wikipedia/en/thumb/3/34/Lucknow_Super_Giants_Logo.svg/330px-Lucknow_Super_Giants_Logo.svg.png" },
  GT: { n: "Gujarat Titans", c: "#1C1C1C", l: "https://upload.wikimedia.org/wikipedia/en/thumb/0/09/Gujarat_Titans_Logo.svg/330px-Gujarat_Titans_Logo.svg.png" }
};

export const ptsData = [
  { t: 'SRH', p: 11, w: 7, l: 4, n: '+0.757', pt: 14 },
  { t: 'GT', p: 11, w: 7, l: 4, n: '+0.228', pt: 14 },
  { t: 'PBKS', p: 10, w: 6, l: 3, n: '+0.571', pt: 13 },
  { t: 'RCB', p: 10, w: 6, l: 4, n: '+1.234', pt: 12 },
  { t: 'RR', p: 11, w: 6, l: 5, n: '+0.082', pt: 12 },
  { t: 'CSK', p: 10, w: 5, l: 5, n: '+0.151', pt: 10 },
  { t: 'KKR', p: 10, w: 4, l: 5, n: '-0.169', pt: 9 },
  { t: 'DC', p: 11, w: 4, l: 7, n: '-1.154', pt: 8 },
  { t: 'MI', p: 10, w: 3, l: 7, n: '-0.642', pt: 6 },
  { t: 'LSG', p: 10, w: 3, l: 7, n: '-0.954', pt: 6 }
];

export const scheduleData = [
  { id: 1, t1: 'CSK', t2: 'KKR', date: 'Apr 5', venue: 'Chepauk, Chennai', s: 'done', r: 'CSK won by 8 wickets' },
  { id: 2, t1: 'MI', t2: 'SRH', date: 'Apr 6', venue: 'Wankhede, Mumbai', s: 'done', r: 'MI won by 23 runs' },
  { id: 3, t1: 'RCB', t2: 'RR', date: 'Apr 7', venue: 'Chinnaswamy, Bengaluru', s: 'done', r: 'RCB won by 5 wickets' },
  { id: 4, t1: 'DC', t2: 'GT', date: 'Apr 8', venue: 'Arun Jaitley, Delhi', s: 'done', r: 'GT won by 11 runs' },
  { id: 5, t1: 'PBKS', t2: 'LSG', date: 'Apr 9', venue: 'PCA, Mohali', s: 'done', r: 'LSG won by 7 wickets' },
  { id: 6, t1: 'KKR', t2: 'MI', date: 'Apr 11', venue: 'Eden Gardens, Kolkata', s: 'done', r: 'KKR won by 3 wickets' },
  { id: 7, t1: 'SRH', t2: 'CSK', date: 'Apr 12', venue: 'Rajiv Gandhi, Hyderabad', s: 'done', r: 'CSK won by 4 runs' },
  { id: 8, t1: 'RR', t2: 'DC', date: 'Apr 13', venue: 'Sawai Mansingh, Jaipur', s: 'done', r: 'RR won by 6 wickets' },
  { id: 9, t1: 'GT', t2: 'RCB', date: 'Apr 14', venue: 'Narendra Modi, Ahmedabad', s: 'done', r: 'RCB won by 18 runs' },
  { id: 10, t1: 'LSG', t2: 'PBKS', date: 'Apr 15', venue: 'Ekana, Lucknow', s: 'done', r: 'LSG won by 9 wickets' },
  { id: 11, t1: 'MI', t2: 'CSK', date: 'Apr 17', venue: 'Wankhede, Mumbai', s: 'done', r: 'MI won by 2 wickets' },
  { id: 12, t1: 'KKR', t2: 'RCB', date: 'Apr 18', venue: 'Eden Gardens, Kolkata', s: 'done', r: 'RCB won by 5 runs' },
  { id: 13, t1: 'SRH', t2: 'GT', date: 'Apr 19', venue: 'Rajiv Gandhi, Hyderabad', s: 'done', r: 'SRH won by 44 runs' },
  { id: 14, t1: 'MI', t2: 'RCB', date: 'May 10', venue: 'Wankhede, Mumbai', s: 'live', r: 'LIVE' },
  { id: 15, t1: 'CSK', t2: 'RR', date: 'May 11', venue: 'Chepauk, Chennai', s: 'up', r: '7:30 PM IST' },
  { id: 16, t1: 'KKR', t2: 'SRH', date: 'May 12', venue: 'Eden Gardens, Kolkata', s: 'up', r: '7:30 PM IST' },
  { id: 17, t1: 'GT', t2: 'PBKS', date: 'May 13', venue: 'Narendra Modi, Ahmedabad', s: 'up', r: '7:30 PM IST' },
  { id: 18, t1: 'LSG', t2: 'DC', date: 'May 14', venue: 'Ekana, Lucknow', s: 'up', r: '7:30 PM IST' },
  { id: 19, t1: 'MI', t2: 'KKR', date: 'May 15', venue: 'Wankhede, Mumbai', s: 'up', r: '7:30 PM IST' },
  { id: 20, t1: 'RCB', t2: 'CSK', date: 'May 16', venue: 'Chinnaswamy, Bengaluru', s: 'up', r: '7:30 PM IST' }
];

export const liveSequence = [
  { r: 1, type: 'run', desc: 'single to long on' },
  { r: 0, type: 'dot', desc: 'yorker blocked' },
  { r: 4, type: 'four', desc: 'driven through covers' },
  { r: 0, type: 'wicket', desc: 'Tim David caught at long off', isW: true },
  { r: 6, type: 'six', desc: 'Hardik slog sweep over midwicket' },
  { r: 0, type: 'dot', desc: 'slower ball' },
  { r: 6, type: 'six', desc: 'massive six over long on' },
  { r: 4, type: 'four', desc: 'inside edge races to fine leg' },
  { r: 2, type: 'run', desc: 'quick single, scramble for second' },
  { r: 6, type: 'six', desc: 'Hardik finishes it! MI win!' }
];

export const matchContextInitial = {
  target: 187,
  score: 156,
  wickets: 5,
  overs: 18,
  balls: 2, // 18.2
  p1: { name: 'Hardik Pandya', runs: 45, b: 28 },
  p2: { name: 'Tim David', runs: 18, b: 9 },
  bowler: { name: 'Mohammed Siraj', w: 2, r: 32, o: 3, b: 2 },
  last6: ['W', '1', '4', '0', '6', '2']
};
