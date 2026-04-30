import { scrollIntoViewSynchronously } from "./util.scroll.js";


/**
 * Distribute sample points across a rect, starting at the center.
 * Additional sample points are scattered uniformly across the rect.
 */
function generateSamplePoints(rect: DOMRect, samples: number): [number, number][] {
    const sampleCount: number = Math.max(1, Math.floor(samples));
 
    const centerX: number = rect.left + rect.width / 2;
    const centerY: number = rect.top + rect.height / 2;
 
    const samplePoints: [number, number][] = [ [ centerX, centerY ] ];

    if(sampleCount === 1) return samplePoints;

    const aspectRatio: number =rect.width / Math.max(1, rect.height);

    const gridY: number = Math.max(1, Math.round(Math.sqrt(sampleCount / aspectRatio)));
    const gridX: number = Math.max(1, Math.ceil(sampleCount / gridY));

    const left: number = rect.left + 1;
    const right: number = rect.right - 1;
    const top: number = rect.top + 1;
    const bottom: number = rect.bottom - 1;

    const stepX: number = (gridX > 1) ? (right - left) / (gridX - 1) : 0;
    const stepY: number = (gridY > 1) ? (bottom - top) / (gridY - 1) : 0;

    const candidates: Array<[number, number, number]> = [];

    for(let row: number = 0; row < gridY; row++) {
        for(let col: number = 0; col < gridX; col++) {
            const x: number = gridX > 1 ? left + col * stepX : centerX;
            const y: number = gridY > 1 ? top + row * stepY : centerY;

            const dx: number = x - centerX;
            const dy: number = y - centerY;
            const distanceSquared: number = dx * dx + dy * dy;

            candidates.push([x, y, distanceSquared]);
        }
    }

    candidates
        .sort((a: [number, number, number], b: [number, number, number]): number => {
            return a[2] - b[2];
        });

    for(let i: number = 0; i < candidates.length; i++) {
        if(samplePoints.length >= sampleCount) break;

        const x: number = candidates[i][0];
        const y: number = candidates[i][1];

        if(
               (Math.abs(x - centerX) < 0.5)
            && (Math.abs(y - centerY) < 0.5)
        ) continue;

        samplePoints.push([ x, y ]);
    }

    return samplePoints;
}

function isElementOnHit(
    element: Element,
    rect: DOMRect,
    samples: number,
    viewportWidth: number,
    viewportHeight: number
): boolean {
    const root: Document | ShadowRoot = element.getRootNode() as Document | ShadowRoot;
    const points: [number, number][] = generateSamplePoints(rect, samples);

    for(const point of points) {
        const x: number = point[0];
        const y: number = point[1];

        // Skip off-viewport sample points:
        if(x < 0 || y < 0 || x >= viewportWidth || y >= viewportHeight) continue;

        const stack: Element[] = root.elementsFromPoint(x, y) ?? [];

        if(stack.length === 0) continue;

        const hitElement: Element = stack[0];

        if(
            (hitElement === element)
            || element.contains(hitElement)
            || hitElement.contains(element)
        ) return true;
    }

    return false;
}


export function isElementOccluded(element: Element, samples: number): boolean {
    const viewportWidth: number = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight: number = window.innerHeight || document.documentElement.clientHeight;

    const scrollRestoreCbs: (() => void)[] = scrollIntoViewSynchronously(element);

    let isOccluded: boolean = false;

    try {
        const rect: DOMRect = element.getBoundingClientRect();

        isOccluded = !isElementOnHit(element, rect, samples, viewportWidth, viewportHeight);
    } finally {
        for(let index: number = scrollRestoreCbs.length - 1; index >= 0; index--) {
            scrollRestoreCbs[index]();
        }
    }

    return isOccluded;
}