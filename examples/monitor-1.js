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

foreverMonitor.on('restart', (monitor, status) => {
  console.log('restart:');
  console.log(status);
});
foreverMonitor.on('start', (monitor, status) => {
  console.log('start:');
  console.log(status);
});

foreverMonitor.on('exit', function (err) {
  console.log('your-filename.js has exited after 3 restarts');
});
foreverMonitor.on('exit:code', function (code, signal) {
  console.log('exit:code');
  console.log(code, signal);
});

foreverMonitor.start();

// setTimeout(() => {
//   foreverMonitor.kill(foreverMonitor.child.pid);
// }, 20 * 1000);

