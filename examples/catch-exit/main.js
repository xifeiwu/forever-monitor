// 子线程退出后，父线程任务队列没有任务，也会自动退出。

const path = require('path');
const {spawn} = require('child_process');

var fileName = 'normal.js';
var fileName = 'exit.js';
var fileName = 'kill.js';

const child = spawn('node', [path.resolve(__dirname, fileName)], {
  stdio: [ 'pipe', 'pipe', 'pipe', 'ipc' ],
  env: Object.assign(process.env, {
    FOO: 'foo',
    BAR: 'bar'
  })
});

// console.log(process.env);
child.stdout.pipe(process.stdout, { end: false });
child.stderr.pipe(process.stderr, { end: false });

child.on('exit', (code, signal) => {
  console.log('subprocess exit');
  console.log(code, signal);
})
child.on('message', (msg) => {
  console.log(`subprocess message:`);
  console.log(msg);
});


// receive signal emitted by childProcess using process.kill(code, signal);
process.on('SIGTERM', () => {
  console.log(`subprocess signal:`);
  console.log(`signal SIGTERM is received!`);
});
