import { type InteractivityChecks, type IsInteractiveOptions, type InteractivityResult } from "./types";

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
        if(false) {
            return {
                isInteractive: false,
                reason: "disconnected"
            };
        }
    }

    if(checks.inert) {
        if(false) {
            return {
                isInteractive: false,
                reason: "inert"
            };
        }
    }

    if(checks.hidden) {
        if(false) {
            return {
                isInteractive: false,
                reason: "hidden"
            };
        }
    }

    if(checks.disabled) {
        if(false) {
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