// Browser smoke test of the UI in on-chain mode against a local Hardhat deployment.
// A minimal EIP-1193 provider is injected that forwards to the node's unlocked dev
// accounts, so no wallet extension is needed. Requires (see frontend/README.md):
//   contracts: npm run node + npm run deploy:local
//   backend:   uvicorn on VITE_API_URL with SEPOLIA_RPC_URL=http://127.0.0.1:8545, CHAIN_ID=31337
//   frontend:  VITE_CHAIN_ID=31337 VITE_DEMO_MODE=false npm run dev
// Uses an installed Chromium-based browser (BROWSER_PATH overrides the defaults).
import { existsSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'

const BASE = process.env.BASE_URL ?? 'http://localhost:3000'
const BROWSER =
  process.env.BROWSER_PATH ??
  [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].find((candidate) => existsSync(candidate))
if (!BROWSER) throw new Error('No Chromium-based browser found; set BROWSER_PATH.')
const OPERATOR = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' // Hardhat #0
const BORROWER = '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955' // Hardhat #7
const LENDER = '0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f' // Hardhat #8
const SHOTS = new URL('./screenshots/', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
mkdirSync(SHOTS, { recursive: true })

const providerScript = ({ account, chainId }) => {
  let current = localStorage.getItem('__e2e_account') || account
  const listeners = {}
  let id = 0
  const emit = (event, payload) => (listeners[event] || []).forEach((fn) => fn(payload))
  async function rpc(method, params) {
    const response = await fetch('http://127.0.0.1:8545', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params: params || [] }),
    })
    const json = await response.json()
    if (json.error) {
      const error = new Error(json.error.message)
      error.code = json.error.code
      error.data = json.error.data
      throw error
    }
    return json.result
  }
  window.ethereum = {
    isMetaMask: true,
    request: async ({ method, params }) => {
      switch (method) {
        case 'eth_requestAccounts':
        case 'eth_accounts':
          return [current]
        case 'eth_chainId':
          return chainId
        case 'wallet_switchEthereumChain':
        case 'wallet_addEthereumChain':
        case 'wallet_revokePermissions':
          return null
        case 'wallet_requestPermissions':
        case 'wallet_getPermissions':
          return [{ parentCapability: 'eth_accounts' }]
        default:
          return rpc(method, params)
      }
    },
    on: (event, fn) => {
      ;(listeners[event] ||= []).push(fn)
    },
    removeListener: (event, fn) => {
      listeners[event] = (listeners[event] || []).filter((item) => item !== fn)
    },
  }
  window.__e2eSetAccount = (next) => {
    current = next
    localStorage.setItem('__e2e_account', next)
    emit('accountsChanged', [next])
  }
}

const results = []
const errors = []
let activePage
async function step(name, fn) {
  const started = Date.now()
  try {
    await fn()
    results.push({ name, ok: true, ms: Date.now() - started })
    console.log(`  ✔ ${name}`)
  } catch (error) {
    results.push({ name, ok: false, error: error.message.split('\n')[0] })
    console.log(`  ✘ ${name}: ${error.message.split('\n')[0]}`)
    await activePage?.screenshot({ path: `${SHOTS}FAILED.png` }).catch(() => {})
    throw error
  }
}

