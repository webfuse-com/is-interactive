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
    occluded: boolean;
    offViewport: boolean;
}
export interface InteractivityResult {
    isInteractive: boolean;
    reason?: "notElement" | keyof InteractivityChecks;
}
