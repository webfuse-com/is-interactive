export interface InteractivityChecks {
    checkConnected?: boolean;
    checkHidden?: boolean;
    checkInert?: boolean;
    checkDisabled?: boolean;
    checkAriaHidden?: boolean;
    checkStyles?: boolean;
    checkSize?: boolean;
    checkInViewport?: boolean;
    checkOcclusion?: boolean;
}

export interface InteractivityResult {
    interactive: boolean;
    reason?: string;
}