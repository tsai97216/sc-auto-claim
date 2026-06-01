const { chromium } = require('playwright');
const fs = require('fs');

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
const ACCOUNT_NAME = process.env.ACCOUNT_NAME || "Unknown";

const STATE_FILE = './claim_state.json';

// ----------------------
// 🧠 state load/save
// ----------------------
function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ----------------------
// 🧠 gameDay (16:00切日)
// ----------------------
function getGameDay() {
  const now = new Date();

  const taiwanOffset = 8 * 60 * 60 * 1000;
  const local = new Date(now.getTime() + taiwanOffset);

  const hour = local.getUTCHours();

  if (hour < 16) {
    local.setDate(local.getDate() - 1);
  }

  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}-${String(local.getUTCDate()).padStart(2, '0')}_16`;
}

// ----------------------
// Discord notify
// ----------------------
async function notify(claimed, accountName, isSuccess) {
  if (!DISCORD_WEBHOOK) return;

  const payload = {
    embeds: [
      {
        title: "🎮 荒野亂鬥自動領取",
        color: isSuccess ? 0x2ecc71 : 0xe74c3c,
        fields: [
          {
            name: "👤 帳號",
            value: accountName,
            inline: false
          },
          {
            name: "🎁 結果",
            value: isSuccess
              ? `成功領取 ${claimed} 個`
              : "沒有可領取獎勵（監控中）",
            inline: false
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

// ----------------------
// main
// ----------------------
(async () => {
  const state = loadState();
  const gameDay = getGameDay();

  // 🟢 換日重置
  if (state.gameDay !== gameDay) {
    state.gameDay = gameDay;
    state.success = false;
    saveState(state);
  }

  const alreadySuccess = state.success === true;

  // 🟢 成功後：直接停止（不再開 browser）
  if (alreadySuccess) {
    console.log(`😴 [${ACCOUNT_NAME}] 今日已成功，跳過執行`);
    return;
  }

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

    const isSuccess = claimed > 0;

    // 🟢 成功：寫入 + 通知一次
    if (isSuccess) {
      state.success = true;
      saveState(state);

      await notify(claimed, ACCOUNT_NAME, true);
    }

    // 🔴 失敗：每次都通知（你已確認允許刷屏）
    if (!isSuccess) {
      await notify(0, ACCOUNT_NAME, false);
    }

  } catch (err) {
    console.log("❌ error", err);

    // 🔴 error 也算失敗通知
    await notify(0, ACCOUNT_NAME, false);

  } finally {
    await browser.close();
  }
})();
