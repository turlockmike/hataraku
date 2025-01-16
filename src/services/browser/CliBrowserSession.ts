import * as fs from "fs/promises"
import * as path from "path"
import { Browser, Page, ScreenshotOptions, TimeoutError, launch } from "puppeteer-core"
// @ts-ignore
import PCR from "puppeteer-chromium-resolver"
import pWaitFor from "p-wait-for"
import delay from "delay"
import { fileExistsAtPath } from "../../utils/fs"
import os from 'os';

interface PCRStats {
    puppeteer: { launch: typeof launch }
    executablePath: string
}

export interface BrowserActionResult {
    screenshot?: string;
    logs?: string;
    currentUrl?: string;
    currentMousePosition?: string;
}

export class CliBrowserSession {
    private browser?: Browser
    private page?: Page
    private currentMousePosition?: string
    private readonly viewportSize = { width: 900, height: 600 }
    private readonly screenshotQuality = 75
    private readonly configDir: string

    constructor() {
        this.configDir = path.join(os.homedir(), '.config', 'cline', 'browser');
    }

    private async ensureChromiumExists(): Promise<PCRStats> {
        await fs.mkdir(this.configDir, { recursive: true })

        // if chromium doesn't exist, this will download it to path.join(configDir, ".chromium-browser-snapshots")
        // if it does exist it will return the path to existing chromium
        const stats: PCRStats = await PCR({
            downloadPath: this.configDir,
        })

        return stats
    }

    async launchBrowser(): Promise<void> {
        console.log("Launching browser...")
        if (this.browser) {
            await this.closeBrowser()
        }

        const stats = await this.ensureChromiumExists()
        this.browser = await stats.puppeteer.launch({
            args: [
                "--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
            ],
            executablePath: stats.executablePath,
            defaultViewport: this.viewportSize,
        })
        this.page = await this.browser?.newPage()
    }

    async closeBrowser(): Promise<BrowserActionResult> {
        if (this.browser || this.page) {
            console.log("Closing browser...")
            await this.browser?.close().catch(() => {})
            this.browser = undefined
            this.page = undefined
            this.currentMousePosition = undefined
        }
        return {}
    }

    async doAction(action: (page: Page) => Promise<void>): Promise<BrowserActionResult> {
        if (!this.page) {
            throw new Error(
                "Browser is not launched. This may occur if the browser was automatically closed by a non-`browser_action` tool.",
            )
        }

        const logs: string[] = []
        let lastLogTs = Date.now()

        const consoleListener = (msg: any) => {
            if (msg.type() === "log") {
                logs.push(msg.text())
            } else {
                logs.push(`[${msg.type()}] ${msg.text()}`)
            }
            lastLogTs = Date.now()
        }

        const errorListener = (err: Error) => {
            logs.push(`[Page Error] ${err.toString()}`)
            lastLogTs = Date.now()
        }

        this.page.on("console", consoleListener)
        this.page.on("pageerror", errorListener)

        try {
            await action(this.page)
        } catch (err) {
            if (!(err instanceof TimeoutError)) {
                logs.push(`[Error] ${err.toString()}`)
            }
        }

        await pWaitFor(() => Date.now() - lastLogTs >= 500, {
            timeout: 3_000,
            interval: 100,
        }).catch(() => {})

        let options: ScreenshotOptions = {
            encoding: "base64",
        }

        let screenshotBase64 = await this.page.screenshot({
            ...options,
            type: "webp",
            quality: this.screenshotQuality,
        })
        let screenshot = `data:image/webp;base64,${screenshotBase64}`

        if (!screenshotBase64) {
            console.log("webp screenshot failed, trying png")
            screenshotBase64 = await this.page.screenshot({
                ...options,
                type: "png",
            })
            screenshot = `data:image/png;base64,${screenshotBase64}`
        }

        if (!screenshotBase64) {
            throw new Error("Failed to take screenshot.")
        }

        this.page.off("console", consoleListener)
        this.page.off("pageerror", errorListener)

        return {
            screenshot,
            logs: logs.join("\n"),
            currentUrl: this.page.url(),
            currentMousePosition: this.currentMousePosition,
        }
    }

    async navigateToUrl(url: string): Promise<BrowserActionResult> {
        return this.doAction(async (page) => {
            await page.goto(url, { timeout: 7_000, waitUntil: ["domcontentloaded", "networkidle2"] })
            await this.waitTillHTMLStable(page)
        })
    }

    private async waitTillHTMLStable(page: Page, timeout = 5_000) {
        const checkDurationMsecs = 500
        const maxChecks = timeout / checkDurationMsecs
        let lastHTMLSize = 0
        let checkCounts = 1
        let countStableSizeIterations = 0
        const minStableSizeIterations = 3

        while (checkCounts++ <= maxChecks) {
            let html = await page.content()
            let currentHTMLSize = html.length

            console.log("last: ", lastHTMLSize, " <> curr: ", currentHTMLSize)

            if (lastHTMLSize !== 0 && currentHTMLSize === lastHTMLSize) {
                countStableSizeIterations++
            } else {
                countStableSizeIterations = 0
            }

            if (countStableSizeIterations >= minStableSizeIterations) {
                console.log("Page rendered fully...")
                break
            }

            lastHTMLSize = currentHTMLSize
            await delay(checkDurationMsecs)
        }
    }

    async click(coordinate: string): Promise<BrowserActionResult> {
        const [x, y] = coordinate.split(",").map(Number)
        return this.doAction(async (page) => {
            let hasNetworkActivity = false
            const requestListener = () => {
                hasNetworkActivity = true
            }
            page.on("request", requestListener)

            await page.mouse.click(x, y)
            this.currentMousePosition = coordinate

            await delay(100)

            if (hasNetworkActivity) {
                await page
                    .waitForNavigation({
                        waitUntil: ["domcontentloaded", "networkidle2"],
                        timeout: 7000,
                    })
                    .catch(() => {})
                await this.waitTillHTMLStable(page)
            }

            page.off("request", requestListener)
        })
    }

    async type(text: string): Promise<BrowserActionResult> {
        return this.doAction(async (page) => {
            await page.keyboard.type(text)
        })
    }

    async scrollDown(): Promise<BrowserActionResult> {
        return this.doAction(async (page) => {
            await page.evaluate((scrollHeight) => {
                window.scrollBy({
                    top: scrollHeight,
                    behavior: "auto",
                })
            }, this.viewportSize.height)
            await delay(300)
        })
    }

    async scrollUp(): Promise<BrowserActionResult> {
        return this.doAction(async (page) => {
            await page.evaluate((scrollHeight) => {
                window.scrollBy({
                    top: -scrollHeight,
                    behavior: "auto",
                })
            }, this.viewportSize.height)
            await delay(300)
        })
    }
}