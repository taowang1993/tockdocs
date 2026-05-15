const { chromium } = require('/Users/max/Library/pnpm/global/5/.pnpm/playwright-core@1.61.0-alpha-1778188671000/node_modules/playwright-core');

async function debug() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  await page.goto('http://localhost:4987/docs/manual/en/getting-started/installation', { waitUntil: 'load', timeout: 30000 });
  await new Promise(r => setTimeout(r, 5000));

  await page.getByTestId('ask-ai-btn').click();
  await new Promise(r => setTimeout(r, 6000));

  // Get full text of aside[2]
  const fullText = await page.locator('aside').nth(2).textContent();
  console.log('Full aside[2] text:', fullText?.substring(0, 300));
  console.log('Contains "Send prompt":', fullText?.includes('Send prompt'));

  // Test filter chain step by step
  const filtered = page.locator('aside').filter({ hasText: 'Send prompt' });
  console.log('Filtered aside count:', await filtered.count());

  if (await filtered.count() > 0) {
    console.log('Filtered aside text:', (await filtered.first().textContent())?.substring(0, 100));
    const ta = filtered.locator('textarea');
    console.log('Child textarea count:', await ta.count());
    if (await ta.count() > 0) {
      console.log('First textarea visible:', await ta.first().isVisible().catch(() => false));
    }
  }

  // Try without filter - just textarea inside any aside
  const allTa = page.locator('aside textarea');
  console.log('\nAll aside textareas:', await allTa.count());
  for (let i = 0; i < await allTa.count(); i++) {
    console.log(`  ta[${i}]: placeholder="${await allTa.nth(i).getAttribute('placeholder')}" visible=${await allTa.nth(i).isVisible().catch(() => false)}`);
  }

  await browser.close();
}

debug().catch(e => console.error('FATAL:', e));
