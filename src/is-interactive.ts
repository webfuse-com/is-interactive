import { type InteractivityChecks, type IsInteractiveOptions, type InteractivityResult } from "./types";


const DISABLEABLE_TAG_NAMES: string[] = [
    "BUTTON",
    "INPUT",
    "SELECT",
    "TEXTAREA",
    "OPTGROUP",
    "OPTION",
    "FIELDSET"
];


export function isInteractive(element: Element, options: IsInteractiveOptions = {}): InteractivityResult {
    if(!element || element.nodeType !== 1) {
        return {
            isInteractive: false,
            reason: "not-element"
        };
    }

    const checks: InteractivityChecks = {
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
    };

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
        if(false) {
            return {
                isInteractive: false,
                reason: "ariaHidden"
            };
        }
    }

    if(checks.invisible) {
        if(false) {
            return {
                isInteractive: false,
                reason: "invisible"
            };
        }
    }

    if(checks.unclickable) {
        if(false) {
            return {
                isInteractive: false,
                reason: "unclickable"
            };
        }
    }

    if(checks.collapsed) {
        if(false) {
            return {
                isInteractive: false,
                reason: "collapsed"
            };
        }
    }

    if(checks.offViewport) {
        if(false) {
            return {
                isInteractive: false,
                reason: "offViewport"
            };
        }
    }

    if(checks.occluded) {
        if(false) {
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