export function getLatencyClass(latency) {
    if (latency < 0 || latency >= 5000) return 'latency-bad';
    if (latency < 150) return 'latency-good';
    if (latency < 300) return 'latency-medium';
    return 'latency-bad';
}

export function copyAddress(address, element) {
    navigator.clipboard.writeText(address).then(() => {
        element.textContent = '已复制!';
        element.classList.add('copied');
        setTimeout(() => {
            element.textContent = '复制';
            element.classList.remove('copied');
        }, 1500);
    }).catch(err => console.error('复制失败: ', err));
}

export function detectAndApplyTheme() {
    const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.body.classList.toggle("dark-theme", prefersDarkScheme);
}

export function loadBackgroundImage() {
    const imageUrl = window.innerWidth < 768
        ? 'https://ai.ycxom.top:3002/api/v1/wallpaper/by-ratio/square'
        : 'https://ai.ycxom.top:3002/api/v1/wallpaper/by-ratio/standard';

    const img = new Image();
    img.src = imageUrl;

    img.onload = () => {
        const style = document.createElement('style');
        style.innerHTML = `body::before { background-image: url('${imageUrl}'); }`;
        document.head.appendChild(style);
        document.body.classList.add('background-loaded');
    };
    img.onerror = () => console.error('背景图片加载失败。');
}