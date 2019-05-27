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

    this.times = 0;

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
    this.options = Object.assign(this.options, {
      env: {},
      maxTry: 0,
      minUptime: 0,
      killSignal: 'SIGKILL',
      killTree: true,
      parser: this.parseCommand,
      stdio: null,
      cwd: process.cwd()
    })

    if (Array.isArray(script)) {
      this.command = script[0];
      this.args = script.slice(1);
    } else {
      this.args.unshift(script);
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
    // ### @private {Object} safetyChecks
    // Define default safety checks for commands
    // with spaces in Windows & Linux
    const safetyChecks = {
      windows: /(?:"(.*[^\/])"|(\w+))(?:\s(.*))?/,
      linux:   /(.*?[^\\])(?: (.*)|$)/
    };
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

  get env() {
    return Object.assign({}, process.env, this.options.env);
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
      ppid: process.pid,
      args: this.args.slice(1),
      pid: this.child ? this.child.pid : undefined,
      running: this.running,
      restarts: this.times,
      cwd: this.options.cwd
    };

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

    const onMessage = (msg) => {
      self.emit('child:message', msg);
    }

    // Re-emit messages from the child process
    this.child.on('message', onMessage);

    child.on('exit', (code, signal) => {
      const upTime = 0;
      if (this.options.minUptime) {
        upTime = this.options.minUptime - (Date.now() - this.ctime);
      }
      upTime = upTime > 0 ? upTime : 0;
      
      child.removeListener('message', onMessage);
      
      // self.emit('child:exit', code, signal);

      const letChildDie = () => {
        this.running = false;
        this.emit('child:exit', code, signal);
      }

      const restartChild = () => {
        process.nextTick(function () {
          this.start(true);
        });
      }

      this.times++;

      if (this.times >= this.options.maxTry) {
        letChildDie();
      } else {
        if (upTime > 0) {
          setTimeout(restartChild, this.spinSleepTime);
        } else {
          restartChild();
        }
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
    var run = this.options.parser(this.command, this.args.slice()),
        stats;

    if (/[^\w]node$/.test(this.command)) {
      try {
        stats = fs.statSync(this.args[0]);
      }
      catch (ex) {
        return false;
      }
    }

    this.spawnWith.cwd = this.options.cwd;
    this.spawnWith.env = this.env();

    if (process.platform === 'win32') {
      this.spawnWith.detached = true;
    }

    if (this.stdio) {
      this.spawnWith.stdio = this.options.stdio;
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
    var child = this.child;

    if (!child || !this.running) {
      process.nextTick(() => {
        this.emit('error', new Error('Cannot stop process that is not running.'));
      });
    } else {
      child.once('exit', (code) => {
        this.emit('child:exit', this.childData);
        if (!this.running) {
          this.start(true);
        }
      });

      utils.killByPid(this.child.pid, this.options.killTree, this.options.killSignal);
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
}


module.exports.Monitor = Monitor;