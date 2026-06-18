const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } }); // iPhone X size
  const page = await context.newPage();
  // Expo Web URL
  await page.goto('http://localhost:8081', { waitUntil: 'networkidle' });
  // Wait for the login button to appear
  await page.waitForSelector('text=SECURE LOGIN', { timeout: 15000 });
  await page.screenshot({ path: 'login_screenshot.png', fullPage: true });
  console.log('Screenshot saved as login_screenshot.png');
  await browser.close();
})();
