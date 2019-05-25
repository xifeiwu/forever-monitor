var count = 0;
const interval = setInterval(() => {
  count++;
  process.send({count});
}, 1000);

setTimeout(() => {
  // process.exit([code]), only code can be passed by process.exit
  process.exit(0, 'exit as expect');
}, 6000);