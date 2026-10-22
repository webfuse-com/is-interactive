import { join } from "path";

import "./test.js";


const TEST_NAME = "scrollEvents";


test("scroll events", async () => {
    const testFileURL = `file://${join(import.meta.dirname, TEST_NAME, "scroll.test.html")}`;

    const returnValue = await runBrowser(testFileURL, async () => {
        const nextFrames = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

        const container = document.querySelector("#CONTAINER");
        const target = document.querySelector("#TARGET");
        const events = {
            container: 0,
            document: 0
        };

        try {
            container.addEventListener("scroll", () => events.container++);
            container.addEventListener("scrollend", () => events.container++);
            document.addEventListener("scroll", () => events.document++);
            document.addEventListener("scrollend", () => events.document++);

            // Both scroll the container and the window temporarily
            window.IsInteractive.checkInteractivity(target);
            window.IsInteractive.filterInteractive(document);

            await nextFrames();

            const temporary = { ...events };

            window.IsInteractive.checkInteractivity(target);

            // Genuine scroll within the same frame
            container.scrollTop = 10;

            await nextFrames();

            return {
                result: {
                    temporary,
                    genuine: events.container - temporary.container
                }
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

    console.log(`\x1b[2m• 'scroll'\x1b[0m`);

    assertEqual(
        returnValue.result.temporary,
        { container: 0, document: 0 },
        "Scroll events of temporary scrolling are not suppressed"
    );
    assertEqual(
        returnValue.result.genuine,
        2,
        "Scroll events of genuine scrolling are suppressed"
    );
});
