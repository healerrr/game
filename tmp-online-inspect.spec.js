const { test } = require('@playwright/test');

test('inspect online game app', async ({ page }) => {
  page.on('console', (msg) => console.log(`[browser:${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => console.log(`[pageerror] ${err.message}`));
  page.on('requestfailed', (req) => console.log(`[requestfailed] ${req.method()} ${req.url()} ${req.failure()?.errorText || ''}`));

  await page.goto('http://8.154.39.1:3006/', { waitUntil: 'networkidle', timeout: 60000 });
  console.log('initial url:', page.url());
  console.log('title:', await page.title());
  console.log('body text:', (await page.locator('body').innerText()).slice(0, 1500));
  console.log('buttons:', await page.locator('button').evaluateAll((buttons) => buttons.map((button) => ({
    text: button.innerText,
    disabled: button.disabled,
    classes: button.className
  }))));

  const name = `自动测试${Date.now().toString().slice(-6)}`;
  const input = page.locator('input').first();
  if (await input.count()) {
    await input.fill(name);
  }
  const busButtons = page.locator('button').filter({ hasText: '1号车' });
  if (await busButtons.count()) {
    await busButtons.first().click();
  }
  const enter = page.locator('button').filter({ hasText: /进入|平台|游戏/ }).first();
  if (await enter.count()) {
    await enter.click();
    await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => null);
    await page.waitForTimeout(1500);
  }
  console.log('after register url:', page.url());
  console.log('after text:', (await page.locator('body').innerText()).slice(0, 2000));
  console.log('after buttons:', await page.locator('button').evaluateAll((buttons) => buttons.map((button) => ({
    text: button.innerText,
    disabled: button.disabled,
    classes: button.className
  }))));
});
