import { readFile } from "fs/promises";
import { join } from "path";
import { deepEqual } from "assert";

import puppeteer from "puppeteer";


const ARGS = process.argv.slice(2);
const HEADLESS = !ARGS.includes("--no-headless");
const KEEPALIVE = ARGS.includes("--keepalive");
const NO_HEADLESS_TIMEOUT = ARGS.includes("--timeout") ? parseInt(ARGS[ARGS.indexOf("--timeout") + 1]) : 2000;

const activeBrowsers = new Set();
 
let hasError = false;


async function cleanupBrowsers() {
    for(const browser of activeBrowsers) {
        try {
            await browser.close();
        } catch (err) {
            console.error(err);
        }
    }

    activeBrowsers.clear();
}
 
process.on("exit", cleanupBrowsers);
process.on("SIGINT", async () => {
    await cleanupBrowsers();

    process.exit(2);
});
process.on("SIGTERM", async () => {
    await cleanupBrowsers();

    process.exit(2);
});


function wrapAssertion(cb, entry) {
    try {
        cb();
    } catch(err) {
        if(err.code !== "ERR_ASSERTION") {
            console.error(err);

            process.exitCode = 2;

            return;
        }

        Error.captureStackTrace(err, entry);

        hasError = true;

        console.error(`\x1b[31mAssertion Error${err.message ? ` '${err.message}'` : ""}\x1b[0m`);
        console.error(`\x1b[2m${err.stack.split("\n").slice(1).join("\n")}\x1b[0m`);
    }
}

global.assertEqual = function assertEqual(a, b, message) {
    wrapAssertion(() => deepEqual(a, b, message), assertEqual);
}

global.test = async function(title, cb) {
    console.log(`\x1b[2m> ${title}\x1b[0m`);

    process.on("exit", code => {
        code
            ? console.error(`\x1b[31mTests failed (exit code ${code}).\x1b[0m`)
            : console.log(`\x1b[32mTests succeeded.\x1b[0m`);
    });

    try {
        await cb();
    } catch(err) {
        console.error(err);

        hasError = true;
    }

    hasError && (process.exitCode = 1);
}

global.runBrowser = async function(url, inPageCallback, inPageCallbackArgs = [], options = {}) {
    const optionsWithDefaults = {
        viewport: [ 800, 600 ],

        ...options
    };

    const browser = await puppeteer.launch({
        args: [
            `--window-size=${optionsWithDefaults.viewport[0]},${optionsWithDefaults.viewport[1]}`,
            '--allow-file-access-from-files',
            '--disable-web-security'
        ],
        defaultViewport: null,
        headless: HEADLESS
    });

    activeBrowsers.add(browser);

    try {
        const page = (await browser.pages())[0];

        page.on("pageerror", err => console.error(err));

        await page.evaluateOnNewDocument(
            (await readFile(join(import.meta.dirname, "../dist/api.browser.js"))).toString()
        );

        await page.goto(url, {
            waitUntil: "load"
        });

        const result = await page.evaluate(inPageCallback, ...inPageCallbackArgs);

        !KEEPALIVE
            && await new Promise(r => setTimeout(async () => {
                await browser.close();
                activeBrowsers.delete(browser);
                r();
            }, HEADLESS ? 0 : NO_HEADLESS_TIMEOUT));

        return result;
    } catch(err) {
        try {
            await browser.close();

            activeBrowsers.delete(browser);
        } catch (err) {
            console.error(err);
        }

        throw err;
    }
}