/**
 * InteractiveGlass.js
 * * This is a heavily refactored version of the original liquid-glass.js by Shu Ding.
 * It has been adapted from a standalone draggable element into a reusable class
 * that can be applied to multiple existing DOM elements to create an interactive,
 * VisionOS-style liquid glass effect.
 * * Key changes:
 * - Encapsulated into a class `InteractiveGlass`.
 * - Constructor takes a target DOM element.
 * - Manages its own unique SVG filter, canvas, and event listeners.
 * - Applies the effect using `backdrop-filter` referencing its unique filter.
 * - Mouse interactions are relative to the target element.
 * - Includes a `destroy` method for cleanup to prevent memory leaks during UI updates.
 * - FIX: Ensured all canvas and ImageData dimensions are rounded to integers to prevent crashes.
 * - REFACTOR: Removed all hardcoded styles (background, border, etc.) to prevent conflicts
 * with external CSS files. This script is now solely responsible for the filter effect.
 * - ADDED: A `resize` method for efficient, real-time resizing during animations.
 * - ADDED: A more prominent `blur` to the backdrop-filter for a frosted glass effect.
 */

function smoothStep(a, b, t) {
    t = Math.max(0, Math.min(1, (t - a) / (b - a)));
    return t * t * (3 - 2 * t);
}

function length(x, y) {
    return Math.sqrt(x * x + y * y);
}

function roundedRectSDF(x, y, width, height, radius) {
    const qx = Math.abs(x) - width + radius;
    const qy = Math.abs(y) - height + radius;
    return Math.min(Math.max(qx, qy), 0) + length(Math.max(qx, 0), Math.max(qy, 0)) - radius;
}

function texture(x, y) {
    return { type: 't', x, y };
}

function generateId() {
    return 'interactive-glass-' + Math.random().toString(36).substr(2, 9);
}

export class InteractiveGlass {
    constructor(element) {
        if (!element) return;
        this.element = element;
        this.id = generateId();
        this.update = this.update.bind(this);
        this.canvasDPI = 1;
        this.init();
    }

    init() {
        const rect = this.element.getBoundingClientRect();
        this.width = Math.round(rect.width);
        this.height = Math.round(rect.height);

        if (this.width === 0 || this.height === 0) {
            console.warn(`InteractiveGlass: Element ${this.element.id || this.element.className} has zero dimensions. Skipping initialization.`);
            return;
        }

        this.createSVGFilter();
        this.createCanvas();

        // *** 核心修改：添加更强的 blur(5px) 以实现毛玻璃效果 ***
        const filterValue = `blur(2px) url(#${this.id}_filter) contrast(1.1) brightness(1.1)`;
        this.element.style.backdropFilter = filterValue;
        this.element.style.webkitBackdropFilter = filterValue;


        this.update();
    }

    createSVGFilter() {
        if (document.getElementById(`${this.id}_svg`)) return;

        this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.svg.setAttribute('id', `${this.id}_svg`);
        this.svg.setAttribute('width', '0');
        this.svg.setAttribute('height', '0');
        this.svg.style.cssText = 'position:fixed; top:0; left:0; pointer-events:none;';

        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
        filter.setAttribute('id', `${this.id}_filter`);
        filter.setAttribute('filterUnits', 'userSpaceOnUse');
        filter.setAttribute('color-interpolation-filters', 'sRGB');
        filter.setAttribute('x', '0');
        filter.setAttribute('y', '0');
        filter.setAttribute('width', this.width.toString());
        filter.setAttribute('height', this.height.toString());

        this.feImage = document.createElementNS('http://www.w3.org/2000/svg', 'feImage');
        this.feImage.setAttribute('id', `${this.id}_map`);
        this.feImage.setAttribute('width', this.width.toString());
        this.feImage.setAttribute('height', this.height.toString());

        this.feDisplacementMap = document.createElementNS('http://www.w3.org/2000/svg', 'feDisplacementMap');
        this.feDisplacementMap.setAttribute('in', 'SourceGraphic');
        this.feDisplacementMap.setAttribute('in2', `${this.id}_map`);
        this.feDisplacementMap.setAttribute('xChannelSelector', 'R');
        this.feDisplacementMap.setAttribute('yChannelSelector', 'G');

        filter.appendChild(this.feImage);
        filter.appendChild(this.feDisplacementMap);
        defs.appendChild(filter);
        this.svg.appendChild(defs);
        document.body.appendChild(this.svg);
    }

