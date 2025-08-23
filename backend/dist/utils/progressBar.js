"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgressBar = void 0;
class ProgressBar {
    constructor(total, barLength = 50) {
        this.total = total;
        this.current = 0;
        this.barLength = barLength;
        this.startTime = Date.now();
    }
    update(current) {
        this.current = current;
        this.render();
    }
    increment() {
        this.current++;
        this.render();
    }
    render() {
        const percentage = Math.min((this.current / this.total) * 100, 100);
        const filledLength = Math.round((this.barLength * this.current) / this.total);
        const emptyLength = this.barLength - filledLength;
        const filled = '#'.repeat(filledLength);
        const empty = '-'.repeat(emptyLength);
        const bar = filled + empty;
        const elapsed = Date.now() - this.startTime;
        const estimatedTotal = this.total > 0 ? (elapsed * this.total) / this.current : 0;
        const remaining = Math.max(0, estimatedTotal - elapsed);
        const elapsedStr = this.formatTime(elapsed);
        const remainingStr = this.formatTime(remaining);
        const rate = this.current > 0 ? (this.current / (elapsed / 1000)).toFixed(1) : '0';
        // Clear current line and output progress bar
        process.stdout.write('\r');
        process.stdout.write(`[${bar}] ${percentage.toFixed(1)}% | ${this.current}/${this.total} | ` +
            `Speed: ${rate}/s | Elapsed: ${elapsedStr} | Remaining: ${remainingStr}`);
        // Force output
        process.stdout.write('');
        if (this.current >= this.total) {
            process.stdout.write('\n');
        }
    }
    formatTime(ms) {
        if (ms < 1000)
            return `${ms}ms`;
        if (ms < 60000)
            return `${(ms / 1000).toFixed(1)}s`;
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return `${minutes}m ${seconds}s`;
    }
    complete() {
        this.update(this.total);
        const totalTime = Date.now() - this.startTime;
        console.log(`\n✅ Processing completed in ${this.formatTime(totalTime)}`);
    }
    error(message) {
        process.stdout.write('\n');
        console.error(`❌ Error: ${message}`);
    }
}
exports.ProgressBar = ProgressBar;
//# sourceMappingURL=progressBar.js.map