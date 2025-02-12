import * as os from 'os';

export function getEnvironmentInfo() {
    return `
Environment Information:
Operating System: ${os.platform()} ${os.release()}
Architecture: ${os.arch()}
CPU Cores: ${os.cpus().length}
Total Memory: ${Math.round(os.totalmem() / (1024 * 1024 * 1024))}GB
Free Memory: ${Math.round(os.freemem() / (1024 * 1024 * 1024))}GB
Default Shell: ${process.env.SHELL || 'unknown'}
Home Directory: ${os.homedir()}
Current Working Directory: ${process.cwd()}
Node Version: ${process.version}
Current Time: ${new Date().toLocaleString()}
Locale: ${Intl.DateTimeFormat().resolvedOptions().locale}
Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}
User Info: ${os.userInfo().username}
Package Manager: ${process.env.npm_config_user_agent?.split('/')[0] || 'npm'}
Terminal: ${process.env.TERM_PROGRAM || process.env.TERM || 'unknown'}
Git Branch: ${require('child_process').execSync('git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "not a git repo"').toString().trim()}
`;
} 