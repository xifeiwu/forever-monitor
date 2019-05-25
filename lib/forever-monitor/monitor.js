/*
 * monitor.js: Core functionality for the Monitor object.
 *
 * (C) 2010 Charlie Robbins & the Contributors
 * MIT LICENCE
 *
 */
var events = require('events'),
    fs = require('fs'),
    path = require('path'),
    child_process = require('child_process'),
    spawn = child_process.spawn,
    utils = require('./utils'),
    EventEmitter = require('events');

//
// ### function Monitor (script, options)
// #### @script {string} Location of the target script to run.
// #### @options {Object} Configuration for this instance.
// Creates a new instance of forever with specified `options`.
//
class Monitor extends EventEmitter {
  constructor (script, options) {
    super();

    var execPath = process.execPath;

    //
    // Setup basic configuration options
    //
    options               = options || {};
    this.killTree         = options.killTree !== false;
    this.max              = options.max;
    this.killSignal       = options.killSignal || 'SIGKILL';
    this.times            = 0;

    //
    // Define some safety checks for commands with spaces
    //
    this.parser = options.parser || this.parseCommand;

    //
    // Setup restart timing. These options control how quickly forever restarts
    // a child process as well as when to kill a "spinning" process
    //
    this.minUptime     = typeof options.minUptime !== 'number' ? 0 : options.minUptime;
    this.spinSleepTime = options.spinSleepTime || null;

    //
    // Special case Windows separately to decouple any
    // future changes
    //
    if (process.platform === 'win32') {
      execPath = '"' + execPath + '"';
    }

    //
    // Setup the command to spawn and the options to pass
    // to that command.
    //
    this.command   = options.command || execPath;
    this.args      = options.args || options.options || [];
    this.spawnWith = options.spawnWith || {};
    this.sourceDir = options.sourceDir;
    this.cwd       = options.cwd || process.cwd();
    this.hideEnv   = options.hideEnv || [];
    this._env      = options.env || {};

    //
    // Allow for custom stdio configuration of forked processes
    //
    this.stdio = options.stdio || null;

    if (Array.isArray(script)) {
      this.command = script[0];
      this.args = script.slice(1);
    }
    else {
      this.args.unshift(script);
    }

    if (this.sourceDir) {
      this.args[0] = path.join(this.sourceDir, this.args[0]);
    }
  }
  
  //
  // ### function parseCommand (command, args)
  // #### @command {String} Command string to parse
  // #### @args    {Array}  Additional default arguments
  //
  // Returns the `command` and the `args` parsed
  // from the command depending on the Platform.
  //
  parseCommand(command, args) {
    var match = command.match(
      process.platform === 'win32' ? safetyChecks.windows : safetyChecks.linux
    );

    //
    // No match means it's a bad command. This is configurable
    // by passing a custom `parser` function into the `Monitor`
    // constructor function.
    //
    if (!match) { return false; }

    if (process.platform == 'win32') {
      command = match[1] || match[2];
      if (match[3]) {
        args = match[3].split(' ').concat(args);
      }
    } else {
      command = match[1];
      if (match[2]) {
        args = match[2].split(' ').concat(this.args);
      }
    }

    return {
      command: command,
      args:    args
    };
  }

  get data() {
    //
    // ### @data {Object}
    // Responds with the appropriate information about
    // this `Monitor` instance and it's associated child process.
    //
    var self = this,
        childData;

    childData = {
      ctime: this.ctime,
      command: this.command,
      file: this.args[0],
      foreverPid: process.pid,
      args: this.args.slice(1),
      pid: this.child ? this.child.pid : undefined,
      spawnWith: this.spawnWith,
      running: this.running,
      restarts: this.times,
    };

    ['env', 'cwd'].forEach(function (key) {
      if (self[key]) {
        childData[key] = self[key];
      }
    });

    if (this.sourceDir) {
      childData.sourceDir = this.sourceDir;
      childData.file = childData.file.replace(this.sourceDir + '/', '');
    }

    this.childData = childData;
    return this.childData;
  }
  //
  // ### function start ([restart])
  // #### @restart {boolean} Value indicating whether this is a restart.
  // Start the process that this instance is configured for
  //
  async start(restart) {
    var self = this, child;
    const threadFindByArgs = await utils.killByArgs([this.command, this.args], true);
    if (threadFindByArgs) {
      console.log('the follow thread is killed: ');
      console.log(threadFindByArgs);
    }

    if (this.running && !restart) {
      process.nextTick(function () {
        self.emit('error', new Error('Cannot start process that is already running.'));
      });
      return this;
    }

    child = this.trySpawn();
    if (!child) {
      process.nextTick(function () {
        self.emit('error', new Error('Target script does not exist: ' + self.args[0]));
      });
      return this;
    }

    this.ctime = Date.now();
    this.child = child;
    this.running = true;

    process.nextTick(function () {
      self.emit(restart ? 'restart' : 'start', self, self.data);
    });

    function onMessage(msg) {
      self.emit('message', msg);
    }

    // Re-emit messages from the child process
    this.child.on('message', onMessage);

    child.on('exit', function (code, signal) {
      var spinning = Date.now() - self.ctime < self.minUptime;
      child.removeListener('message', onMessage);
      self.emit('child:exit', code, signal);

      function letChildDie() {
        self.running = false;
        self.emit('child:exit', self, spinning);
      }

      function restartChild() {
        process.nextTick(function () {
          self.start(true);
        });
      }

      self.times++;

      if ((self.times >= self.max)
        || (spinning && typeof self.spinSleepTime !== 'number')) {
        letChildDie();
      }
      else if (spinning) {
        setTimeout(restartChild, self.spinSleepTime);
      }
      else {
        restartChild();
      }
    });

    return this;
  }

