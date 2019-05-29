var util = require('util'),
    path = require('path'),
    Monitor = require('../../'),
    script = path.join(__dirname, 'child.js');

const busybox = require('busybox');
const debug = busybox.debug;

const dm = debug('monitor');
const dm1 = debug('monitor1');
const dm2 = debug('monitor2');

debug.getState().setConfigs({
  debug: '*',
  useColors: false,        // false
  toFile: path.resolve(__dirname, 'monitor.out')
});
        
var monitor1 = new Monitor(script, {
  silent: true,
  env: {
    PORT: 8000
  }
});
monitor1.on('stdout', buf => {
  console.log(buf.toString());
  dm1(buf.toString());
});
monitor1.on('stderr', buf => {
  console.log(buf.toString());
  dm1(buf.toString());
});
monitor1.start();

var monitor2 = new Monitor(script, {
  silent: true,
  env: {
    PORT: 8000
  },
});
monitor2.on('stdout', buf => {
  console.log(buf.toString());
  dm2(buf.toString());
});
monitor2.on('stderr', buf => {
  console.log(buf.toString());
  dm2(buf.toString());
});
monitor2.start();

setInterval(() => {
  dm(new Error('error of monitor'));
}, 10 * 1000);
