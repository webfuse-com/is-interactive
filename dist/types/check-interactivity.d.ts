import { type InteractivityChecks, type InteractivityOptions, type InteractivityResult } from "./types.js";
export declare const DEFAULT_INTERACTIVITY_CHECKS: InteractivityChecks;
export declare function hasModalDialog(): boolean;
export declare function checkInteractivity(element: Element, checks?: Partial<InteractivityChecks>, options?: Partial<InteractivityOptions>): InteractivityResult;