// Re-runnable on the same local chain: advance past the 24h faucet cooldown.
for (const [method, params] of [['evm_increaseTime', [2 * 86_400]], ['evm_mine', []]]) {
  await fetch('http://127.0.0.1:8545', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
}

const browser = await chromium.launch({ executablePath: BROWSER, headless: true })
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.addInitScript(providerScript, { account: BORROWER, chainId: '0x7a69' })
  const page = await context.newPage()
  activePage = page
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    // 401/404 responses are expected API semantics (pre-auth retry, no profile yet).
    if (message.type() === 'error' && !/status of (401|404)/.test(message.text())) errors.push(`console: ${message.text()}`)
  })

  const nav = (label) => page.locator('header nav').getByRole('button', { name: label }).click()
  const confirmed = (title) =>
    page.locator('[role=status]', { hasText: title }).filter({ hasText: /onfirmed on Hardhat Local/ }).waitFor({ timeout: 60_000 })
  const switchAccount = async (account) => {
    await page.evaluate((next) => window.__e2eSetAccount(next), account)
    await page.locator('[aria-label="Disconnect wallet"]').waitFor()
    await page.waitForTimeout(800)
  }

  console.log(`On-chain UI smoke test against ${BASE}`)
  await step('loads in on-chain mode with a connect prompt', async () => {
    await page.goto(BASE)
    await page.getByRole('button', { name: /Network mode: Hardhat Local/ }).waitFor()
    await page.getByRole('button', { name: 'Connect Wallet' }).first().waitFor()
    await page.screenshot({ path: `${SHOTS}01-onchain-disconnected.png` })
  })

  await step('connects the injected wallet', async () => {
    await page.getByRole('button', { name: 'Connect Wallet' }).first().click()
    await page.locator('[aria-label="Disconnect wallet"]').waitFor()
  })

  await step('registers identity on-chain and the backend verifies the receipt', async () => {
    await nav('Borrower Portal')
    const attest = page.getByRole('button', { name: 'Attest Identity On-chain' })
    // Let on-chain reads settle: the card first renders before isRegistered loads.
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
    if (!(await page.getByText('Backend-verified tx').isVisible())) {
      await attest.click()
      const name = page.getByLabel('Display Name / Legal Name')
      if (await name.count()) await name.fill('UI E2E Borrower')
      await page.getByRole('button', { name: 'Register On-chain' }).click()
      await page.getByText('Identity registered on-chain and verified by the backend').waitFor({ timeout: 60_000 })
    }
    await page.getByText('Backend-verified tx').waitFor()
    await page.screenshot({ path: `${SHOTS}02-identity-registered.png` })
  })

  await step('operator publishes the score attestation from the Reviewer Desk', async () => {
    await switchAccount(OPERATOR)
    await nav('Reviewer Desk')
    await page.getByRole('heading', { name: 'On-chain Operations' }).waitFor()
    await page.getByLabel('Borrower wallet').fill(BORROWER)
    await page.getByLabel('Score (0-100)').fill('71')
    await page.getByRole('button', { name: 'Attest score' }).click()
    await confirmed('Publish score attestation')
    await page.screenshot({ path: `${SHOTS}03-operator-attested.png` })
  })

  await step('borrower requests a loan that is funded and disbursed on-chain', async () => {
    await switchAccount(BORROWER)
    await nav('Borrower Portal')
    await page.getByRole('button', { name: /3\. Request Loan/ }).click()
    await page.getByRole('button', { name: 'Request Loan On-chain' }).click()
    await page.getByRole('button', { name: 'Confirm in Wallet' }).click()
    await page.getByText(/funded and disbursed on Hardhat Local/).waitFor({ timeout: 60_000 })
    await page.screenshot({ path: `${SHOTS}04-loan-funded.png` })
  })

  await step('borrower repays in full (approve + repayInFull)', async () => {
    await page.getByRole('button', { name: 'View On-chain Facility' }).click()
    // The borrower only holds the disbursed principal; interest needs extra test funds.
    await page.getByRole('button', { name: 'Get test mUSDC' }).click()
    await confirmed('Claim test mUSDC')
    await page.getByRole('button', { name: /Repay in full/ }).click()
    await page.getByText(/fully repaid on Hardhat Local/).waitFor({ timeout: 60_000 })
    await page.screenshot({ path: `${SHOTS}05-loan-repaid.png` })
  })

  await step('lender claims test mUSDC and deposits into the pool', async () => {
    await switchAccount(LENDER)
    await nav('Lending Pool')
    await page.getByRole('button', { name: 'Get test mUSDC' }).click()
    await confirmed('Claim test mUSDC')
    await page.getByRole('button', { name: 'Deposit Liquidity' }).click()
    await page.getByLabel('Deposit Amount (MockUSDC)').fill('250')
    await page.getByRole('button', { name: 'Confirm Deposit' }).click()
    await page.getByText('Deposit of 250 mUSDC confirmed on Hardhat Local.').waitFor({ timeout: 60_000 })
    await page.screenshot({ path: `${SHOTS}06-lender-deposit.png` })
  })

  await step('a contract revert is shown as failed, never as success', async () => {
    await page.getByRole('button', { name: 'Get test mUSDC' }).click()
    await page.locator('[role=status]', { hasText: 'Claim test mUSDC' }).filter({ hasText: 'Reverted' }).waitFor({ timeout: 30_000 })
    await page.getByText('once every 24 hours').first().waitFor()
    await page.screenshot({ path: `${SHOTS}07-revert-failed.png` })
  })

  await step('Demo Mode labels actions as simulated', async () => {
    await page.getByRole('button', { name: /Network mode: Hardhat Local/ }).click()
    await page.getByRole('button', { name: /Network mode: Demo Mode/ }).waitFor()
    await page.getByText('Demo position').waitFor()
    await page.screenshot({ path: `${SHOTS}08-demo-mode.png` })
  })

  await step('renders at a mobile width without horizontal overflow in both modes', async () => {
    await page.setViewportSize({ width: 390, height: 844 })
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    await page.waitForTimeout(500)
    if ((await overflow()) > 0) throw new Error(`Demo Mode overflows by ${await overflow()}px`)
    await page.screenshot({ path: `${SHOTS}09-mobile-demo.png`, fullPage: true })
    await page.getByRole('button', { name: /Network mode: Demo Mode/ }).click()
    await page.locator('[aria-label="Disconnect wallet"]').waitFor()
    await page.waitForTimeout(500)
    if ((await overflow()) > 0) throw new Error(`On-chain mode overflows by ${await overflow()}px`)
    await page.screenshot({ path: `${SHOTS}09-mobile-onchain.png`, fullPage: true })
  })

  const wrongChain = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await wrongChain.addInitScript(providerScript, { account: BORROWER, chainId: '0x1' })
  const page2 = await wrongChain.newPage()
  await step('a wallet on the wrong chain is blocked with a switch prompt', async () => {
    await page2.goto(BASE)
    await page2.evaluate(() => localStorage.setItem('credora-network', 'onchain'))
    await page2.reload()
    await page2.getByRole('button', { name: 'Connect Wallet' }).first().click()
    await page2.getByRole('button', { name: /Switch to Hardhat Local/ }).waitFor()
    await page2.locator('header nav').getByRole('button', { name: 'Lending Pool' }).click()
    await page2.getByText(/Transactions are blocked until then/).waitFor()
    await page2.screenshot({ path: `${SHOTS}10-wrong-chain.png` })
  })
} finally {
  await browser.close()
  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} steps passed`)
  const relevant = errors.filter((e) => !/favicon|DevTools/i.test(e))
  console.log(relevant.length ? `Page errors:\n${relevant.join('\n')}` : 'No page errors.')
  console.log(`Screenshots: ${SHOTS}`)
  if (results.some((r) => !r.ok) || relevant.length > 0) process.exitCode = 1
}
