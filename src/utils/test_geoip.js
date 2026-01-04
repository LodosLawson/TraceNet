
const geoip = require('geoip-lite');
const ip = '8.8.8.8';
const geo = geoip.lookup(ip);
console.log(JSON.stringify(geo, null, 2));
