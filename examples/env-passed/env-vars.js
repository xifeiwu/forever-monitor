console.log(JSON.stringify({
  foo: process.env.FOO,
  bar: process.env.BAR
}));
process.send(JSON.stringify({
  foo: process.env.FOO,
  bar: process.env.BAR
}));