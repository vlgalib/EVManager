const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Changes the cache location for Puppeteer.
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
  
  // Download Chrome browser automatically
  skipDownload: false,
  
  // Use Chrome browser
  browserRevision: '138.0.7204.168',
  
  // Default launch options
  defaultViewport: {
    width: 1920,
    height: 1080
  }
};