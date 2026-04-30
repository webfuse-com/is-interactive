export interface InteractivityChecks {
    disconnected: boolean;
    hidden: boolean;
    inert: boolean;
    disabled: boolean;
    ariaHidden: boolean;
    invisible: boolean;
    unclickable: boolean;
    collapsed: boolean;
    clipped: boolean;
    offViewport: boolean;
    occluded: boolean;
}
export interface IsInteractiveOptions {
    checks: InteractivityChecks;
    occlusionSamples: number;
}
export interface InteractivityResult {
    isInteractive: boolean;
    reason?: "notElement" | keyof InteractivityChecks;
}
