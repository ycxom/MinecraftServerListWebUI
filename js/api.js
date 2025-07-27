import { getState, setState, initState } from './state.js';
import { updateUI, startCountdown } from './ui.js';

async function pingFromBrowser(address) {
    const startTime = Date.now();
    try {
        await fetch(`http://${address}`, { method: 'HEAD', mode: 'no-cors', signal: AbortSignal.timeout(2500) });
    } catch (e) { }
    const latency = Date.now() - startTime;
    return latency >= 2500 ? 5000 : latency;
}

async function fetchServerMetadata(address) {
    let lastError = null;
    for (let i = 0; i < 3; i++) {
        try {
            const [host, port = '25565'] = address.split(':');
            const response = await fetch(`https://mc.ycxom.top/api/status?address=${host}&type=${port}`);
            if (!response.ok) throw new Error(`API 请求失败，状态码: ${response.status}`);
            const data = await response.json();
            if (!data.online) return { online: false, players: 'N/A', version: 'N/A' };
            return {
                online: true,
                players: `${data.players?.online || 0}/${data.players?.max || 0}`,
                version: data.version?.name || data.version || "未知",
            };
        } catch (error) {
            lastError = error;
            console.warn(`获取元数据失败 (尝试 ${i + 1}/3):`, address, error);
            if (i < 2) await new Promise(res => setTimeout(res, 500));
        }
    }
    console.error(`所有获取元数据的尝试均失败:`, address, lastError);
    return { online: false, players: 'API 错误', version: 'API 错误' };
}

/**
 * **最终修复版的核心函数**
 * 在开始执行前，会先从全局状态获取并清除任何可能存在的旧计时器，作为双保险。
 */
export async function testAllServers(isInitialLoad = false) {
    try {
        const oldIntervalId = getState().countdownIntervalId;
        if (oldIntervalId) {
            clearInterval(oldIntervalId);
            setState({ countdownIntervalId: null });
        }

        initState();

        const progressBar = document.getElementById('progressBar');
        progressBar.style.transition = 'transform 0.5s ease';
        progressBar.style.transform = 'scaleX(0)';
        progressBar.classList.add('progress-pulse');

        await updateUI({ isRefresh: !isInitialLoad, skipAnimations: isInitialLoad });

        await new Promise(resolve => setTimeout(resolve, 50));

        const { results } = getState();
        const tasks = [];
        results.forEach(group => {
            group.nodes.forEach(node => {
                const javaVersion = node.versions.find(v => v.type === 'Java');
                node.versions.forEach(version => {
                    let addressToPing = version.fullAddress;
                    if (version.type === 'PE') {
                        if (javaVersion) addressToPing = javaVersion.fullAddress;
                        else {
                            const [host] = version.fullAddress.split(':');
                            addressToPing = `${host}:80`;
                        }
                    }
                    tasks.push({ version, addressToPing, metadataAddress: version.fullAddress });
                });
            });
        });

        let completedCount = 0;
        const totalTasks = tasks.length * 2;
        const updateProgressBar = () => {
            const percentage = totalTasks > 0 ? (completedCount / totalTasks) : 0;
            progressBar.style.transform = `scaleX(${percentage})`;
        };

        await Promise.all(tasks.map(async (task) => {
            const latencyPromise = pingFromBrowser(task.addressToPing).then(latency => {
                completedCount++; requestAnimationFrame(updateProgressBar); return latency;
            });
            const metadataPromise = fetchServerMetadata(task.metadataAddress).then(statusData => {
                completedCount++; requestAnimationFrame(updateProgressBar); return statusData;
            });
            const [latency, statusData] = await Promise.all([latencyPromise, metadataPromise]);
            task.version.latency = latency;
            task.version.statusData = statusData;
            task.version.timestamp = new Date().toLocaleTimeString();
        }));

        results.forEach(group => {
            let representativeNode = null;
            for (const node of group.nodes) {
                const onlineVersion = node.versions.find(v => v.statusData && v.statusData.online);
                if (onlineVersion) { representativeNode = onlineVersion; break; }
            }
            if (representativeNode) {
                const { statusData } = representativeNode;
                group.status = 'online';
                group.players = statusData.players;
                group.version = statusData.version;
            } else {
                group.status = 'offline';
                group.players = '?/?';
                group.version = '未知';
            }
            group.nodes.forEach(node => {
                const latencies = node.versions.map(v => v.latency).filter(l => l >= 0 && l < 5000);
                node.bestLatency = latencies.length > 0 ? Math.min(...latencies) : -1;
                node.versions.forEach(v => delete v.statusData);
            });
        });

        setState({ results });
        progressBar.classList.remove('progress-pulse');
        await updateUI({ isRefresh: true, skipAnimations: false });

        startCountdown();

    } catch (error) {
        console.error("testAllServers 函数执行期间发生致命错误:", error);
        throw error;
    }
}