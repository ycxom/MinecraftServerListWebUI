import { DropdownMenu } from './components/DropdownMenu.js';
import { InteractiveGlass } from './components/InteractiveGlass.js';
import { getState, setState } from './state.js';
import { getLatencyClass } from './utils.js';

let glassInstances = [];
export function getGlassInstance(element) {
    return glassInstances.find(inst => inst.element === element);
}
function cleanupAnimationClasses(elements, ...classes) {
    elements.forEach(el => el.classList.remove(...classes));
}

function applyInteractiveGlass() {
    glassInstances.forEach(instance => instance.destroy());
    glassInstances = [];
    document.querySelectorAll('.interactive-glass').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            glassInstances.push(new InteractiveGlass(el));
        }
    });
}
/**
 * **动画和刷新逻辑的最终修复版本**
 * 此版本使用修正后的 FLIP 动画技术，并修复了在刷新时折叠列表内具体线路延迟不更新的bug。
 */
function refreshUI() {
    const { results } = getState();
    const container = document.getElementById('groups-container');

    results.forEach(groupData => {
        const groupEl = container.querySelector(`#group-${groupData.groupName.replace(/[\s.]+/g, '-')}`);
        if (!groupEl) return;

        const infoContainer = groupEl.querySelector('.header-info-container');
        if (infoContainer) {
            const statusText = groupData.status === 'testing' ? '检测中' : groupData.status === 'online' ? '在线' : '离线';
            const statusHTML = `<span class="header-info-item interactive-glass status ${groupData.status}">${statusText}</span>`;

            const playersHTML = groupData.status === 'online'
                ? `<span class="header-info-item interactive-glass players"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>${groupData.players}</span>`
                : '';

            const versionHTML = groupData.status === 'online'
                ? `<span class="header-info-item interactive-glass version"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 2 13.43l1.43 1.43L2 16.29l2.14 2.14 1.43-1.43 1.43 1.43L9.14 20.57 12 17l3.57 3.57L17 22l1.43-1.43L19.86 22l2.14-2.14-1.43-1.43L22 16.29z"/></svg>${groupData.version}</span>`
                : '';

            infoContainer.innerHTML = statusHTML + playersHTML + versionHTML;
        }

        const nodesContainer = groupEl.querySelector('.nodes-container');
        const children = Array.from(nodesContainer.children);
        const initialPositions = new Map();
        children.forEach(child => {
            initialPositions.set(child, child.getBoundingClientRect());
        });

        groupData.nodes.sort((a, b) => {
            if (a.bestLatency === -1 && b.bestLatency > -1) return 1;
            if (a.bestLatency > -1 && b.bestLatency === -1) return -1;
            return a.bestLatency - b.bestLatency;
        });

        groupData.nodes.forEach((nodeData) => {
            const nodeDrawerId = `drawer-${groupData.groupName}-${nodeData.nodeName}`.replace(/[\s.]+/g, '-');
            const nodeEl = nodesContainer.querySelector(`#${nodeDrawerId}`);
            if (nodeEl) {
                const summaryLatencyEl = nodeEl.querySelector('.summary-latency');
                summaryLatencyEl.textContent = nodeData.bestLatency >= 0 ? `${nodeData.bestLatency} ms` : '超时';
                summaryLatencyEl.className = `summary-latency ${getLatencyClass(nodeData.bestLatency)}`;
                nodeData.versions.forEach(versionData => {
                    const versionEntries = nodeEl.querySelectorAll('.version-entry');
                    // 使用地址和类型作为复合键来查找唯一的DOM元素
                    const versionEntryEl = Array.from(versionEntries).find(el => {
                        const addressMatch = el.querySelector('.version-address')?.textContent === versionData.fullAddress;
                        const typeMatch = el.querySelector('.version-type')?.textContent === `${versionData.type}版`;
                        return addressMatch && typeMatch;
                    });
                    if (versionEntryEl) {
                        const latencyEl = versionEntryEl.querySelector('.version-latency');
                        if (latencyEl) {
                            latencyEl.textContent = versionData.latency >= 5000 ? '超时' : `${versionData.latency} ms`;
                            latencyEl.className = `version-latency ${getLatencyClass(versionData.latency)}`;
                        }
                    }
                });
                nodesContainer.appendChild(nodeEl);
            }
        });

        children.forEach(child => {
            const newPos = child.getBoundingClientRect();
            const oldPos = initialPositions.get(child);
            const dx = oldPos.left - newPos.left;
            const dy = oldPos.top - newPos.top;

            if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
                requestAnimationFrame(() => {
                    child.style.transform = `translate(${dx}px, ${dy}px)`;
                    child.style.transition = 'transform 0s';
                    requestAnimationFrame(() => {
                        child.style.transition = `transform 0.6s cubic-bezier(0.55, 0, 0.1, 1)`;
                        child.style.transform = '';
                    });
                });
            }
            child.addEventListener('transitionend', () => {
                child.style.transition = '';
            }, { once: true });
        });
    });
}


