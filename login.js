const { chromium } = require('playwright');

/**
 * 👉 這裡改成：
 * auth.json      → 主帳號
 * auth-alt.json  → 副帳號
 */
const SAVE_PATH = 'auth-alt.json'; // ← 重點在這裡

(async () => {
  const browser = await chromium.launch({ headless: false });

  const context = await browser.newContext();

  const page = await context.newPage();

  console.log("👉 正在打開登入頁...");

  // 直接進遊戲頁或登入頁都可以
  await page.goto('https://store.supercell.com/brawlstars');

  console.log("👉 請手動登入你的帳號（完成後等 5 秒）");

  // 等你登入完成（手動操作）
  await page.waitForTimeout(30000);

  // 存登入狀態
  await context.storageState({ path: SAVE_PATH });

  console.log(`✅ 已儲存登入狀態：${SAVE_PATH}`);

  await browser.close();
})();