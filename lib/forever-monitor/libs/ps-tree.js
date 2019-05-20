'use strict';

var spawn = require('child_process').spawn;

module.exports = function childrenOfPid(pid, callback) {
  var headers = null;

  if (typeof callback !== 'function') {
    throw new Error('childrenOfPid(pid, callback) expects callback');
  }

  if (typeof pid === 'number') {
    pid = pid.toString();
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
  var processLister;
  if (process.platform === 'win32') {
    // See also: https://github.com/nodejs/node-v0.x-archive/issues/2318
    processLister = spawn('wmic.exe', ['PROCESS', 'GET', 'Name,ProcessId,ParentProcessId,Status']);
  } else {
    processLister = spawn('ps', ['-A', '-o', 'ppid,pid,stat,comm']);
  }

  // const ls = spawn('ls', ['-al',' ~']);

  const bufList = [];
  processLister.stdout.on('data', (data) => {
    bufList.push(data);
  });

  processLister.stderr.on('data', (data) => {
    console.log(`stderr: ${data}`);
    callback(data);
  });

  processLister.on('close', (code) => {
    console.log();
    const data = Buffer.concat(bufList).toString();
    // console.log(`child process exited with code ${code}`);
    // console.log(`stdout: ${data}`);
    
    var threads = data.toString().split('\n');
    const headers = threads[0].trim().split(/\s+/);
    // console.log(headers);
    
    const result = threads.slice(1).map(it => {
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
    }).filter(it => {
      return it['PPID'] == pid;
    });
    // console.log(result);
    callback(null, result);
  });
}

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