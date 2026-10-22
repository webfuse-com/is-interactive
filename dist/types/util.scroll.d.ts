export interface ScrollIntoViewPolicy {
    containers: boolean;
    viewport: boolean;
}
export declare function computeScrollDelta(near: number, far: number, viewport: number): number;
export declare function resolveParent(node: Element): Element | null;
/**
 * Scroll the window without smooth scrolling. Resulting scroll events are suppressed if the window is scrolled back
 * before the next frame.
 */
export declare function scrollWindowTo(left: number, top: number): void;
export declare function scrollIntoViewSynchronously(element: Element, policy?: ScrollIntoViewPolicy): (() => void)[];
