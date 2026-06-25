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
  clipped: boolean;       // true
  collapsed: boolean;     // true
  disabled: boolean;      // true
  disconnected: boolean;  // true
  hidden: boolean;        // true
  inert: boolean;         // true
  invisible: boolean;     // true
  modalBlocked: boolean;  // true
  occluded: boolean;      // true
  unclickable: boolean;   // true
  ariaHidden: boolean;    // false
  offScrolled: boolean;   // false
  offViewport: boolean;   // false
}

/**
 * Check whether an element is interactive.
 */
function checkInteractivity(element: Element, checks?: InteractivityChecks): {
  isInteractive: boolean;
  reason?:
    | "notElement"
    | "clipped"
    | "collapsed"
    | "disabled"
    | "disconnected"
    | "hidden"
    | "inert"
    | "invisible"
    | "modalBlocked"
    | "occluded"
    | "unclickable"
    | "ariaHidden"
    | "offScrolled"
    | "offViewport"
}

/**
 * Filter a DOM (sub)tree for interactive elements.
 * Create a 'surface'-only DOM.
 */
function filterInteractive(dom: Document | Element, checks?: InteractivityChecks): Element
```

### Interactive Demo (pun intended)

Open [demo/demo.html](./demo/demo.html) in a browser.

<a href="./demo/demo.html">
  <img width="830" src="./.github/demo-screenshot.png">
</a>

### Meaning of _Interactive_

> Actionable ⊂ **Interactive** ⊂ All Elements

From within a web application, an element is considered interactive when it is surfaced by the UI. That means a user can perceive it and potentially act on it. Elements that are not surfaced are therefore not interactive, for instance, an input declared as hidden.

Whether an interactive element is truly actionable, however, depends on the presence of an actuation listener. Actuation listeners, including browser-native effect, such as those associated with links or checkboxes.