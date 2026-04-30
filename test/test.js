import { readFile } from "fs/promises";
import { join } from "path";
import { deepEqual } from "assert";

import puppeteer from "puppeteer";


const HEADLESS = !process.argv.slice(2).includes("--no-headless");
const TESTS = [
    {
        name: "notElement",
        expected: {
            isInteractive: false,
            reason: "notElement"
        }
    },
    {
        name: "ariaHidden",
        expected: {
            isInteractive: false,
            reason: "ariaHidden"
        }
    },
    {
        name: "disabled",
        expected: {
            isInteractive: false,
            reason: "disabled"
        }
    },
    {
        name: "disconnected",
        expected: {
            isInteractive: false,
            reason: "disconnected"
        }
    },
    {
        name: "hidden",
        expected: {
            isInteractive: false,
            reason: "hidden"
        }
    },
    {
        name: "inert",
        expected: {
            isInteractive: false,
            reason: "inert"
        }
    },
    {
        name: "invisible.display",
        expected: {
            isInteractive: false,
            reason: "invisible"
        }
    },
    {
        name: "invisible.visibility",
        expected: {
            isInteractive: false,
            reason: "invisible"
        }
    },
    {
        name: "occluded.full",
        expected: {
            isInteractive: false,
            reason: "occluded"
        }
    },
    {
        name: "occluded.partial",
        expected: {
            isInteractive: true
        }
    }
];


let hasError = false;


async function runBrowser(url, inPageCallback, inPageCallbackArgs = [], options = {}) {
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
        headless: false
    });

    const page = (await browser.pages())[0];

    await page.evaluateOnNewDocument(
        (await readFile(join(import.meta.dirname, "../dist/api.browser.js"))).toString()
    );

    return new Promise(async resolve => {
        page.on("domcontentloaded", async () => {
            const result = await page.evaluate(inPageCallback, ...inPageCallbackArgs);

            await new Promise(r => setTimeout(async () => {
                await browser.close();

                r();
            }, optionsWithDefaults.headless ? 0 : 2000));

            resolve(result);
        });

        await page.goto(url, {
            waitUntil: "load"
        });
    });
}

function wrapAssertion(cb, actual = null, expected = null) {
    try {
        cb();
    } catch(err) {
        if(err.code !== "ERR_ASSERTION") {
            console.error(err);

            process.exit(2);
        }

        hasError = true;

        console.error(`\x1b[31mAssertion Error${err.message ? ` '${err.message}'` : ""}\x1b[0m`);
        console.log(`\x1b[2mEXPECTED:\x1b[0m`, expected ?? err.expected);
        console.log("\x1b[2mACTUAL:\x1b[0m", actual ?? err.actual);
    }
}

function assertEqual(a, b, message) {
    wrapAssertion(() => deepEqual(a, b, message));
}


process.on("exit", code => {
    code
        ? console.error(`\x1b[31mTests failed (exit code ${code}).\x1b[0m`)
        : console.log(`\x1b[32mTests succeeded.\x1b[0m`);
});


await Promise.all(
    TESTS
        .map(async reference => {
            console.log(`\x1b[2m• '${reference.name}'\x1b[0m`);

            const testFileURL = `file://${
                join(import.meta.dirname, `${reference.name.replace(/(\.test\.html)?$/i, ".test.html")}`)
            }`;

            const returnValue = await runBrowser(testFileURL, async () => {
                const TARGET_ELEMENT_ID = "TARGET";

                try {
                    return {
                        result: window.isInteractive(document.querySelector(`#${TARGET_ELEMENT_ID}`))
                    };
                } catch(err) {
                    return {
                        error: err?.message || String(err)
                    };
                }
            }, [], {
                headless: HEADLESS
            });

            if(returnValue.error) {
                console.error(`\x1b[31m${returnValue.error}\x1b[0m`);

                process.exit(2);
            }

            const actual = returnValue.result;

            if(!("isInteractive" in actual)) throw new SyntaxError(`Invalid test value (actual): ${String(actual)}`);

            assertEqual(
                actual.isInteractive,
                reference.expected.isInteractive,
                `Element is${reference.assertSuccess ? " not" : ""} interactive`
            );

            !reference.assertSuccess
                && assertEqual(
                    actual.reason,
                    reference.expected.reason,
                    `Invalid failure reason: '${actual.reason}'`
                );
        })
);


hasError && process.exit(1);