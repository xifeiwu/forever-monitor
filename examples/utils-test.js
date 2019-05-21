const utils = require('../lib/forever-monitor/utils');

class Test {
  getNodeThreads() {
    utils.getNodeThreads().then(v => {
      console.log(v);
    }).catch(err => {
      console.log(err);
    });
  }

}

const obj = new Test();
obj.getNodeThreads();

