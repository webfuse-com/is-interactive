import { type InteractivityChecks, type IsInteractiveOptions, type InteractivityResult } from "./types.js";
import { isElementOccluded } from "./util.occlusion.js";


const DISABLEABLE_TAG_NAMES: string[] = [
    "BUTTON",
    "INPUT",
    "SELECT",
    "TEXTAREA",
    "OPTGROUP",
    "OPTION",
    "FIELDSET"
];


export function isInteractive(element: Element, options: Partial<IsInteractiveOptions> = {}): InteractivityResult {
    if(!element || element.nodeType !== 1) {
        return {
            isInteractive: false,
            reason: "not-element"
        };
    }

    const optionsWithDefaults: IsInteractiveOptions = {
        checks: {
            disconnected: true,
            hidden: true,
            inert: true,
            disabled: true,
            ariaHidden: true,
            invisible: true,
            unclickable: true,
            collapsed: true,
            offViewport: true,
            occluded: true,

            ...(options.checks ?? {})
        },
        occlusionSamples: 5
    };
    const checks: InteractivityChecks = optionsWithDefaults.checks;

    if(checks.disconnected) {
        if(!element.isConnected) {
            return {
                isInteractive: false,
                reason: "disconnected"
            };
        }
    }

    if(checks.inert || checks.hidden) {
        let currentElement: Element | null = element;
 
        while(currentElement) {
            if(!(currentElement instanceof HTMLElement)) continue;

            if(
                checks.hidden
                && currentElement.hidden
            ) {
                return {
                    isInteractive: false,
                    reason: "hidden"
                };
            }

            if(
                checks.inert
                && (currentElement as HTMLElement & { inert: boolean })?.inert
            ) {
                return {
                    isInteractive: false,
                    reason: "inert"
                };
            }
 
            currentElement = currentElement.parentElement;
        }
    }

    if(checks.disabled) {
        if(DISABLEABLE_TAG_NAMES.includes(element.tagName) && (element as HTMLInputElement).disabled) {
            return {
                isInteractive: false,
                reason: "disabled"
            };
        }
 
        if(element.closest("[aria-disabled=\"true\"]")) {
            return {
                isInteractive: false,
                reason: "disabled"
            };
        }
 
        const fieldsetElement: HTMLFieldSetElement | null = element.closest("fieldset[disabled]");
 
        if(fieldsetElement && !element.closest("legend")?.parentElement?.isSameNode(fieldsetElement)) {
            return {
                isInteractive: false,
                reason: "disabled"
            };
        }
    }

    if(checks.ariaHidden) {
        if(element.closest("[aria-hidden=\"true\"]")) {
            return {
                isInteractive: false,
                reason: "ariaHidden"
            };
        }
    }

    if(checks.invisible || checks.unclickable) {
        if(checks.unclickable) {
            const style: CSSStyleDeclaration = getComputedStyle(element);

            if(style.pointerEvents === "none") {
                return {
                    isInteractive: false,
                    reason: "unclickable"
                };
            }
        }

        const invisibilityValues: string[] = [ "hidden", "collapse" ];

        let currentElement: Element | null = element;

        while(currentElement) {
            const style: CSSStyleDeclaration = getComputedStyle(currentElement);

            if(
                checks.invisible
                && (style.display === "none" || invisibilityValues.includes(style.visibility))
            ) {
                return {
                    isInteractive: false,
                    reason: "invisible"
                };
            }

            currentElement = currentElement.parentElement;
        }
    }

    if(checks.collapsed || checks.offViewport || checks.occluded) {
        const rect: DOMRect | null = element.getBoundingClientRect();

        if(
            checks.collapsed
            && (rect.width <= 0 || rect.height <= 0)
        ) {
            return {
                isInteractive: false,
                reason: "collapsed"
            };
        }

        if(checks.offViewport) {
            const viewportWidth: number = window.innerWidth || document.documentElement.clientWidth;
            const viewportHeight: number = window.innerHeight || document.documentElement.clientHeight;
 
            if(
                   (rect.bottom <= 0)
                || (rect.right <= 0)
                || (rect.left >= viewportWidth)
                || (rect.top >= viewportHeight)
            ) {
                return {
                    isInteractive: false,
                    reason: "offViewport"
                };
            }
        }

        if(
            checks.occluded
            && isElementOccluded(element, optionsWithDefaults.occlusionSamples)
        ) {
            return {
                isInteractive: false,
                reason: "occluded"
            };
        }

    }

    return {
        isInteractive: true
    };
}