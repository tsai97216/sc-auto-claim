const { chromium } = require('playwright');

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;

async function notify(msg) {
  if (!DISCORD_WEBHOOK) return;

  try {
    await fetch(DISCORD_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: msg })
    });
  } catch {}
}

(async () => {
  let claimed = 0;

  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      storageState: 'auth.json'
    });

    const page = await context.newPage();

    await page.goto('https://store.supercell.com/brawlstars');

    await page.waitForTimeout(5000);

    const buttons = await page.$$('button');

    for (const btn of buttons) {
      let text = '';
      try {
        text = await btn.innerText();
      } catch {
        continue;
      }

      if (
        text.includes('Claim') ||
        text.includes('Get') ||
        text.includes('領取')
      ) {
        try {
          await btn.click();
          claimed++;
          await page.waitForTimeout(1200);
        } catch {}
      }
    }

    console.log(`完成：${claimed}`);

    await notify(`🎮 自動領取完成：${claimed}`);

  } catch (e) {
    console.log("錯誤", e);
    await notify("❌ 自動領取失敗");
  } finally {
    await browser.close();
  }
})();