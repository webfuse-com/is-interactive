export interface InteractivityChecks {
    disconnected: boolean;
    modalBlocked: boolean;
    hidden: boolean;
    inert: boolean;
    disabled: boolean;
    ariaHidden: boolean;
    invisible: boolean;
    unclickable: boolean;
    collapsed: boolean;
    clipped: boolean;
    offScrolled: boolean;
    offViewport: boolean;
    occluded: boolean;
}
export interface InteractivityResult {
    isInteractive: boolean;
    reason?: "notElement" | keyof InteractivityChecks;
}
