"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logo = void 0;
// Simple ANSI color codes
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m'
};
class Logo {
    // Function to calculate visible string length (without ANSI codes and considering emoji)
    static getVisibleLength(str) {
        // Remove ANSI codes
        const cleanStr = str.replace(/\u001b\[[0-9;]*m/g, '');
        // Calculate length considering emoji
        let length = 0;
        for (let i = 0; i < cleanStr.length; i++) {
            const char = cleanStr[i];
            // Emoji usually take 2 characters in console
            if (char.charCodeAt(0) > 127) {
                length += 2;
            }
            else {
                length += 1;
            }
        }
        return length;
    }
    // Beautiful ANSI splash screen
    static showLogo() {
        console.clear(); // Clear screen
        const logo = `
${colors.cyan}╔══════════════════════════════════════════════════════════════════════════════╗${colors.reset}
${colors.cyan}║${colors.reset}                                                                              ${colors.cyan}║${colors.reset}
${colors.cyan}║${colors.reset}                          ${colors.green}${colors.bright}⚡ EVManager by vlgalib ⚡${colors.reset}                          ${colors.cyan}║${colors.reset}
${colors.cyan}║${colors.reset}                                                                              ${colors.cyan}║${colors.reset}
${colors.cyan}╚══════════════════════════════════════════════════════════════════════════════╝${colors.reset}
`;
        console.log(logo);
        console.log(''); // Empty line after logo
    }
    // Show system information
    static showSystemInfo() {
        // Remove system information
        return;
    }
    // Show startup status
    static showStartupStatus(port) {
        console.log('');
        console.log(`${colors.cyan}╔══════════════════════════════════════════════════════════════════════════════╗${colors.reset}`);
        console.log(`${colors.cyan}║${colors.reset}                    ${colors.green}${colors.bright}✅ SERVER SUCCESSFULLY STARTED ✅${colors.reset}                              ${colors.cyan}║${colors.reset}`);
        console.log(`${colors.cyan}╠══════════════════════════════════════════════════════════════════════════════╣${colors.reset}`);
        console.log(`${colors.cyan}║${colors.reset} ${colors.white} 🌐 API available at: http://localhost:${port}/api${colors.reset}                        ${colors.cyan}║${colors.reset}`);
        console.log(`${colors.cyan}║${colors.reset} ${colors.white} 📱 Frontend available at: http://localhost:4001${colors.reset}                       ${colors.cyan}║${colors.reset}`);
        console.log(`${colors.cyan}║${colors.reset} ${colors.white} 📊 Server status: http://localhost:4000/api/status${colors.reset}                         ${colors.cyan}║${colors.reset}`);
        console.log(`${colors.cyan}╚══════════════════════════════════════════════════════════════════════════════╝${colors.reset}`);
        console.log('');
    }
    // Show processing start message
    static showProcessingStart(walletCount) {
        console.log('');
        console.log(`${colors.cyan}╔══════════════════════════════════════════════════════════════════════════════╗${colors.reset}`);
        console.log(`${colors.cyan}║${colors.reset}                  ${colors.yellow}${colors.bright}🔄 WALLET PROCESSING STARTED 🔄${colors.reset}                            ${colors.cyan}║${colors.reset}`);
        console.log(`${colors.cyan}╠══════════════════════════════════════════════════════════════════════════════╣${colors.reset}`);
        console.log(`${colors.cyan}║${colors.reset} ${colors.white} 📋 Number of wallets to process: ${walletCount}${colors.reset}                                   ${colors.cyan}║${colors.reset}`);
        console.log(`${colors.cyan}║${colors.reset} ${colors.white} ⏱️  Start time: ${new Date().toLocaleString('en-US')}${colors.reset}                                       ${colors.cyan}║${colors.reset}`);
        console.log(`${colors.cyan}╚══════════════════════════════════════════════════════════════════════════════╝${colors.reset}`);
        console.log('');
    }
}
exports.Logo = Logo;
//# sourceMappingURL=logo.js.map