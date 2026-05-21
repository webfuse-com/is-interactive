window.DEMO = (() => {
    function readCheckbox(name) {
        const inputElement = document.querySelector(`input[name="${name}"]`);

        return inputElement.checked;
    }

    let elementCount = 0;
    const checks = Object.fromEntries(
        [ ...document.querySelectorAll("input[name]") ]
            .map(inputElement => {
                const name = inputElement.getAttribute("name").trim();

                return [ name, readCheckbox(name) ];
            })
    );

    const exports = {};

    exports.addElement = function() {
        const css = document.querySelector('#controls-css').value;

        const element = document.createElement("div");

        element.id = String(elementCount++);
        element.style.cssText = `
            background-color: #${
                Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0")
            };

            ${css}
        `;

        document.querySelector("demo-page")
            .shadowRoot
            .querySelector("main")
            .appendChild(element);

        element.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "center"
        });

        const cssID = `#${element.id}`;

        document.querySelector('#controls-id').value = cssID;

        const hoverElement = document.createElement("span");

        hoverElement.textContent = cssID;

        const highlightElement = () => {
            element.classList.toggle("highlight");

            element.scrollIntoView({
                behavior: "smooth",
                block: "center",
                inline: "center"
            });
        };
        hoverElement.addEventListener("mouseenter", highlightElement);
        hoverElement.addEventListener("mouseleave", highlightElement);
        hoverElement.addEventListener("click", () => {
            document.querySelector('#controls-id').value = cssID;
        });

        document.querySelector('#controls-ids')
            .appendChild(hoverElement);
    }

    exports.toggleCheck = function(name) {
        checks[name] = readCheckbox(name);
    }

    exports.checkInteractivity = function() {
        const feedbackElement = document.querySelector("#controls-result-checkInteractivity");

        try {
            const id = document.querySelector('#controls-id').value;

            const element = document.querySelector("demo-page")
                .shadowRoot
                .getElementById(id.trim().replace(/^#?/, ""));

            const interactivity = IsInteractive.checkInteractivity(
                element,
                checks
            );

            feedbackElement.classList.remove("error");
            feedbackElement.textContent = JSON.stringify(interactivity, null, 2);
        } catch(err) {
            feedbackElement.classList.add("error");
            feedbackElement.textContent = err?.message ?? String(err);
        }
    }

    exports.filterInteractive = function() {
        const feedbackElement = document.querySelector("#controls-result-filterInteractive");

        try {
            const interactiveDOM = IsInteractive.filterInteractive(
                document.querySelector("demo-page").shadowRoot.querySelector("main"),
                checks
            );

            console.log(interactiveDOM);

            feedbackElement.classList.remove("error");
            feedbackElement.textContent = `DOM size: ${interactiveDOM.outerHTML.length} B (see console).`;
        } catch(err) {
            feedbackElement.classList.add("error");
            feedbackElement.textContent = err?.message ?? String(err);
        }
    }

    return exports;
})();