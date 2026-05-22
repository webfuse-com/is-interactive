import { type InteractivityChecks, type InteractivityResult } from "./types.js";
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
const VISIBILITY_STYLE_OFF_VALUES: string[] = [ "hidden", "collapse" ];
const OVERFLOW_STYLE_CLIP_OFF_VALUES: string[] = [ "hidden", "clip" ];
const OVERFLOW_STYLE_SCROLL_OFF_VALUES: string[] = [ "auto", "scroll" ];
const MAX_OCCLUSION_SAMPLES: number = 32;


export function checkInteractivity(element: Element, checks: Partial<InteractivityChecks> = {}): InteractivityResult {
    if(element?.nodeType !== 1) {
        return {
            isInteractive: false,
            reason: "notElement"
        };
    }

    checks = {
        disconnected: true,
        hidden: true,
        inert: true,
        disabled: true,
        ariaHidden: true,
        invisible: true,
        unclickable: true,
        collapsed: true,
        clipped: true,
        occluded: true,
        offViewport: false,

        ...(checks ?? {})
    };

    // Checks are in ascending order of computational cost!

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
            if(!(currentElement instanceof HTMLElement)) {
                currentElement = currentElement.parentElement;

                continue;
            }

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

        let currentElement: Element | null = element;

        while(currentElement) {
            const style: CSSStyleDeclaration = getComputedStyle(currentElement);

            if(
                checks.invisible
                && (style.display === "none" || parseFloat(style.opacity) === 0 || VISIBILITY_STYLE_OFF_VALUES.includes(style.visibility))
            ) {
                return {
                    isInteractive: false,
                    reason: "invisible"
                };
            }

            currentElement = currentElement.parentElement;
        }
    }

    if(checks.collapsed || checks.clipped || checks.offViewport || checks.occluded) {
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

        if(checks.clipped) {
            let currentElement: Element | null = element.parentElement;
 
            while(currentElement) {
                const style: CSSStyleDeclaration = getComputedStyle(currentElement);
 
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
 
                currentElement = currentElement.parentElement;
            }
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

        if(checks.occluded) {
            const area: number = rect.width * rect.height;
            const occlusionSamples: number = Math.max(1, Math.min(MAX_OCCLUSION_SAMPLES, Math.round(area / 4000)));

            if(isElementOccluded(element, occlusionSamples)) {
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