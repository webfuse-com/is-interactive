/**
 * Scrolls an element into view by adjusting every scrollable ancestor the minimum amount.
 * Returns an array of restore functions.
 * Using scroll and restore synchronously in the same tick (with instant scrolling), there
 * is no page re-paint happening between scroll and restore; invisible scroll, but element
 * is in viewport for processing.
 */
export declare function scrollIntoViewSynchronously(element: Element): (() => void)[];
