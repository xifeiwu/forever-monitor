var util = require('util'),
    path = require('path'),
    Monitor = require('../../'),
    script = path.join(__dirname, 'server.js');
        
var monitor1 = new Monitor(script, {
  silent: false,
  env: {
    PORT: 8000
  }
});

monitor1.on('error', (err) => {
  console.log('err');
  console.log(err);
});
monitor1.on('start', (status) => {
  console.log('start');
  console.log(status);
});
monitor1.on('restart', (status) => {
  console.log('restart');
  console.log(status);
});
monitor1.on('child:exit', (code, signal, status) => {
  console.log('child:exit');
  console.log(code, signal);
  console.log(status);
});
monitor1.start();
console.log('start http://127.0.0.1:8000');

var monitor2 = new Monitor(script, {
  silent: false,
  env: {
    PORT: 8000
  },
  outFile: 'monitor2.log'
});          
monitor2.start();
console.log('start http://127.0.0.1:8001');

function showData() {
  setInterval(() => {
    console.log(child1.env);
  }, 2000);
}