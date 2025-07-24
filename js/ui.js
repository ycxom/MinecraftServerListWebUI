import { DropdownMenu } from './components/DropdownMenu.js';
import { getState, setState } from './state.js';
import { getLatencyClass } from './utils.js';

function cleanupAnimationClasses(elements, ...classes) {
    elements.forEach(el => el.classList.remove(...classes));
}

export async function updateUI(options = {}) {
    const { isRefresh = false, skipAnimations = false } = options;
    const { isTransitioning } = getState();
    if (isTransitioning) return;
    setState({ isTransitioning: true });

    const container = document.getElementById('groups-container');
    const oldGroups = Array.from(container.querySelectorAll('.server-group'));
    const oldNodes = Array.from(container.querySelectorAll('.node-drawer'));
    const oldPositions = new Map();

    // Decide which animation to run
    if (isRefresh && !skipAnimations) {
        // FLIP animation for refresh still targets nodes for re-ordering
        oldNodes.forEach(nodeEl => {
            oldPositions.set(nodeEl.id, nodeEl.getBoundingClientRect());
        });
    } else if (!isRefresh && oldGroups.length > 0 && !skipAnimations) {
        // Genie animation for group switch now targets the whole group
        oldGroups.forEach(group => group.classList.add('genie-out'));
        await new Promise(resolve => setTimeout(resolve, 400));
    }

    container.innerHTML = '';

    const selectedGroupValue = document.getElementById('group-selector-container').getAttribute('data-selected-value') || 'all';
    const { results } = getState();
    const groupsToDisplay = selectedGroupValue === 'all' ? results : results.filter(g => g.groupName === selectedGroupValue);

    groupsToDisplay.forEach(group => {
        let groupDiv = document.createElement('div');
        const animationClass = !isRefresh && !skipAnimations ? 'genie-in' : '';
        groupDiv.className = `server-group ${animationClass}`;
        container.appendChild(groupDiv);

        const statusText = group.status === 'testing' ? '检测中' : group.status === 'online' ? '在线' : '离线';
        const playersInfo = group.status !== 'offline' && group.players !== '?/?' ? `<span class="header-info-item players"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>${group.players}</span>` : '';
        const versionInfo = group.status !== 'offline' && group.version !== '未知' ? `<span class="header-info-item version"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 2 13.43l1.43 1.43L2 16.29l2.14 2.14 1.43-1.43 1.43 1.43L9.14 20.57 12 17l3.57 3.57L17 22l1.43-1.43L19.86 22l2.14-2.14-1.43-1.43L22 16.29z"/></svg>${group.version}</span>` : '';

        groupDiv.innerHTML = `
            <div class="server-group-header">
                <h2>${group.groupName}</h2>
                <div class="header-info-container">
                    <span class="header-info-item status ${group.status}">${statusText}</span>
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
            // Animation class is now on the parent, not the drawer
            drawerDiv.className = `node-drawer ${node.isOpen ? ' is-open' : ''}`;
            drawerDiv.id = drawerId;

            const summaryLatencyClass = getLatencyClass(node.bestLatency);
            const latencyText = group.status === 'testing' ? '检测中...' : node.bestLatency >= 0 ? `${node.bestLatency} ms` : '超时';

            drawerDiv.innerHTML = `
        <button class="node-header" type="button">
            <span class="node-name">${node.nodeName}</span>
            <div class="node-header__summary">
                <span class="summary-latency ${group.status === 'offline' ? 'offline' : summaryLatencyClass}">${latencyText}</span>
                <svg class="node-header__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" /></svg>
            </div>
        </button>
        <div class="node-content-wrapper">
            ${node.versions.map(version => `
                <div class="version-entry">
                    <div class="version-info">
                        <span class="version-address">${version.fullAddress}</span>
                        <span class="version-type">${version.type}版</span>
                    </div>
                    <div class="version-details">
                        <span class="version-latency ${getLatencyClass(version.latency)}">${version.latency < 0 ? '-' : version.latency >= 5000 ? '超时' : `${version.latency} ms`}</span>
                        <button class="copy-btn" data-address="${version.fullAddress}">
                            <span class="copy-btn__text">复制</span>
                            <span class="copy-btn__svg">
                                <svg class="check" viewBox="0 0 64 64" aria-hidden="true">
                                    <g transform="translate(32,32)">
                                        <g stroke-linecap="round" stroke-width="3">
                                            <polyline class="check__stroke-offset check__stroke-offset--1" stroke="var(--purple)" points="-30 -30,-42 -42" stroke-dasharray="17 17" stroke-dashoffset="17"></polyline>
                                            <polyline class="check__stroke-offset check__stroke-offset--2" stroke="var(--primary)" points="38 -38,54 -54" stroke-dasharray="22.63 22.63" stroke-dashoffset="22.63"></polyline>
                                            <polyline class="check__stroke-offset check__stroke-offset--3" stroke="var(--green)" points="-28 28,-40 40" stroke-dasharray="17 17" stroke-dashoffset="17"></polyline>
                                            <polyline class="check__stroke-offset check__stroke-offset--4" stroke="var(--red)" points="32 32,44 44" stroke-dasharray="17 17" stroke-dashoffset="17"></polyline>
                                        </g>
                                        <g>
                                            <circle class="check__move-fade check__move-fade--1" fill="var(--red)" r="3" cx="4" cy="-44" opacity="0"></circle>
                                            <circle class="check__move-fade check__move-fade--2" fill="var(--primary)" r="3" cx="-44" cy="-8" opacity="0"></circle>
                                            <circle class="check__move-fade check__move-fade--3" fill="var(--green)" r="3" cx="52" cy="12" opacity="0"></circle>
                                            <circle class="check__move-fade check__move-fade--4" fill="var(--purple)" r="2" cx="-2" cy="40" opacity="0"></circle>
                                            <circle class="check__move-fade check__move-fade--5" fill="var(--primary)" r="3" cx="-12" cy="46" opacity="0"></circle>
                                        </g>
                                        <g class="check__scale-out" fill="none" stroke="var(--check-outline)" stroke-width="2">
                                            <circle r="30"></circle>
                                            <polygon points="-10 -4,-16 2,-4 14,16 -6,10 -12,-4 2"></polygon>
                                        </g>
                                        <g class="check__fade" opacity="0">
                                            <circle class="check__scale-in check__scale-in--1" fill="var(--check-bubble)" r="30.9"></circle>
                                            <circle class="check__scale-in check__scale-in--2" fill="var(--primary)" r="31"></circle>
                                            <polygon class="check__scale-in check__scale-in--3" fill="var(--white)" stroke="var(--primary)" stroke-width="2" points="-10 -4,-16 2,-4 14,16 -6,10 -12,-4 2"></polygon>
                                        </g>
                                    </g>
                                </svg>
                            </span>
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
            nodesContainer.appendChild(drawerDiv);
        });
    });

    // Apply animations post-render
    if (isRefresh && !skipAnimations) {
        // FLIP post-render logic remains the same
        document.querySelectorAll('.node-drawer').forEach(nodeEl => {
            const oldPos = oldPositions.get(nodeEl.id);
            if (!oldPos) return;
            const newPos = nodeEl.getBoundingClientRect();
            const deltaX = oldPos.left - newPos.left;
            const deltaY = oldPos.top - newPos.top;

            if (Math.abs(deltaX) > 0.1 || Math.abs(deltaY) > 0.1) {
                nodeEl.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
                requestAnimationFrame(() => {
                    nodeEl.classList.add('flip-list-move');
                    nodeEl.style.transform = '';
                });
                nodeEl.addEventListener('transitionend', () => {
                    nodeEl.classList.remove('flip-list-move');
                }, { once: true });
            }
        });
    } else if (!isRefresh && !skipAnimations) {
        // Genie cleanup now targets the server-group
        setTimeout(() => {
            cleanupAnimationClasses(document.querySelectorAll('.server-group'), 'genie-in');
        }, 500);
    }

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
            // FIX: Ensure this triggers the genie effect by setting isRefresh to false
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

    progressBar.style.transition = `width 1s linear`;
    progressBar.style.width = '100%';

    const updateCountdown = () => {
        const percentage = (seconds / totalDuration) * 100;
        progressBar.style.width = `${percentage}%`;
        countdownElement.textContent = `${seconds} 秒后自动刷新...`;

        if (seconds <= 0) {
            clearInterval(window.countdownInterval);
            document.getElementById('refresh-btn').click();
        }
        seconds--;
    };

    setTimeout(() => {
        updateCountdown();
        window.countdownInterval = setInterval(updateCountdown, 1000);
    }, 50);
}

export function showLoadingAnimation() {
    const container = document.getElementById('groups-container');
    container.innerHTML = `<div class="loading-animation"><div class="spinner"></div><p>加载服务器信息中...</p></div>`;
}

export function applyPageConfig(config) {
    document.getElementById('main-title').textContent = config.title || 'MC服务器状态面板';
    document.getElementById('subtitle').textContent = config.subtitle || '一个Minecraft服务器状态面板';
    document.getElementById('page-footer').textContent = config.footer || '';
}