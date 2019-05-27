// can spawn two process in the same js file

// const {spawn} = require('child_process');

// const child1 = spawn('node', ['server-1.js']);
// const child2 = spawn('node', ['server-2.js'], {
//   stdio: [ 'pipe', 'pipe', 'pipe', 'ipc' ]
// });


// child1.stdout.pipe(process.stdout, { end: false });
// child1.stderr.pipe(process.stderr, { end: false });

// child2.stdout.pipe(process.stdout, { end: false });
// child2.stderr.pipe(process.stderr, { end: false });

// child2.on('message', (msg) => {
//   console.log(`subprocess message: ${msg}`);
// })

const path = require('path');

var forever = require('../../lib');

var fileName = 'normal.js';
// var fileName = 'counter.js';
// var fileName = path.resolve(__dirname, fileName);

var foreverMonitor = new (forever.Monitor)(fileName, {
  maxTry: 3,
  silent: false,
  args: [],
  outFile: path.resolve(__dirname, 'out.file'),
  errFile: path.resolve(__dirname, 'err.file'),
});

foreverMonitor.on('error', (err) => {
  console.log('err');
  console.log(err);
});
foreverMonitor.on('start', (status) => {
  console.log('start');
  console.log(status);
});
foreverMonitor.on('restart', (status) => {
  console.log('restart');
  console.log(status);
});
foreverMonitor.on('child:exit', (code, signal, status) => {
  console.log('child:exit');
  console.log(code, signal);
  console.log(status);
});

foreverMonitor.start();


// setInterval(() => {
//   foreverMonitor.restart();
// }, 3000);
