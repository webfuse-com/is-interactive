import { join } from "path";

import puppeteer from "puppeteer";

import "./test.js";


const TEST_NAME = "checkInteractivity";
const TESTS = [
    {
        name: "ariaHidden",
        check: "ariaHidden",
        expected: false
    },
    {
        name: "ariaHidden.slot",
        check: "ariaHidden",
        expected: false
    },
    {
        name: "ariaHidden.parent",
        check: "ariaHidden",
        expected: false,
        variants: [
            {
                options: { skipParentChecks: true },
                expected: true
            }
        ]
    },
    {
        name: "clipped.true.1",
        check: "clipped",
        expected: true
    },
    {
        name: "clipped.true.2",
        check: "clipped",
        expected: true
    },
    {
        name: "clipped.true.3",
        check: "clipped",
        expected: true
    },
    {
        name: "clipped.true.4",
        check: "clipped",
        expected: true
    },
    {
        name: "clipped.false.1",
        check: "clipped",
        expected: false
    },
    {
        name: "clipped.false.2",
        check: "clipped",
        expected: false
    },
    {
        name: "clipped.false.3",
        check: "clipped",
        expected: false
    },
    {
        name: "clipped.slot",
        check: "clipped",
        expected: false
    },
    {
        name: "collapsed",
        check: "collapsed",
        expected: false
    },
    {
        name: "collapsed.overflow",
        check: "collapsed",
        expected: true
    },
    {
        name: "disabled",
        check: "disabled",
        expected: false
    },
    {
        name: "disabled.fieldset",
        check: "disabled",
        expected: false
    },
    {
        name: "disabled.arbitrary",
        check: "disabled",
        expected: true
    },
    {
        name: "disabled.slot",
        check: "disabled",
        expected: false
    },
    {
        name: "disabled.parent",
        check: "disabled",
        expected: false,
        variants: [
            {
                options: { skipParentChecks: true },
                expected: false
            }
        ]
    },
    {
        name: "disconnected",
        check: "disconnected",
        expected: false
    },
    {
        name: "hidden.true.1",
        check: "hidden",
        expected: true
    },
    {
        name: "hidden.true.2",
        check: "hidden",
        expected: true
    },
    {
        name: "hidden.false",
        check: "hidden",
        expected: false
    },
    {
        name: "hidden.slot",
        check: "hidden",
        expected: false
    },
    {
        name: "hidden.parent",
        check: "hidden",
        expected: false,
        variants: [
            {
                options: { skipParentChecks: true },
                expected: true
            }
        ]
    },
    {
        name: "inert",
        check: "inert",
        expected: false
    },
    {
        name: "inert.slot",
        check: "inert",
        expected: false
    },
    {
        name: "inert.parent",
        check: "inert",
        expected: false,
        variants: [
            {
                options: { skipParentChecks: true },
                expected: true
            }
        ]
    },
    {
        name: "invisible.display",
        check: "invisible",
        expected: false
    },
    {
        name: "invisible.opacity",
        check: "invisible",
        expected: false
    },
    {
        name: "invisible.visibility",
        check: "invisible",
        expected: false
    },
    {
        name: "invisible.slot",
        check: "invisible",
        expected: false
    },
    {
        name: "invisible.parent",
        check: "invisible",
        expected: false,
        variants: [
            {
                options: { skipParentChecks: true },
                expected: true
            }
        ]
    },
    {
        name: "invisible.self",
        check: "invisible",
        expected: false,
        variants: [
            {
                options: { skipParentChecks: true },
                expected: false
            }
        ]
    },
    {
        name: "modalBlocked.true.1",
        check: "modalBlocked",
        expected: true
    },
    {
        name: "modalBlocked.true.2",
        check: "modalBlocked",
        expected: true
    },
    {
        name: "modalBlocked.false",
        check: "modalBlocked",
        expected: false
    },
    {
        name: "notElement",
        check: "notElement",
        expected: false
    },
    {
        name: "occluded.false",
        check: "occluded",
        expected: false
    },
    {
        name: "occluded.true.1",
        check: "occluded",
        expected: true
    },
    {
        name: "occluded.true.2",
        check: "occluded",
        expected: true
    },
    {
        name: "offScrolled.false",
        check: "offScrolled",
        expected: false
    },
    {
        name: "offScrolled.true",
        check: "offScrolled",
        expected: true
    },
    {
        name: "offViewport.false",
        check: "offViewport",
        expected: false
    },
    {
        name: "offViewport.true",
        check: "offViewport",
        expected: true
    },
    {
        name: "unclickable",
        check: "unclickable",
        expected: false
    },
    {
        name: "unclickable.restore.true",
        check: "unclickable",
        expected: true
    },
    {
        name: "unclickable.restore.false",
        check: "unclickable",
        expected: false
    }
];


test("checkInteractivity()", async () => {
    await Promise.all(
        TESTS
            .map(async reference => {
                const testFileURL = `file://${
                    join(import.meta.dirname, TEST_NAME, `${reference.name}.test.html`)
                }`;

                // Base case and option variants share one page load
                const cases = [
                    {
                        options: {},
                        expected: reference.expected
                    },
                    ...(reference.variants ?? [])
                ];

                const returnValues = await runBrowser(testFileURL, async (check, optionsList) => {
                    const TARGET_ELEMENT_KEY = "TARGET";

                    return optionsList
                        .map(options => {
                            try {
                                return {
                                    result: window.IsInteractive.checkInteractivity(
                                        window[TARGET_ELEMENT_KEY]
                                        ?? document.querySelector(`#${TARGET_ELEMENT_KEY}`),
                                        {
                                            clipped: false,
                                            collapsed: false,
                                            disabled: false,
                                            disconnected: false,
                                            hidden: false,
                                            inert: false,
                                            invisible: false,
                                            modalBlocked: false,
                                            occluded: false,
                                            unclickable: false,
                                            ariaHidden: false,
                                            offScrolled: false,
                                            offViewport: false,

                                            // only enable tested check
                                            [ check ]: true,
                                        },
                                        options
                                    )
                                };
                            } catch(err) {
                                return {
                                    error: err?.message || String(err)
                                };
                            }
                        });
                }, [ reference.check, cases.map(testCase => testCase.options) ]);

                cases
                    .forEach((testCase, index) => {
                        const returnValue = returnValues[index];
                        const label = Object.keys(testCase.options).length
                            ? `${reference.name} ${JSON.stringify(testCase.options)}`
                            : reference.name;

                        if(returnValue.error) {
                            console.error(`\x1b[31m${returnValue.error}\x1b[0m`);

                            process.exit(2);
                        }

                        console.log(`\x1b[2m• '${label}'\x1b[0m`);

                        const actual = returnValue.result;

                        if(!("isInteractive" in actual)) throw new SyntaxError(`Invalid test value (actual): ${String(actual)}`);

                        assertEqual(
                            actual.isInteractive,
                            testCase.expected,
                            `${label}: Element is${!actual.isInteractive ? " not" : ""} interactive`
                        );

                        (!actual.isInteractive && !testCase.expected)
                            && assertEqual(
                                actual.reason,
                                reference.check,
                                `${label}: Invalid failure reason: '${actual.reason}'`
                            );
                    });
            })
    );
});