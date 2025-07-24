// 全局变量
let serverData = [];
let results = [];

// API 定义
const apiEndpoints = [
    {
        name: 'mcsrvstat.us',
        async fetcher(address) {
            const response = await fetch(`https://api.mcsrvstat.us/2/${address}`);
            if (!response.ok) throw new Error(`mcsrvstat.us failed`);
            const data = await response.json();
            if (!data.online) return { online: false };
            return {
                online: true,
                players: `${data.players?.online || 0}/${data.players?.max || 0}`,
                version: data.version || "未知"
            };
        }
    },
    {
        name: 'mcapi.us',
        async fetcher(address) {
            const [host, port] = address.split(":");
            const response = await fetch(`https://mcapi.us/server/status?ip=${host}&port=${port}`);
            if (!response.ok) throw new Error(`mcapi.us failed`);
            const data = await response.json();
            if (!data.online) return { online: false };
            return {
                online: true,
                players: `${data.players?.now || 0}/${data.players?.max || 0}`,
                version: data.server?.name || "未知"
            };
        }
    },
    {
        name: 'minetools.eu',
        async fetcher(address) {
            const [host, port] = address.split(":");
            const response = await fetch(`https://api.minetools.eu/ping/${host}/${port}`);
            if (!response.ok) throw new Error(`minetools.eu failed`);
            const data = await response.json();
            if (data.error) return { online: false };
            return {
                online: true,
                players: `${data.players?.online || 0}/${data.players?.max || 0}`,
                version: data.version?.name || "未知",
                latency: data.latency
            };
        }
    }
];

/**
 * 显示加载动画
 */
function showLoadingAnimation() {
    const container = document.getElementById('groups-container');
    container.innerHTML = `
        <div class="loading-animation">
            <div class="spinner"></div>
            <p>加载服务器信息中...</p>
        </div>
    `;
}

/**
 * 检测系统主题并应用
 */
function detectAndApplyTheme() {
    const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (prefersDarkScheme) {
        document.body.classList.add("dark-theme");
    } else {
        document.body.classList.remove("dark-theme");
    }
}

/**
 * 加载并处理配置文件
 * @returns {Promise<Array>} 处理后的服务器数据
 */
async function loadAndProcessConfig() {
    try {
        const response = await fetch('config.json');
        if (!response.ok) throw new Error(`无法加载 config.json`);
        const config = await response.json();

        return config.MCServerList.map(group => ({
            groupName: group.name,
            nodes: group.servers.map(node => {
                const versions = [];
                if (node['port-java']) {
                    versions.push({ type: 'Java', port: node['port-java'], fullAddress: `${node.address}:${node['port-java']}` });
                }
                if (node['port-pe']) {
                    versions.push({ type: 'PE', port: node['port-pe'], fullAddress: `${node.address}:${node['port-pe']}` });
                }
                return { nodeName: node.name, versions: versions };
            })
        }));
    } catch (error) {
        console.error("加载配置文件失败:", error);
        document.getElementById('groups-container').innerHTML = `<h2 style="color: red; text-align: center;">错误: ${error.message}</h2>`;
        return [];
    }
}

/**
 * 初始化结果数组
 * @param {Array} data - 服务器配置数据
 */
function initResults(data) {
    results = JSON.parse(JSON.stringify(data));
    results.forEach(group => {
        group.status = 'testing';
        group.players = '?/?';
        group.version = '未知';
        group.nodes.forEach(node => {
            node.bestLatency = -1; // 初始化最佳延迟
            node.versions.forEach(version => {
                version.latency = -1;
                version.timestamp = new Date().toLocaleTimeString();
            });
        });
    });
}

/**
 * 根据延迟值获取对应的CSS类名
 * @param {number} latency - 延迟 (ms)
 * @returns {string} CSS类名
 */
function getLatencyClass(latency) {
    if (latency < 0 || latency >= 5000) return 'latency-bad'; // 超时或错误
    if (latency < 150) return 'latency-good';      // 优
    if (latency < 300) return 'latency-medium';    // 中
    return 'latency-bad';                       // 差
}

/**
 * 渲染延迟分布图表
 * @param {object} group - 服务器组数据
 */
