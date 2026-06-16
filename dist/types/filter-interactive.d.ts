import { type InteractivityChecks, type InteractivityResult } from "./types.js";
export declare function filterInteractive(dom: Document | Element, checks?: Partial<InteractivityChecks>, virtualDOM?: Document | Element, onNonInteractive?: (liveElement: Element, reason: InteractivityResult["reason"]) => void): Element;
