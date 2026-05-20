import { readFile } from "fs/promises";
import { join } from "path";
import { deepEqual } from "assert";

import puppeteer from "puppeteer";


const HEADLESS = !process.argv.slice(2).includes("--no-headless");

let hasError = false;


function wrapAssertion(cb) {
    try {
        cb();
    } catch(err) {
        if(err.code !== "ERR_ASSERTION") {
            console.error(err);

            process.exit(2);
        }

        hasError = true;

        console.error(`\x1b[31mAssertion Error${err.message ? ` '${err.message}'` : ""}\x1b[0m`);
    }
}

global.assertEqual = function(a, b, message) {
    wrapAssertion(() => deepEqual(a, b, message));
}

global.test = async function(title, cb) {
    console.log(`\x1b[2m> ${title}\x1b[0m`);

    process.on("exit", code => {
        code
            ? console.error(`\x1b[31mTests failed (exit code ${code}).\x1b[0m`)
            : console.log(`\x1b[32mTests succeeded.\x1b[0m`);
    });

    await cb();

    hasError && process.exit(1);
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

    const page = (await browser.pages())[0];

    await page.evaluateOnNewDocument(
        (await readFile(join(import.meta.dirname, "../dist/api.browser.js"))).toString()
    );

    return new Promise(async resolve => {
        await page.goto(url, {
            waitUntil: "load"
        });

        const result = await page.evaluate(inPageCallback, ...inPageCallbackArgs);

        await new Promise(r => setTimeout(async () => {
            await browser.close();

            r();
        }, optionsWithDefaults.headless ? 0 : 2000));

        resolve(result);
    });
}