function renderLatencyChart(group) {
    const chartId = `chart-${group.groupName.replace(/\s+/g, '-')}`;
    const chartContainer = document.getElementById(chartId);
    if (!chartContainer) return;

    chartContainer.innerHTML = '';

    const validNodes = group.nodes.filter(node => node.bestLatency >= 0 && node.bestLatency < 5000);
    if (validNodes.length === 0) {
        chartContainer.parentElement.style.display = 'none';
        return;
    }
    chartContainer.parentElement.style.display = 'block';

    const maxLatency = Math.max(100, ...validNodes.map(node => node.bestLatency)); // 最小高度基准

    validNodes.forEach(node => {
        const barHeight = Math.max(5, (node.bestLatency / maxLatency) * 100);
        const barEl = document.createElement('div');
        barEl.className = `latency-bar ${getLatencyClass(node.bestLatency)}`;
        barEl.style.height = `${barHeight}%`;

        const valueEl = document.createElement('div');
        valueEl.className = 'latency-value';
        valueEl.textContent = `${node.bestLatency}ms`;

        const labelEl = document.createElement('div');
        labelEl.className = 'latency-label';
        labelEl.textContent = node.nodeName;

        const barContainer = document.createElement('div');
        barContainer.className = 'latency-bar-container';
        barContainer.appendChild(valueEl);
        barContainer.appendChild(barEl);
        barContainer.appendChild(labelEl);

        chartContainer.appendChild(barContainer);
    });
}


/**
 * 更新UI界面
 */
function updateUI() {
    const container = document.getElementById('groups-container');
    const openDetails = new Set(Array.from(container.querySelectorAll('details[open]')).map(d => d.id));

    const selectedGroup = document.getElementById('group-selector').value;
    const groupsToDisplay = selectedGroup === 'all' ? results : results.filter(g => g.groupName === selectedGroup);

    // 清空现有内容，但保留主容器
    container.innerHTML = '';

    groupsToDisplay.forEach(group => {
        let groupDiv = document.createElement('div');
        groupDiv.className = 'server-group';
        groupDiv.dataset.groupName = group.groupName;
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
            const detailsId = `details-${group.groupName}-${node.nodeName}`.replace(/[\s.]+/g, '-');
            const details = document.createElement('details');
            details.className = 'node-details';
            details.id = detailsId;
            if (openDetails.has(detailsId)) {
                details.setAttribute('open', '');
            }

            const summaryLatencyClass = getLatencyClass(node.bestLatency);
            details.innerHTML = `
                <summary class="node-summary">
                    <span class="node-name">${node.nodeName}</span>
                    <div class="node-status-summary">
                        <span class="summary-latency ${group.status === 'offline' ? 'offline' : summaryLatencyClass}">
                            ${group.status === 'testing' ? '检测中...' : node.bestLatency >= 0 ? `${node.bestLatency} ms` : '超时'}
                        </span>
                        <svg class="summary-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" /></svg>
                    </div>
                </summary>
                <div class="node-content">
                    ${node.versions.map(version => {
                const latencyText = version.latency < 0 ? '-' : version.latency >= 5000 ? '超时' : `${version.latency} ms`;
                const versionLatencyClass = getLatencyClass(version.latency);
                return `
                            <div class="version-entry">
                                <div class="version-info">
                                    <span class="version-address">${version.fullAddress}</span>
                                    <span class="version-type">${version.type}版</span>
                                </div>
                                <div class="version-details">
                                    <span class="version-latency ${versionLatencyClass}">${latencyText}</span>
                                    <button class="copy-btn" data-address="${version.fullAddress}">复制</button>
                                </div>
                            </div>
                        `;
            }).join('')}
                </div>
            `;
            nodesContainer.appendChild(details);
        });

        // 添加数据可视化图表
        if (group.nodes.length > 0) {
            const chartContainerWrapper = document.createElement('div');
            chartContainerWrapper.className = 'latency-chart-container';
            chartContainerWrapper.innerHTML = `
                <h3>延迟分布图</h3>
                <div class="latency-chart" id="chart-${group.groupName.replace(/\s+/g, '-')}"></div>
            `;
            groupDiv.appendChild(chartContainerWrapper);
            renderLatencyChart(group);
        }
    });
}


/**
 * 复制地址到剪贴板
 * @param {string} address - 要复制的地址
 * @param {HTMLElement} element - 点击的按钮元素
 */
function copyAddress(address, element) {
    navigator.clipboard.writeText(address).then(() => {
        element.textContent = '已复制!';
        element.classList.add('copied');
        setTimeout(() => {
            element.textContent = '复制';
            element.classList.remove('copied');
        }, 1500);
    }).catch(err => {
        console.error('复制失败: ', err);
    });
}

/**
 * 使用多个API重试获取服务器状态
 * @param {string} address - 服务器地址
 * @returns {Promise<object>} 服务器状态
 */
