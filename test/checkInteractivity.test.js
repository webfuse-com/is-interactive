import { join } from "path";

import puppeteer from "puppeteer";

import "./test.js";


const TEST_NAME = "checkInteractivity";
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
        name: "clipped.true",
        expected: {
            isInteractive: true
        }
    },
    {
        name: "clipped.false",
        expected: {
            isInteractive: false,
            reason: "clipped"
        }
    },
    {
        name: "clipped.scrollable.true",
        expected: {
            isInteractive: true
        }
    },
    {
        name: "clipped.scrollable.false",
        expected: {
            isInteractive: false,
            reason: "clipped"
        }
    },
    {
        name: "collapsed",
        expected: {
            isInteractive: false,
            reason: "collapsed"
        }
    },
    {
        name: "collapsed.overflow",
        expected: {
            isInteractive: true
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
        name: "disabled.fieldset",
        expected: {
            isInteractive: false,
            reason: "disabled"
        }
    },
    {
        name: "disabled.arbitrary",
        expected: {
            isInteractive: true
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
        name: "hidden.true.1",
        expected: {
            isInteractive: true
        }
    },
    {
        name: "hidden.true.2",
        expected: {
            isInteractive: true
        }
    },
    {
        name: "hidden.false",
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
        name: "invisible.opacity",
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
    },
    {
        name: "offViewport.full",
        expected: {
            isInteractive: false,
            reason: "offViewport"
        }
    },
    {
        name: "offViewport.partial",
        expected: {
            isInteractive: true
        }
    },
    {
        name: "unclickable",
        expected: {
            isInteractive: false,
            reason: "unclickable"
        }
    },
    {
        name: "unclickable.restore.true",
        expected: {
            isInteractive: true
        }
    },
    {
        name: "unclickable.restore.false",
        expected: {
            isInteractive: false,
            reason: "unclickable"
        }
    }
];


test("checkInteractivity()", async () => {
    await Promise.all(
        TESTS
            .map(async reference => {
                const testFileURL = `file://${
                    join(import.meta.dirname, TEST_NAME, `${reference.name}.test.html`)
                }`;

                const returnValue = await runBrowser(testFileURL, async () => {
                    const TARGET_ELEMENT_KEY = "TARGET";

                    try {
                        return {
                            result: window.IsInteractive.checkInteractivity(
                                window[TARGET_ELEMENT_KEY]
                                ?? document.querySelector(`#${TARGET_ELEMENT_KEY}`),
                                {
                                    offViewport: true
                                }
                            )
                        };
                    } catch(err) {
                        return {
                            error: err?.message || String(err)
                        };
                    }
                });

                if(returnValue.error) {
                    console.error(`\x1b[31m${returnValue.error}\x1b[0m`);

                    process.exit(2);
                }

                console.log(`\x1b[2m• '${reference.name}'\x1b[0m`);

                const actual = returnValue.result;

                if(!("isInteractive" in actual)) throw new SyntaxError(`Invalid test value (actual): ${String(actual)}`);

                assertEqual(
                    actual.isInteractive,
                    reference.expected.isInteractive,
                    `Element is${!actual.isInteractive ? " not" : ""} interactive`
                );

                !reference.assertSuccess
                    && assertEqual(
                        actual.reason,
                        reference.expected.reason,
                        `Invalid failure reason: '${actual.reason}'`
                    );
            })
    );
});