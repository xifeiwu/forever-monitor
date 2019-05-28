var util = require('util'),
    http = require('http');

var port = process.env.PORT || 3005;

const server = http.createServer(function (req, res) {
  console.log(req.method + ' request: ' + req.url);
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.write('hello, i know nodejitsu.');
  res.end();
}).listen(port);

server.on('error', err => {
  console.log(err);
})
/* server started */
console.log(`http://127.0.0.1:${port}`);

// process.on('uncaughtException', err => {
//   console.log(err);
// });