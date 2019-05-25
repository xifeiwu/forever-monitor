// can spawn two process in the same js file
const path = require('path');
const {spawn} = require('child_process');

const child = spawn('node', [path.resolve(__dirname, 'env-vars.js')], {
  stdio: [ 'pipe', 'pipe', 'pipe', 'ipc' ],
  env: Object.assign(process.env, {
    FOO: 'foo',
    BAR: 'bar'
  })
});

// console.log(process.env);
child.stdout.pipe(process.stdout, { end: false });
child.stderr.pipe(process.stderr, { end: false });

child.on('exit', (evt) => {
  console.log(evt);
})
child.on('message', (msg) => {
  console.log(`subprocess message:`);
  console.log(msg);
});
