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
        this.mouse = { x: 0.5, y: 0.5, isOver: false };

        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseLeave = this.onMouseLeave.bind(this);
        this.update = this.update.bind(this);

        this.init();
    }

    init() {
        const rect = this.element.getBoundingClientRect();
        this.width = Math.round(rect.width);
        this.height = Math.round(rect.height);

        if (this.width === 0 || this.height === 0) return;

        this.createSVGFilter();
        this.createCanvas();

        // Apply ONLY the backdrop-filter, leaving other styles to CSS.
        this.element.style.backdropFilter = `url(#${this.id}_filter) blur(0.25px)`;
        this.element.style.webkitBackdropFilter = `url(#${this.id}_filter) blur(0.25px)`;

        this.element.addEventListener('mousemove', this.onMouseMove);
        this.element.addEventListener('mouseleave', this.onMouseLeave);

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

        this.feImage = document.createElementNS('http://www.w3.org/2000/svg', 'feImage');
        this.feImage.setAttribute('id', `${this.id}_map`);
        this.feImage.setAttribute('width', this.width);
        this.feImage.setAttribute('height', this.height);

        this.feDisplacementMap = document.createElementNS('http://www.w3.org/2000/svg', 'feDisplacementMap');
        this.feDisplacementMap.setAttribute('in', 'SourceGraphic');
        this.feDisplacementMap.setAttribute('in2', 'SourceGraphic');
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
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.canvas.style.display = 'none';
        this.context = this.canvas.getContext('2d');
    }

    onMouseMove(e) {
        if (!this.animationFrame) {
            this.animationFrame = requestAnimationFrame(this.update);
        }
        const rect = this.element.getBoundingClientRect();
        this.mouse.x = (e.clientX - rect.left) / rect.width;
        this.mouse.y = (e.clientY - rect.top) / rect.height;
        this.mouse.isOver = true;
    }

    onMouseLeave() {
        this.mouse.isOver = false;
        if (!this.animationFrame) {
            this.animationFrame = requestAnimationFrame(this.update);
        }
    }

    fragment(uv, mouse) {
        const ix = uv.x - 0.5;
        const iy = uv.y - 0.5;

        let mx = mouse.x - 0.5;
        let my = mouse.y - 0.5;

        if (!mouse.isOver) {
            mx *= 0.9;
            my *= 0.9;
        }

        const distanceToMouse = length(ix - mx, iy - my);
        const distanceToEdge = roundedRectSDF(ix, iy, 0.45, 0.45, 0.1);

        const warp = smoothStep(0.2, 0.0, distanceToMouse);
        const edgeWarp = smoothStep(0.1, -0.1, distanceToEdge);

        const displacement = warp * 0.1 + edgeWarp * 0.2;
        const scaled = smoothStep(0.0, 1.0, displacement);

        return texture(ix * scaled + 0.5, iy * scaled + 0.5);
    }

    update() {
        if (!this.context) return;

        const w = this.width;
        const h = this.height;

        const data = new Uint8ClampedArray(w * h * 4);
        let maxScale = 0;
        const rawValues = [];

        for (let j = 0; j < h; j++) {
            for (let i = 0; i < w; i++) {
                const pos = this.fragment({ x: i / w, y: j / h }, this.mouse);
                const dx = pos.x * w - i;
                const dy = pos.y * h - j;
                maxScale = Math.max(maxScale, Math.abs(dx), Math.abs(dy));
                rawValues.push(dx, dy);
            }
        }

        maxScale = Math.max(maxScale, 1.0);

        let dataIndex = 0;
        let rawIndex = 0;
        for (let j = 0; j < h; j++) {
            for (let i = 0; i < w; i++) {
                const r = rawValues[rawIndex++] / maxScale * 0.5 + 0.5;
                const g = rawValues[rawIndex++] / maxScale * 0.5 + 0.5;
                data[dataIndex++] = r * 255;
                data[dataIndex++] = g * 255;
                data[dataIndex++] = 0;
                data[dataIndex++] = 255;
            }
        }

        this.context.putImageData(new ImageData(data, w, h), 0, 0);
        this.feImage.setAttributeNS('http://www.w3.org/1999/xlink', 'href', this.canvas.toDataURL());
        this.feDisplacementMap.setAttribute('scale', maxScale.toString());

        this.animationFrame = null;
        if (this.mouse.isOver === false && (Math.abs(this.mouse.x - 0.5) > 0.01 || Math.abs(this.mouse.y - 0.5) > 0.01)) {
            this.mouse.x = (this.mouse.x - 0.5) * 0.95 + 0.5;
            this.mouse.y = (this.mouse.y - 0.5) * 0.95 + 0.5;
            requestAnimationFrame(this.update);
        }
    }

    destroy() {
        this.element.removeEventListener('mousemove', this.onMouseMove);
        this.element.removeEventListener('mouseleave', this.onMouseLeave);
        // Only remove the styles this script added.
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