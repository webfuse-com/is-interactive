import { type InteractivityChecks, type InteractivityResult } from "./types.js";
import { isElementOccluded } from "./util.occlusion.js";


const VISIBILITY_STYLE_OFF_VALUES: string[] = [ "hidden", "collapse" ];
const OVERFLOW_STYLE_CLIP_OFF_VALUES: string[] = [ "hidden", "clip" ];
const OVERFLOW_STYLE_SCROLL_OFF_VALUES: string[] = [ "auto", "scroll" ];
const CONTAINER_STYLE_POSITION_VALUES = [ "relative", "absolute", "fixed", "sticky" ];
const OPTION_TAG_NAMES: string[] = [ "OPTION", "OPTGROUP" ];
const MIN_OCCLUSION_SAMPLES = 6;
const MAX_OCCLUSION_SAMPLES: number = 42;


function readProperty<T>(element: Element, property: string): T | undefined {
    if(
        !(element instanceof HTMLFormElement)
        || !Object.prototype.hasOwnProperty.call(element, property)
    ) return (element as any)[property];

    const getter = Object.getOwnPropertyDescriptor(HTMLElement.prototype, property)?.get
        ?? Object.getOwnPropertyDescriptor(Element.prototype, property)?.get
        ?? Object.getOwnPropertyDescriptor(Node.prototype, property)?.get;

    return getter?.call(element) as T | undefined;
}

function getParentElement(element: Element | null): Element | null {
    if(!element) return null;

    const parent = readProperty<Element | null>(element, "parentElement");

    if(parent) return parent;
    
    const root = element.getRootNode() as any;

    if(root?.host instanceof Element) {
        return root.host;
    }

    return null;
}

function closestComposed(element: Element, predicate: (element: Element) => boolean): Element | null {
    let currentElement: Element | null = element;

    while(currentElement) {
        if(predicate(currentElement)) return currentElement;

        currentElement = getParentElement(currentElement);
    }

    return null;
}

function getGeometryTarget(element: Element): Element {
    if(!OPTION_TAG_NAMES.includes(element.tagName)) return element;

    const select: HTMLSelectElement | null = element.closest("select");

    if(!select) return element;

    if(select.multiple || select.size > 1) return element;

    return select;
}

function isBlockedByModal(element: Element): boolean {
    let hasModal: boolean;

    try {
        hasModal = !!document.querySelector("dialog:modal");
    } catch {
        return false;
    }

    if(!hasModal) return false;

    const hasModalAncestor: Element | null = closestComposed(element, element => {
        return (element.tagName.toUpperCase() === "DIALOG") && element.matches(":modal");
    });

    return !hasModalAncestor;
}


