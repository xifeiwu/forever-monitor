/*
 * common.js: Common methods used in `forever-monitor`.
 *
 * (C) 2010 Charlie Robbins & the Contributors
 * MIT LICENCE
 *
 */

const spawn = require('child_process').spawn;

class Utils {
  // ### function checkProcess (pid, callback)
  // #### @pid {string} pid of the process to check
  // #### @callback {function} Continuation to pass control backto.
  // Utility function to check to see if a pid is running
  checkProcess(pid) {
    if (!pid) {
      return false;
    }
    try {
      //
      // Trying to kill non-existent process here raises a ESRCH - no such
      // process exception. Also, signal 0 doesn't do no harm to a process - it
      // only checks if sending a signal to a given process is possible.
      //
      process.kill(pid, 0);
      return true;
    }
    catch (err) {
      return false;
    }
  }

  //
  // The `ps-tree` module behaves differently on *nix vs. Windows
  // by spawning different programs and parsing their output.
  //
  // Linux:
  // 1. " <defunct> " need to be striped
  // ```bash
  // $ ps -A -o comm,ppid,pid,stat
  // COMMAND          PPID   PID STAT
  // bbsd             2899 16958 Ss
  // watch <defunct>  1914 16964 Z
  // ps              20688 16965 R+
  // ```
  //
  // Darwin:
  // $ ps -A -o comm,ppid,pid,stat
  // COMM              PPID   PID STAT
  // /sbin/launchd        0     1 Ss
  // /usr/libexec/Use     1    43 Ss
  //
  // Win32:
  // 1. wmic PROCESS WHERE ParentProcessId=4604 GET Name,ParentProcessId,ProcessId,Status)
  // 2. The order of head columns is fixed
  // ```shell
  // > wmic PROCESS GET Name,ProcessId,ParentProcessId,Status
  // Name                          ParentProcessId  ProcessId   Status
  // System Idle Process           0                0
  // System                        0                4
  // smss.exe                      4                228
  // ```
  async getNodeThreads() {
    /**
     * Normalizes the given header `str` from the Windows
     * title to the *nix title.
     *
     * @param {string} str Header string to normalize
     */
    function normalizeHeader(str) {
      switch (str) {
        case 'Name':  // for win32
        case 'COMM':  // for darwin
          return 'COMMAND';
          break;
        case 'ParentProcessId':
          return 'PPID';
          break;
        case 'ProcessId':
          return 'PID';
          break;
        case 'Status':
          return 'STAT';
          break;
        default:
          return str
      }
    }
    
    var processLister;
    if (process.platform === 'win32') {
      // See also: https://github.com/nodejs/node-v0.x-archive/issues/2318
      processLister = spawn('wmic.exe', ['PROCESS', 'GET', 'Name,ProcessId,ParentProcessId,Status']);
    } else {
      // change comm to args, (TODO: should fix for win 32)
      processLister = spawn('ps', ['-A', '-o', 'ppid,pid,stat,args']);
    }

    return new Promise((resolve, reject) => {
      const bufList = [];
      processLister.stdout.on('data', (data) => {
        bufList.push(data);
      });

      processLister.stderr.on('data', (data) => {
        console.log(`stderr: ${data}`);
        reject(data);
      });

      processLister.on('close', (code) => {
        const data = Buffer.concat(bufList).toString();
        // console.log(`child process exited with code ${code}`);
        // console.log(`stdout: ${data}`);
        
        var threads = data.toString().split('\n');
        const headers = threads[0].trim().split(/\s+/);
        // console.log(headers);
        
        const threadsList = threads.slice(1).map(it => {
          const items = it.trim().split(/\s+/);
          const result = {};
          headers.forEach((it, index) => {
            if (index == (headers.length -1)) {
              result[normalizeHeader(it)] = items.slice(index).join(' ');
            } else {
              result[normalizeHeader(it)] = items[index];
            }
          });
          return result;
        }).filter(it => it['ARGS'].indexOf('node') > -1);
        // console.log(threadsList);
        resolve(threadsList);
      });
    });
  }

  async getChildProcessByPid(pid) {
    if (typeof pid === 'number') {
      pid = pid.toString();
    }
    const nodeThreadsList = await this.getNodeThreads();
    return nodeThreadsList.filter(it => {
      return it['PPID'] == pid;
    });
  }

  async kill(pid, killTree, signal, callback) {
    signal   = signal   || 'SIGKILL';
    callback = callback || function () {};
    try {
      if (killTree && process.platform !== 'win32') {
        const childThreads = await this.getChildProcessByPid(pid);
          [pid].concat(
            childThreads.map(function (p) {
              return p.PID;
            })
          ).forEach(function (tpid) {
            process.kill(tpid, signal);
          });
          callback();
      } else {
        process.kill(pid, signal);
      }
    } catch(err) {
      callback(err);
    }
  }
}

module.exports = new Utils();
