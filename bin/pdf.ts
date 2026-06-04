import { mkdir, writeFile } from "fs/promises"
import path from "path"
import { PDFDocument } from "pdf-lib"
import puppeteer, { type Page } from "puppeteer"

// Renders CV pages from the running site to PDF and reports page counts.
// Single source of truth: the MDX pages and the site's print CSS. This is the
// automated equivalent of opening the page and printing to PDF (Ctrl-P).
//
// Defaults to the dev server (port 3100). Override with CV_PDF_BASE_URL.
// Wired into `bun start` so the PDFs stay fresh during development; also
// runnable on its own with `bun cv:pdf`.

const BASE_URL = process.env.CV_PDF_BASE_URL ?? "http://localhost:3100"
const STRICT = process.argv.includes("--strict")
const STARTUP_TIMEOUT_MS = 120_000

type Target = { route: string; out: string; maxPages?: number; margin?: string }

const TARGETS: Target[] = [
  { route: "/CV", out: "public/CV.pdf" },
  // Tighter margins (paired with the .cvCompact CSS profile) keep this within budget.
  { route: "/CV-NIV", out: "public/CV-NIV.pdf", maxPages: 4, margin: "0.4in" },
]

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Navigate and wait for the MDX content to actually render. Retries until the
// server is up AND the route has finished compiling (the dev server, launched
// in parallel via `run-p`, may still be booting or compiling on-demand, which
// would otherwise capture an empty page).
async function gotoWithRetry(page: Page, url: string, deadline: number): Promise<boolean> {
  for (;;) {
    try {
      await page.goto(url, { waitUntil: "networkidle0", timeout: 60_000 })
      await page.waitForFunction(() => (document.querySelector("main")?.textContent?.length ?? 0) > 1000, {
        timeout: 15_000,
      })
      return true
    } catch (err) {
      if (Date.now() > deadline) {
        console.warn(`[cv:pdf] Gave up waiting for ${url}: ${(err as Error).message}`)
        return false
      }
      await sleep(1500)
    }
  }
}

async function main() {
  const browser = await puppeteer.launch({ headless: true })
  let exceeded = false
  try {
    const page = await browser.newPage()
    const deadline = Date.now() + STARTUP_TIMEOUT_MS
    for (const target of TARGETS) {
      const url = `${BASE_URL}${target.route}`
      if (!(await gotoWithRetry(page, url, deadline))) {
        console.warn(`[cv:pdf] Skipping ${target.out} (server unreachable at ${BASE_URL}).`)
        continue
      }
      const margin = target.margin ?? "0.5in"
      const buffer = await page.pdf({
        format: "letter",
        printBackground: true,
        // Use an explicit margin (overriding the global @page margin) so per-CV
        // tightening can buy back vertical space.
        preferCSSPageSize: false,
        margin: { top: margin, right: margin, bottom: margin, left: margin },
      })
      await mkdir(path.dirname(target.out), { recursive: true })
      await writeFile(target.out, buffer)
      const pageCount = (await PDFDocument.load(buffer)).getPageCount()
      const over = target.maxPages != null && pageCount > target.maxPages
      exceeded = exceeded || over
      const budget = target.maxPages != null ? ` (budget ${target.maxPages})` : ""
      const flag = over ? "  ⚠️  OVER BUDGET" : ""
      console.log(`[cv:pdf] ${target.out} — ${pageCount} page${pageCount === 1 ? "" : "s"}${budget}${flag}`)
    }
  } finally {
    await browser.close()
  }

  if (exceeded && STRICT) {
    process.exitCode = 1
  }
}

// Never fail the surrounding dev session (`run-p`): warn and exit cleanly.
main().catch((err) => {
  console.warn(`[cv:pdf] Unexpected error; skipping PDF generation: ${err?.message ?? err}`)
})
