import { checkInteractivity } from "./check-interactivity.js";
import { type InteractivityChecks, type InteractivityResult } from "./types.js";


const CASCADING_NON_INTERACTIVITY_CHECKS: ReadonlySet<keyof InteractivityChecks | "notElement"> = new Set([
    "disconnected",
    "hidden",
    "inert",
    "ariaHidden",
    "invisible"
]);


function cloneWithShadow(node: Element): Element {
    const clone: Element = node.cloneNode(false) as Element;

    const shadow: ShadowRoot | null = node.shadowRoot;
    if(shadow) {
        const clonedShadow: ShadowRoot = clone.attachShadow({
            mode: shadow.mode,
            serializable: true
        });

        for(let child: Element | null = shadow.firstElementChild; child; child = child.nextElementSibling) {
            clonedShadow.appendChild(cloneWithShadow(child));
        }
    }

    for(const child of node.childNodes) {
        if(child.nodeType === Node.ELEMENT_NODE) {
            clone.appendChild(cloneWithShadow(child as Element));
        } else {
            clone.appendChild(child.cloneNode(true));
        }
    }

    return clone;
}

function removeVirtual(virtual: Element): void {
    const parent: Element | ShadowRoot | null =
        virtual.parentElement ?? (virtual.parentNode as ShadowRoot | null);

    parent?.removeChild(virtual);
}

function filterDOM(
    liveElement: Element,
    virtualElement: Element,
    isRoot: boolean,
    checks: Partial<InteractivityChecks>,
    onNonInteractive?: (liveElement: Element, reason: InteractivityResult["reason"]) => void
): boolean {
    const result: InteractivityResult = checkInteractivity(liveElement, checks);

    if (onNonInteractive && !result.isInteractive) {
        onNonInteractive(liveElement, result.reason);
    }

    if(
        !result.isInteractive
        && result.reason
        && CASCADING_NON_INTERACTIVITY_CHECKS.has(result.reason)
    ) {
        if(!isRoot) removeVirtual(virtualElement);

        return false;
    }

    const pairs: [ Element, Element ][] = [];

    const liveShadow: ShadowRoot | null = liveElement.shadowRoot;
    const virtualShadow: ShadowRoot | null = virtualElement.shadowRoot;

    if(liveShadow && virtualShadow) {
        let liveChild: Element | null = liveShadow.firstElementChild;
        let virtualChild: Element | null = virtualShadow.firstElementChild;

        while(liveChild && virtualChild) {
            pairs.push([ liveChild, virtualChild ]);

            liveChild = liveChild.nextElementSibling;
            virtualChild = virtualChild.nextElementSibling;
        }
    }

    let liveChild: Element | null = liveElement.firstElementChild;
    let virtualChild: Element | null = virtualElement.firstElementChild;

    while(liveChild && virtualChild) {
        pairs.push([ liveChild,  virtualChild]);
        
        liveChild = liveChild.nextElementSibling;
        virtualChild = virtualChild.nextElementSibling;
    }

    let hasInteractiveDescendant: boolean = false;

    for(const [ liveElement, virtualElement ] of pairs) {
        if(filterDOM(liveElement, virtualElement, false, checks, onNonInteractive)) {
            hasInteractiveDescendant = true;
        }
    }

    const keep: boolean = result.isInteractive || hasInteractiveDescendant;

    if(isRoot) return keep;

    if(!keep) removeVirtual(virtualElement);

    return keep;
}


export function filterInteractive(
    dom: Document | Element,
    checks: Partial<InteractivityChecks> = {},
    virtualDOM?: Document | Element,
    onNonInteractive?: (liveElement: Element, reason: InteractivityResult["reason"]) => void
): Element {
    const liveRoot: Element = (dom instanceof Document)
        ? dom.documentElement
        : dom;
    const virtualRoot: Element = virtualDOM
        ? ((virtualDOM instanceof Document) ? virtualDOM.documentElement : virtualDOM)
        : cloneWithShadow(liveRoot);

    filterDOM(liveRoot, virtualRoot, true, checks, onNonInteractive);

    return virtualRoot;
}