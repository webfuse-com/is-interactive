import { checkInteractivity } from "./check-interactivity.js";
import { type InteractivityChecks, type InteractivityResult } from "./types.js";


const CASCADING_NON_INTERACTIVITY_CHECKS: ReadonlySet<keyof InteractivityChecks | "notElement"> = new Set([
    "disconnected",
    "hidden",
    "inert",
    "ariaHidden",
    "invisible"
]);
const DEFAULT_FILTER_OVERRIDE_INTERACTIVITY_CHECKS: Map<string, Partial<InteractivityChecks>> = new Map(
    Object.entries({
        // Do not filter 'styled' inputs (commonly deliberately hidden or occluded by click-through custom UI)
        "input": {
            clipped: false,
            collapsed: false,
            hidden: false,
            invisible: false,
            occluded: false,
        }
    })
);


function pickCascading(overrides: Partial<InteractivityChecks>): Partial<InteractivityChecks> {
    return Object.fromEntries(
        Object.entries(overrides)
            .filter((entry: [ string, unknown ]) => CASCADING_NON_INTERACTIVITY_CHECKS.has(entry[0] as keyof InteractivityChecks))
    );
}

function collectRescueSelectors(
    elementOverrideChecks: Map<string, Partial<InteractivityChecks>>
): Map<string, string> {
    const tagNamesByReason: Map<string, string[]> = new Map();

    for(const [ tagName, overrides ] of elementOverrideChecks) {
        for(const [ check, isEnabled ] of Object.entries(pickCascading(overrides))) {
            if(isEnabled !== false) continue;

            const tagNames: string[] = tagNamesByReason.get(check) ?? [];

            tagNames.push(tagName);
            tagNamesByReason.set(check, tagNames);
        }
    }

    return new Map(
        [ ...tagNamesByReason ]
            .map((entry: [ string, string[] ]) => [ entry[0], entry[1].join(",") ] as [ string, string ])
    );
}

function containsDeep(root: Element | ShadowRoot, selector: string): boolean {
    if(root.querySelector(selector)) return true;

    const shadow: ShadowRoot | null = (root instanceof Element) ? root.shadowRoot : null;

    if(shadow && containsDeep(shadow, selector)) return true;

    for(const descendant of root.querySelectorAll("*")) {
        if(descendant.shadowRoot && containsDeep(descendant.shadowRoot, selector)) return true;
    }

    return false;
}

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
    inheritedChecks: Partial<InteractivityChecks>,
    elementOverrideChecks: Map<string, Partial<InteractivityChecks>>,
    rescueSelectors: Map<string, string>,
    onNonInteractive?: (liveElement: Element, reason: InteractivityResult["reason"]) => void
): boolean {
    const overrides: Partial<InteractivityChecks> = elementOverrideChecks.get(liveElement.tagName.toLowerCase()) ?? {};

    const applicableChecks: Partial<InteractivityChecks> = {
        ...checks,
        ...inheritedChecks,
        ...overrides
    };

    // Cascading overrides propagate; deeper explicit statements win
    const descendantChecks: Partial<InteractivityChecks> = Object.keys(overrides).length
        ? { ...inheritedChecks, ...pickCascading(overrides) }
        : inheritedChecks;

    const result: InteractivityResult = checkInteractivity(liveElement, applicableChecks);

    if(onNonInteractive && !result.isInteractive) {
        onNonInteractive(liveElement, result.reason);
    }

    if(
        !result.isInteractive
        && result.reason
        && CASCADING_NON_INTERACTIVITY_CHECKS.has(result.reason)
    ) {
        const rescueSelector: string | undefined = rescueSelectors.get(result.reason);

        // Only cascade if no descendant tag overrides this very check
        if(!rescueSelector || !containsDeep(liveElement, rescueSelector)) {
            if(!isRoot) {
                removeVirtual(virtualElement);
            }

            return false;
        }
    }

    if((liveElement instanceof HTMLSelectElement) && !liveElement.multiple && (liveElement.size <= 1)) {
        if(isRoot) return result.isInteractive;

        if(!result.isInteractive) {
            removeVirtual(virtualElement);
        }

        return result.isInteractive;
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
        if(filterDOM(liveElement, virtualElement, false, checks, descendantChecks, elementOverrideChecks, rescueSelectors, onNonInteractive)) {
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
    elementOverrideChecks: { [ key: string ]: Partial<InteractivityChecks>; } | Map<string, Partial<InteractivityChecks>> = DEFAULT_FILTER_OVERRIDE_INTERACTIVITY_CHECKS,
    virtualDOM?: Document | Element,
    onNonInteractive?: (liveElement: Element, reason: InteractivityResult["reason"]) => void
): Element {
    elementOverrideChecks = new Map(
        Object.entries(elementOverrideChecks)
            .map((entry: [ string, Partial<InteractivityChecks> ]) => [ entry[0].toLowerCase(), entry[1] ])
    ); // coerce to Map

    const rescueSelectors: Map<string, string> = collectRescueSelectors(elementOverrideChecks);

    const liveRoot: Element = (dom instanceof Document)
        ? dom.documentElement
        : dom;

    const virtualRoot: Element = virtualDOM
        ? ((virtualDOM instanceof Document) ? virtualDOM.documentElement : virtualDOM)
        : cloneWithShadow(liveRoot);

    filterDOM(liveRoot, virtualRoot, true, checks, {}, elementOverrideChecks, rescueSelectors, onNonInteractive);

    return virtualRoot;
}