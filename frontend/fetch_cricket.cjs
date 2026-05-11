const https = require('https');
const fs = require('fs');

const keyMatch = fs.readFileSync('src/utils/apiData.js', 'utf8').match(/CRICKET_API_KEY = "([^"]+)"/);
const key = keyMatch[1];

https.get("https://api.cricapi.com/v1/currentMatches?apikey=" + key + "&offset=0", res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const parsed = JSON.parse(data);
    if(parsed.data) {
        console.log(JSON.stringify(parsed.data.filter(m => m.name.includes("Chennai") || m.name.includes("CSK")), null, 2));
    }
  });
});
