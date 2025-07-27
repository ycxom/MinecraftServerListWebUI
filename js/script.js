import { loadAndProcessConfig } from './config.js';
import { showLoadingAnimation, getGlassInstance } from './ui.js';
import { testAllServers } from './api.js';
import { detectAndApplyTheme, copyAddress, loadBackgroundImage } from './utils.js';
import { getState, setState } from './state.js';

async function main() {
    showLoadingAnimation();
    const serverData = await loadAndProcessConfig();
    if (serverData.length > 0) {
        setState({ serverData });
        await testAllServers(true); // 首次加载也走完整流程
    }
}

document.addEventListener('click', async function (event) {
    const target = event.target;
    const { isTransitioning } = getState();

    // 复制按钮的逻辑
    const copyButton = target.closest('.copy-btn');
    if (copyButton) {
        event.stopPropagation();
        const address = copyButton.dataset.address;
        copyAddress(address, copyButton);
        return;
    }

    const refreshButton = target.closest('#refresh-btn');
    if (refreshButton) {
        // 如果正在切换或已在旋转，则直接返回
        if (isTransitioning || refreshButton.classList.contains('spinning')) {
            return;
        }

        // 使用 try...finally 结构确保 spinning class 总是被移除
        try {
            refreshButton.classList.add('spinning');
            // 调用 testAllServers，并等待它完成
            await testAllServers(false);
        } catch (error) {
            // 捕获 testAllServers 中可能发生的任何意外错误
            console.error("在执行 testAllServers 期间发生严重错误:", error);
        } finally {
            // 无论成功或失败，最后都移除旋转动画
            // 使用一个短暂的延时，以确保视觉效果完整
            setTimeout(() => {
                refreshButton.classList.remove('spinning');
            }, 500);
        }
        return;
    }

    // 折叠列表的逻辑
    const nodeHeader = target.closest('.node-header');
    if (nodeHeader) {
        const drawer = nodeHeader.closest('.node-drawer');
        const serverGroup = drawer.closest('.server-group.interactive-glass');

        drawer.classList.toggle('is-open');

        if (serverGroup) {
            const glassInstance = getGlassInstance(serverGroup);
            if (glassInstance) {
                const animationDuration = 500;
                let startTime = null;
                if (serverGroup.animationFrameId) {
                    cancelAnimationFrame(serverGroup.animationFrameId);
                }
                const animateGlass = (timestamp) => {
                    if (!startTime) startTime = timestamp;
                    const elapsedTime = timestamp - startTime;
                    glassInstance.resize();
                    if (elapsedTime < animationDuration) {
                        serverGroup.animationFrameId = requestAnimationFrame(animateGlass);
                    } else {
                        serverGroup.animationFrameId = null;
                    }
                };
                serverGroup.animationFrameId = requestAnimationFrame(animateGlass);
            }
        }

        const drawerId = drawer.id;
        const { results } = getState();
        for (const group of results) {
            for (const node of group.nodes) {
                const currentId = `drawer-${group.groupName}-${node.nodeName}`.replace(/[\s.]+/g, '-');
                if (currentId === drawerId) {
                    node.isOpen = drawer.classList.contains('is-open');
                    break;
                }
            }
        }
        return;
    }
});

window.addEventListener('load', () => {
    detectAndApplyTheme();
    loadBackgroundImage();
    main();
});

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", detectAndApplyTheme);