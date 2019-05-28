var util = require('util'),
    path = require('path'),
    Monitor = require('../../'),
    script = path.join(__dirname, 'child.js');
        
var monitor1 = new Monitor(script, {
  silent: false,
  env: {
    PORT: 8000
  }
});
monitor1.on('stdout', buf => {
  console.log(buf);
});
monitor1.on('stderr', buf => {
  console.log(buf);
});
monitor1.start();

var monitor2 = new Monitor(script, {
  silent: false,
  env: {
    PORT: 8000
  },
});
monitor2.on('stdout', buf => {
  console.log(buf);
});
monitor2.on('stderr', buf => {
  console.log(buf);
});
monitor2.start();
