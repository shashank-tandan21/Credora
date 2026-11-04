import { chromium } from 'playwright-core'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const executablePath = process.env.BROWSER_EXECUTABLE || [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find(existsSync)
const browser = await chromium.launch({ executablePath, headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
await context.addInitScript(() => { localStorage.setItem('credora-network', 'demo'); localStorage.setItem('credora-theme', 'light') })
const page = await context.newPage()
const errors = []
const results = []
page.on('pageerror', error => errors.push(error.message))
const base = process.env.UI_BASE_URL || 'http://127.0.0.1:3001'
const output = path.resolve('../docs/evidence/ui-polish')
mkdirSync(output, { recursive: true })
try {
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const route of ['/', '/borrower', '/borrower/credit', '/borrower/borrow', '/lender', '/reviewer']) {
      await page.goto(base + '/#' + route)
      await page.waitForSelector('#main-content')
      await page.waitForFunction(() => !document.body.innerText.includes('Loading your workspace'))
      if (route === '/borrower/borrow') await page.getByRole('button', { name: 'Simulate Loan Request', exact: true }).waitFor()
      await page.evaluate(() => document.fonts.ready)
      await page.waitForFunction(() => !document.body.innerText.includes('Loading pool data') && !document.body.innerText.includes('Loading disputes'))
      const metrics = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > window.innerWidth,
        text: document.querySelector('main').innerText.length,
        font: getComputedStyle(document.body).fontFamily,
        loadedFont: document.fonts.check('16px "IBM Plex Sans"'),
      }))
      assert.ok(metrics.text > 20, 'Empty route: ' + route)
      results.push({ width, route, ...metrics })
      await page.screenshot({ path: path.join(output, width + '-' + (route === '/' ? 'landing' : route.slice(1).replaceAll('/', '-')) + '.png'), fullPage: true, animations: 'disabled' })
    }
  }
  await page.goto(base + '/#/borrower/borrow')
  await page.getByRole('button', { name: 'Simulate Loan Request', exact: true }).waitFor()
  assert.equal(await page.getByText('12.00% APR', { exact: true }).count(), 1)
  await page.getByRole('spinbutton', { name: 'Requested amount in mUSDC' }).fill('100000')
  assert.equal(await page.getByRole('button', { name: 'Simulate Loan Request', exact: true }).count(), 0, 'Stale quote remained actionable')
  await page.goto(base + '/#/lender')
  const deposit = page.getByRole('button', { name: 'Deposit', exact: true })
  await deposit.click()
  const dialog = page.getByRole('dialog')
  await dialog.waitFor({ state: 'visible' })
  await page.keyboard.press('Shift+Tab')
  assert.ok(await page.evaluate(() => document.querySelector('dialog').contains(document.activeElement)), 'Dialog focus escaped')
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'hidden' })
  assert.equal(await deposit.evaluate(el => el === document.activeElement), true, 'Focus did not return')
  await page.getByRole('button', { name: 'Use dark theme' }).click()
  assert.equal(await page.locator('html').evaluate(el => el.classList.contains('dark')), true)
  await page.screenshot({ path: path.join(output, '390-lender-dark.png'), fullPage: true, animations: 'disabled' })
  await page.getByLabel('Workspace', { exact: true }).selectOption('borrower')
  await page.getByRole('button', { name: 'My credit', exact: true }).click()
  assert.ok(page.url().endsWith('/borrower/credit'))
  await page.reload()
  await page.getByRole('button', { name: 'My credit', exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'My credit', exact: true }).getAttribute('aria-current'), 'page')
  await page.getByLabel('Network mode', { exact: true }).selectOption('onchain')
  await page.getByLabel('Workspace', { exact: true }).selectOption('reviewer')
  await page.screenshot({ path: path.join(output, '390-operator-disconnected.png'), fullPage: true, animations: 'disabled' })
  assert.equal(await page.getByText('Demo queue', { exact: false }).count(), 0, 'Demo queue leaked into chain mode')
  assert.deepEqual(errors, [], 'Browser runtime errors')
  writeFileSync(path.join(output, 'results.json'), JSON.stringify({ results, errors, interactions: ['dialog focus trap', 'Escape and focus return', 'dark theme', 'workspace selection', 'deep-link reload', 'mode isolation', 'quoted APR', 'stale quote invalidation'] }, null, 2))
  console.log(JSON.stringify({ results, errors }, null, 2))
  assert.equal(results.filter(result => result.overflow).length, 0, 'Horizontal page overflow')
} finally { await browser.close() }
