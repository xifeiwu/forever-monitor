const path = require('path');
var forever = require('../lib');

const filePath = path.resolve(__dirname, 'server.js');

var foreverMonitor = new (forever.Monitor)(filePath, {
  max: 3,
  silent: true,
  args: [],
  outFile: path.resolve(__dirname, 'out.file'),
  errFile: path.resolve(__dirname, 'err.file'),
});

foreverMonitor.on('exit', function () {
  console.log('your-filename.js has exited after 3 restarts');
});

foreverMonitor.start();

setTimeout(() => {
  foreverMonitor.kill(foreverMonitor.child.pid);
}, 20 * 1000);