  //
  // ### function trySpawn()
  // Tries to spawn the target Forever child process. Depending on
  // configuration, it checks the first argument of the options
  // to see if the file exists. This is useful is you are
  // trying to execute a script with an env: e.g. node myfile.js
  //
  trySpawn() {
    var run = this.parser(this.command, this.args.slice()),
        stats;

    if (/[^\w]node$/.test(this.command)) {
      try {
        stats = fs.statSync(this.args[0]);
      }
      catch (ex) {
        return false;
      }
    }

    this.spawnWith.cwd = this.spawnWith.cwd || this.cwd;
    this.spawnWith.env = this._getEnv();

    if (process.platform === 'win32') {
      this.spawnWith.detached = true;
    }

    if (this.stdio) {
      this.spawnWith.stdio = this.stdio;
    } else {
      this.spawnWith.stdio = [ 'pipe', 'pipe', 'pipe', 'ipc' ];
    }

    return spawn(run.command, run.args, this.spawnWith);
  }


  //
  // ### function restart ()
  // Restarts the target script associated with this instance.
  //
  restart() {
    this.times = this.times || 0;
    return !this.running
      ? this.start(true)
      : this.kill(false);
  }

  //
  // ### function stop ()
  // Stops the target script associated with this instance. Prevents it from auto-respawning
  //
  stop() {
    return this.kill(true);
  }

  //
  // #### @forceStop {boolean} Value indicating whether short circuit forever auto-restart.
  // Kills the ChildProcess object associated with this instance.
  //
  kill() {
    var child = this.child,
        self = this,
        timer;

    if (!child || !this.running) {
      process.nextTick(function () {
        self.emit('error', new Error('Cannot stop process that is not running.'));
      });
    }
    else {
      child.once('exit', function (code) {
        self.emit('child:exit', self.childData);
        if (!self.running) {
          self.start(true);
        }
      });

      utils.killByPid(this.child.pid, this.killTree, this.killSignal);
    }

    return this;
  }

  //
  // ### function send ()
  // Sends a message to a forked ChildProcess object associated with this instance.
  // see http://nodejs.org/api/child_process.html#child_process_child_send_message_sendhandle
  //
  send(msg) {
    var child = this.child,
        self = this;

    if (!child || !this.running) {
      process.nextTick(function () {
        self.emit('error', new Error('Cannot send to process that is not running.'));
      });
    }

    if (child.send) { child.send(msg) }
  }

  //
  // ### function inspect ()
  // Set this to null so that `util.inspect` does not
  // return `undefined`.'
  //
  // inspect = null;

  //
  // ### @private function _getEnv ()
  // Returns the environment variables that should be passed along
  // to the target process spawned by this instance.
  //
  _getEnv() {
    var self = this,
        merged = {};

    function addKey(key, source) {
      merged[key] = source[key];
    }

    //
    // Mixin the key:value pairs from `process.env` and the custom
    // environment variables in `this._env`.
    //
    Object.keys(process.env).forEach(function (key) {
      if (self.hideEnv.indexOf(key) == -1) {
        addKey(key, process.env);
      }
    });

    Object.keys(this._env).forEach(function (key) {
      addKey(key, self._env);
    });

    return merged;
  }
}

//
// ### @private {Object} safetyChecks
// Define default safety checks for commands
// with spaces in Windows & Linux
//
var safetyChecks = {
  windows: /(?:"(.*[^\/])"|(\w+))(?:\s(.*))?/,
  linux:   /(.*?[^\\])(?: (.*)|$)/
};

module.exports.Monitor = Monitor;