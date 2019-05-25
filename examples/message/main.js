// can spawn two process in the same js file
const path = require('path');
const {spawn} = require('child_process');

const child = spawn('node', [path.resolve(__dirname, 'process-send.js')], {
  stdio: [ 'pipe', 'pipe', 'pipe', 'ipc' ]
});


child.stdout.pipe(process.stdout, { end: false });
child.stderr.pipe(process.stderr, { end: false });

child.on('message', (msg) => {
  console.log(`subprocess message:`);
  console.log(msg);
})