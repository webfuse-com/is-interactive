import { join } from "path";
import { deepEqual as assertEqual, ok } from "assert";


const TESTS = [
    // TODO: List test file names
];


function wrapAssertion(cb, actual = null, expected = null, relationHint = null) {
    try {
        cb();
    } catch(err) {
        if(err.code !== "ERR_ASSERTION") {
            console.error(err);

            process.exit(1);
        }

        console.error(`\x1b[31mAssertion Error${err.message ? ` '${err.message}'` : ""}\x1b[0m`);
        console.log(`\x1b[2mEXPECTED${relationHint ? ` (${relationHint})` : ""}:\x1b[0m`, expected ?? err.expected);
        console.log("\x1b[2mACTUAL:\x1b[0m", actual ?? err.actual);

        process.exit(2);
    }
}


global.assertEqual = function(a, b, message) {
    wrapAssertion(() => assertEqual(a, b, message));
}

global.assertIn = function(a, b, message) {
    wrapAssertion(() => ok(b.includes(a), message), a, b, "in");
}


process.on("exit", code => {
    code
        ? console.error(`\x1b[31mTests failed (exit code ${code}).\x1b[0m`)
        : console.log(`\x1b[32mTests succeeded.\x1b[0m`);
});


TESTS
    .forEach(async reference => {
        await import(
            join(import.meta.dirname, reference.replace(/(\.test\.js)?$/i, ".test.js"))
        );
    });