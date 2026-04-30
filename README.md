# Is Interactive?

Versatile DOM element interactivity checks.

``` console
npm install webfuse-com/is-interactive
```

``` js
import { checkInteractivity } from "@webfuse-com/is-interactive";

const agentClick = selector => {
    const button = document.querySelector(selector);

    const { isInteractive } = checkInteractivity(button, {
        offViewport: false  // disables off-viewport check
    });

    isInteractive
        ? automation.click(button)
        // Retry in next agent iteration
        : queue(() => agentClick(selector));
};
```

### API

``` ts
function checkInteractivity(element: Element, checks?: {
    // Toggle checks to perform (default: all enabled)
    disconnected: boolean;
    hidden: boolean;
    inert: boolean;
    disabled: boolean;
    ariaHidden: boolean;
    invisible: boolean;
    unclickable: boolean;
    collapsed: boolean;
    offViewport: boolean;
    occluded: boolean;
}): {
    isInteractive: boolean;
    reason?: "disabled" | "hidden" | "occluded" | '...'
```