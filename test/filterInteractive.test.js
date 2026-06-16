import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { deepEqual } from "assert";

import puppeteer from "puppeteer";

import "./test.js";


const TEST_NAME = "filterInteractive";
const TESTS = [
    {
        name: "document"
    },
    {
        name: "subtree"
    }
];


function formatHTML(html) {
    const indentation = " ".repeat(4);

    html = html.replace(/>\s+</g, "><").trim();

    const tokens = html.match(/<!--[\s\S]*?-->|<\/?[^>]+>|[^<]+/g) || [];
    const output = [];

    let indent = 0;

    for(let token of tokens) {
        token = token.trim();

        if(!token) continue;

        const isComment = /^<!--/.test(token);
        const isClosingTag = /^<\//.test(token);
        const isOpeningTag =
            /^<[^!/][^>]*>$/.test(token) &&
            !/\/>$/.test(token) &&
            !isClosingTag;
        const isVoidTag = /^<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)\b/i.test(token);
        const isInlinePair = /^<[^/!][^>]*>.*<\/[^>]+>$/.test(token);

        if(isClosingTag) {
            indent--;
        }

        output.push(indentation.repeat(Math.max(indent, 0)) + token);

        if(
            isOpeningTag &&
            !isVoidTag &&
            !isInlinePair
        ) {
            indent++;
        }
    }

    return output.join("\n");
}

function normalizeHTML(html) {
    return html
        .replace(/>\s+/g, '>')
        .replace(/\s+</g, '<')
        .replace(/\s+/g, ' ')
        .trim();
}


test("filterInteractive()", async () => {
    await Promise.all(
        TESTS
            .map(async reference => {
                const testFileURL = `file://${join(import.meta.dirname, TEST_NAME, `${reference.name}.test.html`)
                    }`;

                const returnValue = await runBrowser(testFileURL, async () => {
                    const TARGET_ELEMENT_KEY = "TARGET";

                    try {
                        const filtered = window.IsInteractive.filterInteractive(
                            (
                                window[TARGET_ELEMENT_KEY]
                                ?? document.querySelector(`#${TARGET_ELEMENT_KEY}`)
                            )
                                ?? document,
                            {
                                ariaHidden: true,
                                offScrolled: true,
                                offViewport: true
                            },
                            null,
                            (element, reason) => console.debug(element, reason)
                        );

                        const wrapper = document.createElement('div');

                        wrapper.appendChild(filtered);

                        return {
                            result: wrapper.getHTML({
                                serializableShadowRoots: true
                            })
                        };
                    } catch (err) {
                        return {
                            error: err?.message || String(err)
                        };
                    }
                });

                if (returnValue.error) {
                    console.error(`\x1b[31m${returnValue.error}\x1b[0m`);

                    process.exit(2);
                }

                console.log(`\x1b[2m• '${reference.name}'\x1b[0m`);

                const actual = returnValue.result;

                await writeFile(
                    join(import.meta.dirname, TEST_NAME, `${reference.name}.actual.test.html`),
                    formatHTML(actual)
                );

                assertEqual(
                    normalizeHTML(actual),
                    normalizeHTML(
                        (await readFile(
                            join(import.meta.dirname, TEST_NAME, `${reference.name}.expected.test.html`))
                        ).toString()
                    ),
                    "Invalid filtered DOM"
                );
            })
    );
});