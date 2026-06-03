import { checkInteractivity } from "./check-interactivity.js";
import { type InteractivityChecks, type InteractivityResult } from "./types.js";


const CASCADING_NON_INTERACTIVITY_CHECKS: ReadonlySet<keyof InteractivityChecks | "notElement"> = new Set([
    "disconnected",
    "hidden",
    "inert",
    "ariaHidden",
    "invisible"
]);


function filterDOM(
    live: Element,
    virtual: Element,
    isRoot: boolean,
    checks: Partial<InteractivityChecks>
): boolean {
    const result: InteractivityResult = checkInteractivity(live, checks);

    if(
        !result.isInteractive
        && result.reason
        && CASCADING_NON_INTERACTIVITY_CHECKS.has(result.reason)
    ) {
        if(!isRoot) {
            virtual.parentElement?.removeChild(virtual);
        }

        return false;
    }

    const pairs: [ Element, Element ][] = [];

    let liveChild: Element | null = live.firstElementChild;
    let virtualChild: Element | null = virtual.firstElementChild;
    while(liveChild && virtualChild) {
        pairs.push([ liveChild, virtualChild ]);
        liveChild = liveChild.nextElementSibling;
        virtualChild = virtualChild.nextElementSibling;
    }

    let hasInteractiveDescendant: boolean = false;

    for(const [l, v] of pairs) {
        if(filterDOM(l, v, false, checks)) {
            hasInteractiveDescendant = true;
        }
    }

    const keep: boolean = result.isInteractive || hasInteractiveDescendant;

    if(isRoot) return keep;

    if(!keep) {
        virtual.parentElement?.removeChild(virtual);
    }

    return keep;
}

export function filterInteractive(
    dom: Document | Element,
    checks?: Partial<InteractivityChecks>,
    virtualRoot?: Element
): Element {
    checks = {
        occluded: false,

        ...checks
    };

    const liveRoot: Element = (dom instanceof Document)
        ? dom.documentElement
        : dom;
    virtualRoot ??= liveRoot.cloneNode(true) as Element;

    filterDOM(liveRoot, virtualRoot, true, checks);

    return virtualRoot;
}