    createCanvas() {
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.width * this.canvasDPI;
        this.canvas.height = this.height * this.canvasDPI;
        this.canvas.style.display = 'none';
        this.context = this.canvas.getContext('2d');
    }

    fragment(uv) {
        const ix = uv.x - 0.5;
        const iy = uv.y - 0.5;

        const distanceToEdge = roundedRectSDF(ix, iy, 0.25, 0.25, 0.552);
        const displacement = smoothStep(0.8, 0, distanceToEdge - 0.15);
        const distortionFactor = 0.5;
        const scaled = 1.0 + distortionFactor * (1.0 - displacement);

        return texture(ix * scaled + 0.5, iy * scaled + 0.5);
    }

    update() {
        if (!this.context) return;

        const w = this.width * this.canvasDPI;
        const h = this.height * this.canvasDPI;

        if (w === 0 || h === 0) {
            this.animationFrame = null;
            return;
        }

        const data = new Uint8ClampedArray(w * h * 4);
        let maxScale = 0;
        const rawValues = [];

        for (let j = 0; j < h; j++) {
            for (let i = 0; i < w; i++) {
                const pos = this.fragment({ x: i / w, y: j / h });
                const dx = pos.x * w - i;
                const dy = pos.y * h - j;
                maxScale = Math.max(maxScale, Math.abs(dx), Math.abs(dy));
                rawValues.push(dx, dy);
            }
        }

        maxScale *= 0.5;

        let dataIndex = 0;
        let rawIndex = 0;
        for (let j = 0; j < h; j++) {
            for (let i = 0; i < w; i++) {
                const r = rawValues[rawIndex++] / maxScale + 0.5;
                const g = rawValues[rawIndex++] / maxScale + 0.5;
                data[dataIndex++] = r * 255;
                data[dataIndex++] = g * 255;
                data[dataIndex++] = 0;
                data[dataIndex++] = 255;
            }
        }

        this.context.putImageData(new ImageData(data, w, h), 0, 0);
        this.feImage.setAttributeNS('http://www.w3.org/1999/xlink', 'href', this.canvas.toDataURL());
        this.feDisplacementMap.setAttribute('scale', (maxScale / this.canvasDPI).toString());

        this.animationFrame = null;
    }

    resize() {
        if (!this.element || !document.body.contains(this.element)) return;

        const rect = this.element.getBoundingClientRect();
        const newWidth = Math.round(rect.width);
        const newHeight = Math.round(rect.height);

        if (newWidth === this.width && newHeight === this.height) {
            return;
        }

        this.width = newWidth;
        this.height = newHeight;

        if (this.width === 0 || this.height === 0) {
            return;
        }

        const filter = this.svg.querySelector('filter');
        filter.setAttribute('width', this.width.toString());
        filter.setAttribute('height', this.height.toString());
        this.feImage.setAttribute('width', this.width.toString());
        this.feImage.setAttribute('height', this.height.toString());

        this.canvas.width = this.width * this.canvasDPI;
        this.canvas.height = this.height * this.canvasDPI;

        this.update();
    }

    destroy() {
        this.element.style.backdropFilter = '';
        this.element.style.webkitBackdropFilter = '';
        if (this.svg) {
            this.svg.remove();
        }
        if (this.canvas) {
            this.canvas.remove();
        }
    }
}