export function checkInteractivity(element: Element, checks: Partial<InteractivityChecks> = {}): InteractivityResult {
    if(element?.nodeType !== 1) {
        return {
            isInteractive: false,
            reason: "notElement"
        };
    }

    checks = {
        disconnected: true,
        modalBlocked: true,
        hidden: true,
        inert: true,
        disabled: true,
        invisible: true,
        unclickable: true,
        collapsed: true,
        clipped: true,
        occluded: true,
        // false
        offViewport: false, // consider full document
        ariaHidden: false,  // might be exclusive to non-GUI navigation

        ...(checks ?? {})
    };

    // Checks are in ascending order of computational cost!

    if(checks.disconnected) {
        if(readProperty<boolean>(element, "isConnected") !== true) {
            return {
                isInteractive: false,
                reason: "disconnected"
            };
        }
    }

    if(checks.modalBlocked) {
        if(isBlockedByModal(element)) {
            return {
                isInteractive: false,
                reason: "modalBlocked"
            };
        }
    }

    if(checks.inert || checks.hidden) {
        let currentElement: Element | null = element;
 
        while(currentElement) {
            if(!(currentElement instanceof HTMLElement)) {
                currentElement = getParentElement(currentElement);

                continue;
            }

            if(
                checks.hidden
                && readProperty<boolean>(currentElement, "hidden") === true
            ) {
                const style: CSSStyleDeclaration = getComputedStyle(currentElement);

                if(style.display === "none") {
                    return {
                        isInteractive: false,
                        reason: "hidden"
                    };
                };
            }

            if(
                checks.inert
                && readProperty<boolean>(currentElement, "inert") === true
            ) {
                return {
                    isInteractive: false,
                    reason: "inert"
                };
            }
 
            currentElement = getParentElement(currentElement);
        }
    }

    if(checks.disabled) {
        if(element.matches(":disabled")) {
            return {
                isInteractive: false,
                reason: "disabled"
            };
        }
 
        if(closestComposed(element, el => el.getAttribute("aria-disabled") === "true")) {
            return {
                isInteractive: false,
                reason: "disabled"
            };
        }
    }

    if(checks.ariaHidden) {
        if(closestComposed(element, el => el.getAttribute("aria-hidden") === "true")) {
            return {
                isInteractive: false,
                reason: "ariaHidden"
            };
        }
    }

    const style: CSSStyleDeclaration = getComputedStyle(element);

    if(checks.invisible || checks.unclickable) {
        if(checks.unclickable) {
            if(style.pointerEvents === "none") {
                return {
                    isInteractive: false,
                    reason: "unclickable"
                };
            }
        }

        if(checks.invisible) {
            if(VISIBILITY_STYLE_OFF_VALUES.includes(style.visibility)) {
                return {
                    isInteractive: false,
                    reason: "invisible"
                };
            }

            let currentElement: Element | null = element;

            while(currentElement) {
                const style: CSSStyleDeclaration = getComputedStyle(currentElement);

                if(
                    (style.display === "none")
                    || (parseFloat(style.opacity) === 0)
                    || (style.contentVisibility === "hidden")
                ) {
                    return {
                        isInteractive: false,
                        reason: "invisible"
                    };
                }

                currentElement = getParentElement(currentElement);
            }
        }
    }

    if(checks.collapsed || checks.clipped || checks.offViewport || checks.occluded) {
        const geometryTarget: Element = getGeometryTarget(element);
        const geometryStyle: CSSStyleDeclaration = (geometryTarget === element)
            ? style
            : getComputedStyle(geometryTarget);
        const rect: DOMRect = geometryTarget.getBoundingClientRect();

        if(
            checks.collapsed
            && (rect.width <= 0 || rect.height <= 0)
            && (
                (geometryStyle.overflow !== "visible")
                || [ ...geometryTarget.childNodes ]
                    .every(node => (node.nodeType === Node.TEXT_NODE) && !(node as Text).textContent.trim().length)
            )
        ) {
            return {
                isInteractive: false,
                reason: "collapsed"
            };
        }

        if(checks.clipped) {
            const position: string = style.position;

            let currentElement: Element | null = getParentElement(geometryTarget);
            let foundContainerBlock: boolean = (position !== "absolute");

            if(position !== "fixed") {
                while(currentElement) {
                    const style: CSSStyleDeclaration = getComputedStyle(currentElement);

                    if(!foundContainerBlock) {
                        if(CONTAINER_STYLE_POSITION_VALUES.includes(style.position)) {
                            foundContainerBlock = true;
                        } else {
                            currentElement = getParentElement(currentElement);

                            continue;
                        }
                    }

                    const clipsX: boolean = OVERFLOW_STYLE_CLIP_OFF_VALUES.includes(style.overflowX);
                    const clipsY: boolean = OVERFLOW_STYLE_CLIP_OFF_VALUES.includes(style.overflowY);
                    const scrollsX: boolean = OVERFLOW_STYLE_SCROLL_OFF_VALUES.includes(style.overflowX);
                    const scrollsY: boolean = OVERFLOW_STYLE_SCROLL_OFF_VALUES.includes(style.overflowY);

                    if(clipsX || clipsY) {
                        const ancestorRect: DOMRect = currentElement.getBoundingClientRect();

                        if(
                            (clipsY && (rect.bottom <= ancestorRect.top || rect.top >= ancestorRect.bottom))
                            || (clipsX && (rect.right <= ancestorRect.left || rect.left >= ancestorRect.right))
                        ) {
                            return {
                                isInteractive: false,
                                reason: "clipped"
                            };
                        }
                    }

                    if(scrollsX || scrollsY) {
                        const ancestorRect: DOMRect = currentElement.getBoundingClientRect();

                        const localTop: number = rect.top - ancestorRect.top + currentElement.scrollTop;
                        const localBottom: number = rect.bottom - ancestorRect.top + currentElement.scrollTop;
                        const localLeft: number = rect.left - ancestorRect.left + currentElement.scrollLeft;
                        const localRight: number = rect.right - ancestorRect.left + currentElement.scrollLeft;

                        if(
                            (scrollsY && (localBottom <= 0 || localTop >= currentElement.scrollHeight))
                            || (scrollsX && (localRight <= 0 || localLeft >= currentElement.scrollWidth))
                        ) {
                            return {
                                isInteractive: false,
                                reason: "clipped"
                            };
                        }
                    }

                    currentElement = getParentElement(currentElement);
                }
            }
        }

        if(checks.offViewport) {
            if( [ "fixed", "absolute" ].includes(geometryStyle.position)) {
                const scrollWidth: number = Math.max(document.documentElement.scrollWidth, document.documentElement.clientWidth);
                const scrollHeight: number = Math.max(document.documentElement.scrollHeight, document.documentElement.clientHeight);

                const top: number = rect.top + window.scrollY;
                const bottom: number = rect.bottom + window.scrollY;
                const left: number = rect.left + window.scrollX;
                const right: number = rect.right + window.scrollX;

                if(
                    (top >= scrollHeight)
                    || (bottom <= 0)
                    || (left >= scrollWidth)
                    || (right <= 0)
                ) {
                    return {
                        isInteractive: false,
                        reason: "offViewport"
                    };
                }
            }
        }

        if(checks.occluded) {
            const area: number = rect.width * rect.height;
            const occlusionSamples: number = Math.max(MIN_OCCLUSION_SAMPLES, Math.min(MAX_OCCLUSION_SAMPLES, Math.round(area / 4000)));

            if(isElementOccluded(geometryTarget, occlusionSamples)) {
                return {
                    isInteractive: false,
                    reason: "occluded"
                };
            }
        }
    }

    return {
        isInteractive: true
    };
}