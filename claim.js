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
// 🧠 game_day (16:00切日)
// ----------------------
function getGameDay() {
  const now = new Date();

  // 台灣時間（UTC+8）
  const taiwanOffset = 8 * 60 * 60 * 1000;
  const local = new Date(now.getTime() + taiwanOffset);

  const hour = local.getUTCHours();

  // 如果還沒到16:00 → 算前一天的game_day
  if (hour < 16) {
    local.setDate(local.getDate() - 1);
  }

  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}-${String(local.getUTCDate()).padStart(2, '0')}_16`;
}

// ----------------------
// Discord notify
// ----------------------
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
            inline: false
          },
          {
            name: "🎁 結果",
            value: isSuccess
              ? `成功領取 ${claimed} 個`
              : "沒有可領取獎勵",
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
  let claimed = 0;

  const state = loadState();
  const gameDay = getGameDay();

  // 🟢 防止 Discord 爆炸（核心）
  const alreadyNotified =
    state.gameDay === gameDay && state.notified === true;

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

    // ----------------------
    // 🧠 核心控制：只發一次 DC
    // ----------------------
    const isSuccess = claimed > 0;

    if (isSuccess && !alreadyNotified) {
      await notify(claimed, ACCOUNT_NAME);

      state.gameDay = gameDay;
      state.notified = true;
      saveState(state);
    }

    // ❌ 沒成功 or 已通知 → 不動 state、不刷 DC

  } catch (err) {
    console.log("❌ error", err);

    // 失敗不影響通知鎖（避免卡死）
    await notify(0, ACCOUNT_NAME);

  } finally {
    await browser.close();
  }
})();
