# Is Interactive?

Versatile DOM element interactivity checks.

``` console
npm install webfuse-com/is-interactive
```

### Example

``` js
import { checkInteractivity, filterInteractive } from "@webfuse-com/is-interactive";

// Check if an element is interactive:
const click = targetElement => {
  const { isInteractive } = checkInteractivity(targetElement, {
    invisible: false  // disables invisible check
  });

  if(!isInteractive) return;

  automation.click(button);
};

// Create a DOM snapshot (weakly corresponding to the GUI):
const surfaceDOMSnapshot = selector => {
  return filterInteractive(document, {
    offViewport: true
  }).outerHTML;
};
```

### API

``` ts
// Toggle checks to perform (default: all enabled, except 'offViewport')
interface InteractivityChecks {
  disconnected: boolean;
  hidden: boolean;
  inert: boolean;
  disabled: boolean;
  ariaHidden: boolean;
  invisible: boolean;
  unclickable: boolean;
  collapsed: boolean;
  clipped: boolean;
  occluded: boolean;
  offViewport: boolean;
}

/**
 * Check whether an element is interactive.
 */
function checkInteractivity(element: Element, checks?: InteractivityChecks): {
  isInteractive: boolean;
  reason?:
    | "disconnected"
    | "hidden"
    | "inert"
    | "disabled"
    | "ariaHidden"
    | "invisible"
    | "unclickable"
    | "collapsed"
    | "occluded"
    | "offViewport";
}

/**
 * Filter a DOM (sub)tree for interactive elements.
 * Create a 'surface'-only DOM.
 */
function filterInteractive(dom: Document | Element, checks?: InteractivityChecks): Element
```