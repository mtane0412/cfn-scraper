import playwright from 'playwright-core';
import { TOTP } from 'totp-generator';
import dotenv from 'dotenv';
dotenv.config();
// fsをimport
import fs from 'fs';

// usernameとpasswordを環境変数から取得
const username:string|undefined = process.env.USERNAME;
const password:string|undefined = process.env.PASSWORD;

(async () => {
  if (!username || !password) {
    console.error('Please set USERNAME and PASSWORD in .env');
    return;
  }
  const browser = await playwright.chromium.launch(
    {
      headless: false,
    }
  );
  const context = await browser.newContext(
    {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    }
  );
  const page = await context.newPage();
  const targetUrl = 'https://www.streetfighter.com/6/buckler/ja-jp/auth/loginep?redirect_url=/';
  await page.goto(targetUrl);
  // input[type="email"] と input[type="password"]の出現を待つ
  const emailSelector:string = 'input[type="email"]';
  const passwordSelector:string = 'input[type="password"]';
  await page.waitForSelector(emailSelector);
  await page.waitForSelector(passwordSelector);

  // メール・パスワードを入力
  await page.fill(emailSelector, username);
  await page.fill(passwordSelector, password);

  // ログインボタンをクリック
  // //*[@id="auth0-lock-container-1"]/div/div[2]/form/div/div/div/button/span をクリック
  await page.click('//*[@id="auth0-lock-container-1"]/div/div[2]/form/div/div/div/button/span');

  // 2段階認証がない場合の処理は後で考える
  const totpSelector:string = '//*[@id="code"]';
  await page.waitForSelector(totpSelector);
  // TOTPを生成
  if (!process.env.TOTP_SECRET) {
    console.error('Please set TOTP_SECRET in .env');
    return;
  }
  const {otp} = TOTP.generate(process.env.TOTP_SECRET);
  await page.fill(totpSelector, otp);

  // button[type="submit"][value="default"] をクリック
  await page.click('button[type="submit"][value="default"]');

  // https://www.streetfighter.com/6/buckler/ja-jp?status=login に遷移するまで待つ
  await page.waitForURL('https://www.streetfighter.com/6/buckler/ja-jp?status=login');

  // ログインエラー処理あとで考える

  // //*[@id="wrapper"]/header/div/aside[5] をクリック
  await page.click('//*[@id="wrapper"]/header/div/aside[5]');

  // //*[@id="__NEXT_DATA__"] のjsonのトップレベルにあるbuildIdを取得
  const buildId = await page.evaluate(() => {
    const textContent = document.getElementById('__NEXT_DATA__')?.textContent;
    if (!textContent) {
      throw new Error('Element with id "__NEXT_DATA__" not found');
    }
    const json = JSON.parse(textContent);
    return json.buildId;
  });

  // https://www.streetfighter.com/6/buckler/_next/data/${buildId}/ja-jp/profile/${fighter_id}/battlelog.json?page=${pageNum}&sid=${fighter_id} からjsonを取得
  const fighterId = 1133905938;
  const pageNum = 1;
  const url = `https://www.streetfighter.com/6/buckler/_next/data/${buildId}/ja-jp/profile/${fighterId}/battlelog.json?page=${pageNum}&sid=${fighterId}`;
  await page.goto(url);
  const json = await page.evaluate(() => {
    const textContent = document.body.textContent;
    if (!textContent) {
      throw new Error('No content found');
    }
    return JSON.parse(textContent);
  });

  // jsonを実行ディレクトリに保存
  fs.writeFileSync('data/battlelog.json', JSON.stringify(json, null, 2));
  console.log('Battlelog saved to battlelog.json');
  await page.screenshot({ path: 'screenshot.png' });
  console.log('Screenshot saved to screenshot.png');
  await browser.close();
})();