export async function updateUI(options = {}) {
    const { isRefresh = false } = options;

    if (isRefresh) {
        refreshUI();
        return;
    }

    const { isTransitioning } = getState();
    if (isTransitioning) return;
    setState({ isTransitioning: true });

    const container = document.getElementById('groups-container');
    const oldGroups = Array.from(container.querySelectorAll('.server-group'));

    if (oldGroups.length > 0) {
        glassInstances.forEach(instance => {
            if (oldGroups.includes(instance.element)) {
                instance.destroy();
            }
        });
        const dropdownButton = document.getElementById('group-selector-btn');
        const buttonRect = dropdownButton.getBoundingClientRect();
        const targetX = buttonRect.left + buttonRect.width / 2;
        const targetY = buttonRect.top + buttonRect.height / 2;
        oldGroups.forEach(groupEl => {
            const groupRect = groupEl.getBoundingClientRect();
            const originX = ((targetX - groupRect.left) / groupRect.width) * 100;
            const originY = ((targetY - groupRect.top) / groupRect.height) * 100;
            groupEl.style.transformOrigin = `${originX}% ${originY}%`;
            groupEl.classList.add('genie-out');
        });
        await new Promise(resolve => setTimeout(resolve, 400));
    }

    container.innerHTML = '';

    const selectedGroupValue = document.getElementById('group-selector-container').getAttribute('data-selected-value') || 'all';
    const { results } = getState();
    const groupsToDisplay = selectedGroupValue === 'all' ? results : results.filter(g => g.groupName === selectedGroupValue);

    groupsToDisplay.forEach(group => {
        const groupId = `group-${group.groupName.replace(/[\s.]+/g, '-')}`;
        let groupDiv = document.createElement('div');
        groupDiv.className = 'server-group interactive-glass';
        groupDiv.id = groupId;
        container.appendChild(groupDiv);

        const statusText = group.status === 'testing' ? '检测中' : group.status === 'online' ? '在线' : '离线';
        const playersInfo = group.status !== 'offline' && group.players !== '?/?' ? `<span class="header-info-item interactive-glass players"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>${group.players}</span>` : '';
        const versionInfo = group.status !== 'offline' && group.version !== '未知' ? `<span class="header-info-item interactive-glass version"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 2 13.43l1.43 1.43L2 16.29l2.14 2.14 1.43-1.43 1.43 1.43L9.14 20.57 12 17l3.57 3.57L17 22l1.43-1.43L19.86 22l2.14-2.14-1.43-1.43L22 16.29z"/></svg>${group.version}</span>` : '';

        groupDiv.innerHTML = `
            <div class="server-group-header">
                <h2>${group.groupName}</h2>
                <div class="header-info-container">
                    <span class="header-info-item interactive-glass status ${group.status}">${statusText}</span>
                    ${playersInfo}
                    ${versionInfo}
                </div>
            </div>
            <div class="nodes-container" id="nodes-container-${group.groupName}"></div>
        `;

        const nodesContainer = groupDiv.querySelector('.nodes-container');
        group.nodes.sort((a, b) => {
            if (a.bestLatency === -1 && b.bestLatency > -1) return 1;
            if (a.bestLatency > -1 && b.bestLatency === -1) return -1;
            return a.bestLatency - b.bestLatency;
        });

        group.nodes.forEach(node => {
            const drawerId = `drawer-${group.groupName}-${node.nodeName}`.replace(/[\s.]+/g, '-');
            const drawerDiv = document.createElement('div');
            drawerDiv.className = `node-drawer ${node.isOpen ? ' is-open' : ''}`;
            drawerDiv.id = drawerId;
            const summaryLatencyClass = getLatencyClass(node.bestLatency);
            const latencyText = node.bestLatency >= 0 ? `${node.bestLatency} ms` : '超时';
            drawerDiv.innerHTML = `
                <button class="node-header" type="button"><span class="node-name">${node.nodeName}</span><div class="node-header__summary"><span class="summary-latency ${summaryLatencyClass}">${latencyText}</span><svg class="node-header__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" /></svg></div></button>
                <div class="node-content-wrapper">${node.versions.map(version => `<div class="version-entry"><div class="version-info"><span class="version-address">${version.fullAddress}</span><span class="version-type">${version.type}版</span></div><div class="version-details"><span class="version-latency ${getLatencyClass(version.latency)}">${version.latency >= 5000 ? '超时' : `${version.latency} ms`}</span><button class="copy-btn interactive-glass" data-address="${version.fullAddress}"><span class="copy-btn__text">复制</span></button></div></div>`).join('')}</div>
            `;
            nodesContainer.appendChild(drawerDiv);
        });
    });

    requestAnimationFrame(() => {
        applyInteractiveGlass();
        const newGroups = container.querySelectorAll('.server-group');
        if (newGroups.length > 0) {
            const dropdownButton = document.getElementById('group-selector-btn');
            const buttonRect = dropdownButton.getBoundingClientRect();
            const targetX = buttonRect.left + buttonRect.width / 2;
            const targetY = buttonRect.top + buttonRect.height / 2;
            newGroups.forEach(groupEl => {
                const groupRect = groupEl.getBoundingClientRect();
                const originX = ((targetX - groupRect.left) / groupRect.width) * 100;
                const originY = ((targetY - groupRect.top) / groupRect.height) * 100;
                groupEl.style.transformOrigin = `${originX}% ${originY}%`;
                groupEl.classList.add('genie-in');
            });
        }
        setTimeout(() => {
            const groupsToClean = document.querySelectorAll('.server-group');
            cleanupAnimationClasses(groupsToClean, 'genie-in');
            groupsToClean.forEach(g => g.style.transformOrigin = '');
        }, 500);
    });

    setState({ isTransitioning: false });
}

