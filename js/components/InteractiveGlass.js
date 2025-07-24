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
        // Mouse related properties removed for static effect
        // this.mouse = { x: 0.5, y: 0.5, isOver: false };

        // Mouse event handlers removed
        // this.onMouseMove = this.onMouseMove.bind(this);
        // this.onMouseLeave = this.onMouseLeave.bind(this);
        this.update = this.update.bind(this); // Only update is needed

        // Add a canvasDPI property for consistency with liquid-glass.js
        this.canvasDPI = 1;

        this.init();
    }

    init() {
        const rect = this.element.getBoundingClientRect();
        this.width = Math.round(rect.width);
        this.height = Math.round(rect.height);

        // Crucial check: if dimensions are zero, filter won't work.
        if (this.width === 0 || this.height === 0) {
            console.warn(`InteractiveGlass: Element ${this.element.id || this.element.className} has zero dimensions (${this.width}x${this.height}). Skipping initialization.`);
            // Potentially re-try initialization after a delay if desired, or assume caller will retry.
            return;
        }

        this.createSVGFilter();
        this.createCanvas();

        // Apply backdrop-filter with full liquid-glass effect parameters
        this.element.style.backdropFilter = `url(#${this.id}_filter) blur(0.25px) contrast(1.2) brightness(1.05) saturate(1.1)`;
        this.element.style.webkitBackdropFilter = `url(#${this.id}_filter) blur(0.25px) contrast(1.2) brightness(1.05) saturate(1.1)`;

        // Mouse event listeners removed
        // this.element.addEventListener('mousemove', this.onMouseMove);
        // this.element.addEventListener('mouseleave', this.onMouseLeave);

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
        filter.setAttribute('filterUnits', 'userSpaceOnUse'); // 保持 userSpaceOnUse
        filter.setAttribute('color-interpolation-filters', 'sRGB');

        // 关键修正：确保滤镜的区域与元素的实际尺寸匹配
        filter.setAttribute('x', '0'); // 从元素左上角开始
        filter.setAttribute('y', '0'); // 从元素左上角开始
        filter.setAttribute('width', this.width.toString()); // 设置滤镜宽度为元素宽度
        filter.setAttribute('height', this.height.toString()); // 设置滤镜高度为元素高度


        this.feImage = document.createElementNS('http://www.w3.org/2000/svg', 'feImage');
        this.feImage.setAttribute('id', `${this.id}_map`);
        // 关键修正：确保 feImage 覆盖整个滤镜区域
        this.feImage.setAttribute('width', this.width.toString()); // 设置 feImage 宽度为元素宽度
        this.feImage.setAttribute('height', this.height.toString()); // 设置 feImage 高度为元素高度


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

    // Removed onMouseMove and onMouseLeave

    fragment(uv) {
        const ix = uv.x - 0.5;
        const iy = uv.y - 0.5;

        // 将 roundedRectSDF 的参数精确地恢复为 liquid-glass.js 的原始值
        // 这些参数定义了液态玻璃效果的核心扭曲形状
        const distanceToEdge = roundedRectSDF(
            ix,
            iy,
            0.25, // liquid-glass.js 原始的半宽度参数
            0.25, // liquid-glass.js 原始的半高度参数
            0.552  // liquid-glass.js 原始的圆角半径参数
        );

        // liquid-glass.js 原始的位移计算，用于获取平滑的过渡值
        // displacement 的值范围在 0 到 1 之间。
        const displacement = smoothStep(0.8, 0, distanceToEdge - 0.15);

        // 为了实现凹透镜效果，我们希望在中心（displacement接近0）时，scaled 值最大（大于1），
        // 在边缘（displacement接近1）时，scaled 值接近1或更小。
        // 调整 distortionFactor 可以控制凹陷的强度。
        const distortionFactor = 0.5; // 控制凹透镜的强度，可以调整此值 (例如 0.2 到 1.0)
        const scaled = 1.0 + distortionFactor * (1.0 - displacement);

        return texture(ix * scaled + 0.5, iy * scaled + 0.5);
    }
    update() {
        if (!this.context) return;

        const w = this.width * this.canvasDPI; // 使用 DPI 缩放的宽度
        const h = this.height * this.canvasDPI; // 使用 DPI 缩放的高度

        // 如果尺寸为零，则跳过更新
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

        // liquid-glass.js 对 maxScale 的处理
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
        // 确保 scale 也考虑了 canvasDPI
        this.feDisplacementMap.setAttribute('scale', (maxScale / this.canvasDPI).toString());

        this.animationFrame = null;
    }

    destroy() {
        // Removed mouse event listener cleanup
        // this.element.removeEventListener('mousemove', this.onMouseMove);
        // this.element.removeEventListener('mouseleave', this.onMouseLeave);

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