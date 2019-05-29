const path = require('path');
const busybox = require('busybox');
const debug = busybox.debug;

const dm = debug(process.pid);

debug.getState().setConfigs({
  debug: '*',
  useColors: true,        // false
  toFile: path.resolve(__dirname, `${process.pid}`)
});

var count = 0;
setInterval(() => {
  count++;
  if (count % 2 === 0) {
    console.log(`count: ${count}`);
  } else {
    dm(`count: ${count}`);
  }
}, 1000);


