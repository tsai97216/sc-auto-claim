const { chromium } = require('playwright');

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
const ACCOUNT_NAME = process.env.ACCOUNT_NAME || "Unknown";

async function notify(msg) {
  if (!DISCORD_WEBHOOK) return;

  try {
    await fetch(DISCORD_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: msg })
    });
  } catch (e) {
    console.log("Discord notify failed");
  }
}

(async () => {
  let claimed = 0;

  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      storageState: 'auth.json'
    });

    const page = await context.newPage();

    await page.goto('https://store.supercell.com/brawlstars', {
      waitUntil: 'networkidle'
    });

    await page.waitForTimeout(5000);

    console.log(`👉 [${ACCOUNT_NAME}] 開始掃描`);

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

    console.log(`✅ [${ACCOUNT_NAME}] 完成：${claimed}`);

    await notify(
      `🎮 ${ACCOUNT_NAME} 自動領取完成：${claimed} 個`
    );

  } catch (err) {
    console.log("❌ error", err);

    await notify(`❌ ${ACCOUNT_NAME} 領取失敗`);
  } finally {
    await browser.close();
  }
})();
