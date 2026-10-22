import { type InteractivityChecks, type InteractivityOptions, type InteractivityResult } from "./types.js";
import { type ScrollIntoViewPolicy } from "./util.scroll.js";
export declare const DEFAULT_INTERACTIVITY_CHECKS: InteractivityChecks;
export declare function getGeometryTarget(element: Element): Element;
/**
 * Whether an element is occluded (on its geometry target), scrolled into view as permitted.
 */
export declare function isOccluded(element: Element, scrollPolicy: ScrollIntoViewPolicy): boolean;
export declare function hasModalDialog(): boolean;
/**
 * Reuse a known modal presence for checks within the callback (DOM must not change meanwhile).
 */
export declare function withModalDialogPresence<T>(hasModal: boolean, callback: () => T): T;
export declare function checkInteractivity(element: Element, checks?: Partial<InteractivityChecks>, options?: Partial<InteractivityOptions>): InteractivityResult;
