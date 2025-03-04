// Mock default shell based on platform
const process = require('process');

let defaultShell;
if (process.env.SHELL) {
    defaultShell = process.env.SHELL;
} else if (process.platform === 'win32') {
    defaultShell = process.env.COMSPEC || 'cmd.exe';
} else {
    defaultShell = '/bin/sh';
}

module.exports = defaultShell;
module.exports.default = defaultShell;