export function populateGroupSelector() {
    const container = document.getElementById('group-selector-container');
    const itemsContainer = container.querySelector('.drop-down__items-inner');
    const { serverData } = getState();
    itemsContainer.innerHTML = '';
    const options = [{ name: '全部服务器', value: 'all' }, ...serverData.map(g => ({ name: g.groupName, value: g.groupName }))];
    options.forEach(opt => {
        const item = document.createElement('button');
        item.className = 'drop-down__item';
        item.type = 'button';
        item.textContent = opt.name;
        item.setAttribute('data-value', opt.value);
        itemsContainer.appendChild(item);
    });
    const dropdown = new DropdownMenu(container, {
        onSelect: (value) => {
            container.setAttribute('data-selected-value', value);
            updateUI({ isRefresh: false });
        }
    });
    container.setAttribute('data-selected-value', 'all');
    dropdown.updateSelected('all');
    setState({ groupSelectorDropdown: dropdown });
}

export function startCountdown() {
    const countdownElement = document.getElementById('countdown');
    const progressBar = document.getElementById('progressBar');
    const totalDuration = 60;
    let seconds = totalDuration;
    if (window.countdownInterval) clearInterval(window.countdownInterval);
    progressBar.style.transition = `transform ${totalDuration}s linear`;
    progressBar.style.transform = 'scaleX(1)';
    requestAnimationFrame(() => {
        progressBar.style.transform = 'scaleX(0)';
    });
    const updateCountdownText = () => {
        countdownElement.textContent = `${seconds} 秒后自动刷新...`;
        if (seconds <= 0) {
            clearInterval(window.countdownInterval);
            document.getElementById('refresh-btn').click();
        }
        seconds--;
    };
    updateCountdownText();
    window.countdownInterval = setInterval(updateCountdownText, 1000);
}

export function showLoadingAnimation() {
    const container = document.getElementById('groups-container');
    container.innerHTML = `<div class="loading-animation"><div class="spinner"></div><p>加载服务器信息中...</p></div>`;
}

export function applyPageConfig(config) {
    document.getElementById('main-title').textContent = config.title || 'MC服务器状态面板';
    document.getElementById('subtitle').textContent = config.subtitle || '一个Minecraft服务器状态面板';
    document.getElementById('page-footer').textContent = config.footer || '';
    requestAnimationFrame(applyInteractiveGlass);
}