async function fetchServerStatusWithRetry(address) {
    for (const api of apiEndpoints) {
        try {
            const status = await api.fetcher(address);
            return status.online ? { online: true, players: status.players, version: status.version } : { online: false, players: 'N/A', version: 'N/A' };
        } catch (error) {
            console.warn(`API ${api.name} for ${address} failed. Retrying...`, error);
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    return { online: false, players: '全部API错误', version: '全部API错误' };
}

/**
 *探测单个节点的延迟
 * @param {string} address - 服务器地址
 * @returns {Promise<number>} 延迟(ms)或超时值
 */
async function probeNodeLatency(address) {
    try {
        const response = await fetch(`https://api.minetools.eu/ping/${address.replace(':', '/')}`);
        if (!response.ok) return 5000;
        const data = await response.json();
        return data.error ? 5000 : Math.round(data.latency);
    } catch (error) {
        return 5000;
    }
}

/**
 * 测试所有服务器
 * @param {boolean} isInitialLoad - 是否为初次加载
 */
async function testAllServers(isInitialLoad = false) {
    if (isInitialLoad) {
        initResults(serverData);
    }

    const progressBar = document.getElementById('progressBar');
    progressBar.style.width = '0%';
    progressBar.classList.add('progress-pulse');

    await new Promise(resolve => setTimeout(resolve, 50));

    const groupPromises = results.map(async (group) => {
        const representativeNode = group.nodes[0]?.versions[0];
        if (representativeNode) {
            const status = await fetchServerStatusWithRetry(representativeNode.fullAddress);
            group.status = status.online ? 'online' : 'offline';
            group.players = status.online ? status.players : '?/?';
            group.version = status.online ? status.version : '未知';
        } else {
            group.status = 'offline';
        }
    });
    await Promise.all(groupPromises);

    const allVersions = results.flatMap(g => g.nodes.flatMap(n => n.versions));
    let completedCount = 0;

    const latencyPromises = allVersions.map(async (version) => {
        version.latency = await probeNodeLatency(version.fullAddress);
        version.timestamp = new Date().toLocaleTimeString();

        const parentGroup = results.find(g => g.nodes.some(n => n.versions.includes(version)));
        const parentNode = parentGroup.nodes.find(n => n.versions.includes(version));
        const latencies = parentNode.versions.map(v => v.latency).filter(l => l >= 0 && l < 5000);
        parentNode.bestLatency = latencies.length > 0 ? Math.min(...latencies) : -1;

        completedCount++;
        progressBar.style.width = `${(completedCount / allVersions.length) * 100}%`;

        requestAnimationFrame(updateUI);
    });

    await Promise.all(latencyPromises);
    progressBar.classList.remove('progress-pulse');
    updateUI();
    startCountdown();
}


/**
 * 填充服务器组选择器
 */
function populateGroupSelector() {
    const selector = document.getElementById('group-selector');
    selector.innerHTML = '<option value="all">全部服务器</option>';
    serverData.forEach(group => {
        const option = document.createElement('option');
        option.value = group.groupName;
        option.textContent = group.groupName;
        selector.appendChild(option);
    });
    selector.addEventListener('change', () => updateUI());
}

/**
 * 启动刷新倒计时
 */
function startCountdown() {
    let seconds = 60;
    const countdownElement = document.getElementById('countdown');
    if (window.countdownInterval) clearInterval(window.countdownInterval);

    const updateCountdown = () => {
        countdownElement.textContent = `${seconds} 秒后自动刷新...`;
        if (seconds <= 0) {
            clearInterval(window.countdownInterval);
            document.getElementById('refresh-btn').click();
        }
        seconds--;
    };

    updateCountdown();
    window.countdownInterval = setInterval(updateCountdown, 1000);
}

/**
 * 主函数
 */
async function main() {
    showLoadingAnimation();
    serverData = await loadAndProcessConfig();
    if (serverData.length > 0) {
        populateGroupSelector();
        await testAllServers(true);
    }
}

// --- 事件委托 ---
document.addEventListener('click', function (event) {
    // 处理复制按钮
    const copyButton = event.target.closest('.copy-btn');
    if (copyButton) {
        const address = copyButton.dataset.address;
        copyAddress(address, copyButton);
        return;
    }

    // 处理弹性展开/收回
    const summary = event.target.closest('.node-summary');
    if (summary) {
        const details = summary.parentElement;
        event.preventDefault(); // 阻止默认行为

        if (details.hasAttribute('open')) {
            details.removeAttribute('open');
        } else {
            details.setAttribute('open', '');
        }
        return;
    }

    // 处理刷新按钮
    const refreshButton = event.target.closest('#refresh-btn');
    if (refreshButton) {
        if (refreshButton.classList.contains('spinning')) return;

        refreshButton.classList.add('spinning');
        if (window.countdownInterval) clearInterval(window.countdownInterval);

        testAllServers(false).finally(() => {
            setTimeout(() => refreshButton.classList.remove('spinning'), 500);
        });
    }
});

// --- 初始加载和主题检测 ---
window.addEventListener('load', () => {
    detectAndApplyTheme();
    main();
});
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", detectAndApplyTheme);
