import { readFile } from "fs/promises";
import { join } from "path";
import { deepEqual } from "assert";

import puppeteer from "puppeteer";


const VIEWPORT = [ 1200, 900 ];
const URL = process.argv.slice(2)[0] || "https://example.org";


const browser = await puppeteer.launch({
    args: [
        `--window-size=${VIEWPORT[0]},${VIEWPORT[1]}`,
        '--allow-file-access-from-files',
        '--disable-web-security'
    ],
    defaultViewport: null,
    headless: false
});

const page = (await browser.pages())[0];

await page.evaluateOnNewDocument(
    (await readFile(join(import.meta.dirname, "../dist/api.browser.js"))).toString()
);

await page.goto(URL, {
    waitUntil: "load"
});

await page.evaluate(() => {
    console.log("Access 'window.IsInteractive'")
});