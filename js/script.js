import { loadAndProcessConfig } from './config.js';
import { populateGroupSelector, updateUI, showLoadingAnimation } from './ui.js';
import { testAllServers } from './api.js';
import { detectAndApplyTheme, copyAddress, loadBackgroundImage } from './utils.js';
import { getState, setState, initState } from './state.js';

async function main() {
    showLoadingAnimation();
    const serverData = await loadAndProcessConfig();
    if (serverData.length > 0) {
        setState({ serverData });
        initState();
        populateGroupSelector();
        await testAllServers(true);
    }
}

// --- Global Event Listeners ---
document.addEventListener('click', function (event) {
    const target = event.target;
    const { isTransitioning } = getState();

    // *** THE FIX ***
    // The conflicting logic for handling dropdown item clicks has been completely removed.
    // The DropdownMenu component now handles this safely on its own.

    const copyButton = target.closest('.copy-btn');
    if (copyButton) {
        event.stopPropagation();
        const address = copyButton.dataset.address;
        copyAddress(address, copyButton);
        return;
    }

    const refreshButton = target.closest('#refresh-btn');
    if (refreshButton) {
        if (isTransitioning || refreshButton.classList.contains('spinning')) return;
        refreshButton.classList.add('spinning');
        testAllServers(false).finally(() => {
            setTimeout(() => refreshButton.classList.remove('spinning'), 500);
        });
        return;
    }

    const nodeHeader = target.closest('.node-header');
    if (nodeHeader) {
        const drawer = nodeHeader.closest('.node-drawer');
        drawer.classList.toggle('is-open');
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