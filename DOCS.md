# Is Interactive? API

`is-interactive` is a typed JavaScript library that decides whether web elements are surfaced by the UI (perceivable and potentially actionable) and filters DOM trees down to those elements.

## Installation

#### Module

``` console
npm install webfuse-com/is-interactive
```

``` js
import { checkInteractivity, filterInteractive } from "@webfuse-com/is-interactive";
```

#### Browser

``` html
<script src="dist/api.browser.js"></script>
```

> The browser bundle exposes the API via the global `window.IsInteractive`.

## Checking Functions

### `checkInteractivity()`

Check whether a single element is interactive.

``` ts
function checkInteractivity(
  element: Element,
  checks?: Partial<InteractivityChecks>,
  options?: Partial<InteractivityOptions>
): InteractivityResult
```

#### Parameters

| Parameter | Description | Range |
| :- | :- | :- |
| `element` | Element to check. Anything other than an element node yields reason `notElement`. | `Element` |
| `checks` | Checks to perform; omitted checks use their defaults (see [Checks](#checks)). | `Partial<InteractivityChecks>` |
| `options.skipParentChecks` | Skip the ancestor walks of the checks whose failure is inherited from ancestors (`hidden`, `inert`, `ariaHidden`, `unrendered`): only the element itself is checked. Use it when the ancestors are known to pass already. Conditions that depend on the direct parent's state (unassigned slot content, closed `<details>`) are still checked. | `boolean`; default `false` |

#### Return Value

``` ts
type InteractivityResult = {
  isInteractive: boolean;
  reason?: "notElement" | keyof InteractivityChecks;
}
```

| Property | Description |
| :- | :- |
| `isInteractive` | Whether the element passed every enabled check. |
| `reason` | The first failing check, in check order (see [Checks](#checks)); absent if interactive. |

#### Examples

``` ts
const { isInteractive, reason } = checkInteractivity(document.querySelector("#signup"));

// Ignore occlusion, also reject elements outside the viewport
checkInteractivity(button, { occluded: false, offViewport: true });

// Children of an element known to pass: skip the ancestor walks
checkInteractivity(child, {}, { skipParentChecks: true });
```

### `filterInteractive()`

Filter a DOM (sub)tree for interactive elements. The result is a copy that contains only interactive elements and the ancestors needed to keep them in place: a "surface" DOM.

``` ts
function filterInteractive(
  dom: Document | Element,
  checks?: Partial<InteractivityChecks>,
  elementOverrideChecks?: { [ tagName: string ]: Partial<InteractivityChecks> } | Map<string, Partial<InteractivityChecks>>,
  virtualDOM?: Document | Element,
  onNonInteractive?: (liveElement: Element, reason: InteractivityResult["reason"]) => void
): Element
```

#### Parameters

| Parameter | Description | Range |
| :- | :- | :- |
| `dom` | Document or subtree to filter. A document is filtered from its root element. | `Document`, `Element` |
| `checks` | Checks to perform on every element; omitted checks use their defaults. | `Partial<InteractivityChecks>` |
| `elementOverrideChecks` | Per-tag check overrides, keyed by tag name (case-insensitive). They apply to the element and, for cascading checks, to its descendants (see [Overrides](#overrides)). | object, `Map`; default: see below |
| `virtualDOM` | Copy to filter in place instead of a fresh clone. Must mirror `dom` node by node; elements are paired by position. | `Document`, `Element`; default: a clone of `dom` |
| `onNonInteractive` | Called for every non-interactive element with its reason, in document order. Elements removed with a cascading ancestor are not visited. | function |

The default `elementOverrideChecks` keeps styled form controls, which are often deliberately hidden or covered by custom UI that takes their clicks:

``` ts
{
  "input":  { clipped: false, collapsed: false, invisible: false, occluded: false, unrendered: false },
  "select": { clipped: false, collapsed: false, invisible: false, occluded: false, unrendered: false }
}
```

> See [Limitations](#limitations): overrides passed as a `Map`, which includes this default, are currently not applied.

#### Return Value

The root of the filtered copy (for a document, its root element). Open shadow roots are copied as serialisable, so `element.getHTML({ serializableShadowRoots: true })` includes them. The root itself is always kept.

#### Examples

``` ts
// Surface DOM of the current viewport
const snapshot = filterInteractive(document, { offViewport: true }).outerHTML;

// A subtree, with reasons for what is dropped
const reasons = new Map();
const form = filterInteractive(document.querySelector("form"), {}, undefined, undefined,
  (element, reason) => reasons.set(element, reason));

// Own overrides: keep aria-hidden spans and their contents
filterInteractive(document, { ariaHidden: true }, { span: { ariaHidden: false } });
```

## Checks

`InteractivityChecks` toggles each check. In check order (the first failing one becomes the reason):

| Check | Fails when | Default | Cascades in `filterInteractive` |
| :- | :- | :- | :- |
| `disconnected` | The element is not connected to a document. | `true` | x |
| `modalBlocked` | A modal dialog is open (also inside open shadow roots), and the element is not inside a modal dialog. | `true` | |
| `hidden` | The element or a flat-tree ancestor has the `hidden` attribute and computes to `display: none`. | `true` | x |
| `inert` | The element or a flat-tree ancestor is `inert`. | `true` | x |
| `disabled` | The element matches `:disabled` (including through a disabled `<fieldset>`), or it or an ancestor has `aria-disabled="true"`. | `true` | |
| `ariaHidden` | The element or an ancestor has `aria-hidden="true"`. | `false` | x |
| `unclickable` | The element computes to `pointer-events: none`. | `true` | |
| `invisible` | The element computes to `visibility: hidden` or `collapse`. A descendant with `visibility: visible` is not affected. | `true` | |
| `unrendered` | The element or a flat-tree ancestor computes to `display: none`, `opacity: 0` or `content-visibility: hidden`. Also: a light DOM child of a shadow host that is assigned to no slot, and content of a closed `<details>` other than its summary. | `true` | x |
| `collapsed` | The element's box has zero width or height, and either clips its overflow or has no content but whitespace. | `true` | |
| `clipped` | The element lies entirely outside the visible box of an ancestor that clips overflow (respecting containing blocks), outside a scroll container's scrollable area, or outside the document (fixed elements: outside the viewport). | `true` | |
| `offScrolled` | The element is in the scrollable area of a scroll container but currently scrolled out of its view. | `false` | |
| `offViewport` | The element lies entirely outside the viewport. | `false` | |
| `occluded` | Other elements cover the element entirely (see [Occlusion](#occlusion)). | `true` | |

> For the options of a single-line `<select>`, the geometry checks (`collapsed` to `occluded`) use the `<select>` itself.

> `offScrolled` and `offViewport` are off by default to consider the full document; enable them for a snapshot of what is currently in view. `ariaHidden` is off by default because it may only concern non-visual navigation.

## Overrides

`elementOverrideChecks` maps tag names to partial checks:

| Behaviour | Description |
| :- | :- |
| Precedence | Overrides win over `checks` for elements with that tag. |
| Inheritance | Overrides of cascading checks propagate to all descendants. A deeper override of the same check wins. |
| Rescue | A subtree that fails a cascading check is kept for traversal if it contains an element whose override disables that check. The other elements in it still fail on their own. |

``` ts
// Custom checkboxes: the real <input> is invisible and covered by its label's styling
filterInteractive(document, {}, {
  input: { invisible: false, unrendered: false, occluded: false }
});
```

## Shadow DOM

| Behaviour | Description |
| :- | :- |
| Flat tree | Ancestor walks, clipping and scrolling follow assigned slots, then shadow hosts. |
| Filtering | Open shadow roots are traversed and copied (serialisable). |
| Modal dialogs | Open modals inside open shadow roots block the rest of the page. |
| Closed shadow roots | Cannot be inspected: their contents are not filtered, and content slotted into them is assessed as if placed in the host. Closed `<details>` are handled explicitly. |

## Types

Types are provided for TypeScript usage:

``` ts
import type { InteractivityChecks, InteractivityOptions, InteractivityResult } from "@webfuse-com/is-interactive";
```

| Type | Description |
| :- | :- |
| `InteractivityChecks` | One boolean per check (see [Checks](#checks)). Functions take it as `Partial`. |
| `InteractivityOptions` | `skipParentChecks`. |
| `InteractivityResult` | Result of `checkInteractivity()`. |