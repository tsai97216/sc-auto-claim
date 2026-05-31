const { chromium } = require('playwright');

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
const ACCOUNT_NAME = process.env.ACCOUNT_NAME || "Unknown";

async function notify(claimed, accountName) {
  if (!DISCORD_WEBHOOK) return;

  const isSuccess = claimed > 0;

  const payload = {
    embeds: [
      {
        title: "🎮 荒野亂鬥自動領取",
        color: isSuccess ? 0x2ecc71 : 0x95a5a6,
        fields: [
          {
            name: "👤 帳號",
            value: accountName,
            inline: true
          },
          {
            name: "🎁 結果",
            value: isSuccess
              ? `成功領取 ${claimed} 個`
              : "沒有可領取獎勵",
            inline: true
          },
          {
            name: "✨ 狀態",
            value: isSuccess ? "SUCCESS" : "EMPTY",
            inline: true
          }
        ],
        footer: {
          text: "GitHub Actions Auto Claim"
        },
        timestamp: new Date().toISOString()
      }
    ]
  };

  try {
    await fetch(DISCORD_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
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

    await notify(claimed, ACCOUNT_NAME);

  } catch (err) {
    console.log("❌ error", err);

    await notify(0, ACCOUNT_NAME);
  } finally {
    await browser.close();
  }
})();
