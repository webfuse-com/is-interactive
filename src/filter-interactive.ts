import { checkInteractivity } from "./check-interactivity.js";
import { type InteractivityChecks, type InteractivityResult } from "./types.js";


const CASCADING_NON_INTERACTIVITY_CHECKS: ReadonlySet<keyof InteractivityChecks | "notElement"> = new Set([
    "disconnected",
    "hidden",
    "inert",
    "ariaHidden",
    "invisible"
]);


function markDOM(
    live: Element,
    virtual: Element,
    marks: Map<Element, InteractivityResult>,
    checks: Partial<InteractivityChecks>
) {
    const result: InteractivityResult = checkInteractivity(live, checks);

    marks.set(virtual, result);

    if(
        !result.isInteractive
        && result.reason
        && CASCADING_NON_INTERACTIVITY_CHECKS.has(result.reason)
    ) return;

    let liveChild: Element | null = live.firstElementChild;
    let virtualChild: Element | null = virtual.firstElementChild;

    while(liveChild && virtualChild) {
        markDOM(liveChild, virtualChild, marks, checks);

        liveChild = liveChild.nextElementSibling;
        virtualChild = virtualChild.nextElementSibling;
    }
}

function restructureDOM(node: Element, isRoot: boolean, marks: Map<Element, InteractivityResult>) {
    const children: Element[] = [];

    for(let child: Element | null = node.firstElementChild; child; child = child.nextElementSibling) {
        children.push(child);
    }

    for(const child of children) {
        restructureDOM(child, false, marks);
    }

    if(isRoot) return;

    const result: InteractivityResult = marks.get(node) ?? { isInteractive: false };

    if(result.isInteractive) return;

    const parent: Element | null = node.parentElement;

    if(!parent) return;

    // Hoist element children to the parent's position.
    while(node.firstElementChild) {
        parent.insertBefore(node.firstElementChild, node);
    }

    parent.removeChild(node);
}


export function filterInteractive(dom: Document | Element, checks?: Partial<InteractivityChecks>): Element {
    checks = {
        occluded: false,

        ...checks
    };

    const liveRoot: Element = dom instanceof Document ? dom.documentElement : dom;
    const virtualRoot: Element = liveRoot.cloneNode(true) as Element;

    const marks: Map<Element, InteractivityResult> = new Map();

    // Pass 1: Mark the live DOM
    markDOM(liveRoot, virtualRoot, marks, checks);

    // Pass 1: Restructure the virtual DOM
    restructureDOM(virtualRoot, true, marks);

    return virtualRoot;
}