const { chromium } = require('/Users/max/Library/pnpm/global/5/.pnpm/playwright-core@1.61.0-alpha-1778188671000/node_modules/playwright-core');

async function debug() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('http://localhost:4987/docs/manual/en/getting-started/installation', { waitUntil: 'load', timeout: 30000 });
  await new Promise(r => setTimeout(r, 5000));

  // Click Ask AI
  await page.getByTestId('ask-ai-btn').click();
  await new Promise(r => setTimeout(r, 3000));

  // Find the textarea and trace its ancestry
  const structure = await page.evaluate(() => {
    const textarea = document.querySelector('textarea[placeholder*="Ask a question"]');
    if (!textarea) return 'No textarea found';

    // Get the containing "panel" — walk up to find a significant container
    let el = textarea;
    const path = [];
    while (el && el !== document.body) {
      const info = {
        tag: el.tagName?.toLowerCase(),
        id: el.id || '',
        class: (el.className?.toString() || '').substring(0, 80),
        role: el.getAttribute('role') || '',
        testid: el.getAttribute('data-testid') || '',
        textPreview: el.textContent?.substring(0, 60)?.replace(/\n/g, ' ') || '',
        childCount: el.children?.length || 0,
      };
      path.push(info);
      el = el.parentElement;
    }
    return path;
  });

  console.log('DOM ancestry from textarea up:');
  structure.forEach((info, i) => {
    console.log(`  ${'  '.repeat(i)}<${info.tag}${info.id ? ' #'+info.id : ''}${info.role ? ' role='+info.role : ''}${info.testid ? ' testid='+info.testid : ''} class="${info.class}">`);
    console.log(`  ${'  '.repeat(i)}  text="${info.textPreview}" children=${info.childCount}`);
  });

  // Also check if there's any aside element
  const asides = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('aside, [class*="assistant"], [class*="Assistant"], [class*="panel"], [class*="Panel"], [class*="sidebar"], [class*="Sidebar"]')).map(el => ({
      tag: el.tagName,
      id: el.id,
      className: el.className?.toString()?.substring(0, 100),
      textPreview: el.textContent?.substring(0, 80)
    }));
  });
  console.log('\nCandidate panels:', asides.length);
  asides.forEach(a => console.log(`  <${a.tag} id="${a.id}" class="${a.className}"> "${a.textPreview}"`));

  await browser.close();
}

debug().catch(e => console.error('FATAL:', e));
