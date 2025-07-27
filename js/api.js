import { getState, setState, initState } from './state.js';
import { updateUI, startCountdown } from './ui.js';

/**
 * 从浏览器端测量到服务器的延迟。
 * 最终优化版：并行执行3次探测，并返回成功探测的平均值，以减少误差。
 * @param {string} address - 服务器地址，格式为 "host:port"。
 * @returns {Promise<number>} 一个 Promise，会解析为平均延迟的毫秒数；如果所有探测都超时，则为 5000。
 */
async function pingFromBrowser(address) {
    // 定义单次探测的函数
    const pingOnce = async () => {
        const startTime = Date.now();
        try {
            // 设置一个合理的单次超时时间，例如2秒
            await fetch(`http://${address}`, { method: 'HEAD', mode: 'no-cors', signal: AbortSignal.timeout(2000) });
        } catch (e) {
            // 这是一个预期的行为
        }
        return Date.now() - startTime;
    };

    // 同时发起3次探测
    const pings = await Promise.all([
        pingOnce(),
        pingOnce(),
        pingOnce()
    ]);

    // 过滤掉所有超时的结果
    const successfulPings = pings.filter(latency => latency < 2000);

    // 如果没有任何一次成功，则返回最终的超时值
    if (successfulPings.length === 0) {
        return 5000;
    }

    // 计算所有成功探测的平均延迟
    const averageLatency = successfulPings.reduce((sum, latency) => sum + latency, 0) / successfulPings.length;

    // 返回四舍五入后的整数
    return Math.round(averageLatency);
}


/**
 * 从后端 API 获取服务器的元数据 (玩家数, 版本号等)。
 * 内置了重试逻辑：如果请求失败，会自动重试，最多3次。
 * @param {string} address - 服务器地址，格式为 "host:port"。
 * @returns {Promise<object>} 一个 Promise，会解析为服务器的元数据。
 */
async function fetchServerMetadata(address) {
    let lastError = null;
    for (let i = 0; i < 3; i++) {
        try {
            const [host, port = '25565'] = address.split(':');
            const response = await fetch(`https://mc.ycxom.top/api/status?address=${host}&type=${port}`);
            if (!response.ok) {
                throw new Error(`API 请求失败，状态码: ${response.status}`);
            }
            const data = await response.json();
            if (!data.online) {
                return { online: false, players: 'N/A', version: 'N/A' };
            }
            return {
                online: true,
                players: `${data.players?.online || 0}/${data.players?.max || 0}`,
                version: data.version?.name || data.version || "未知",
            };
        } catch (error) {
            lastError = error;
            console.warn(`获取元数据失败 (尝试 ${i + 1}/3):`, address, error);
            if (i < 2) {
                await new Promise(res => setTimeout(res, 500));
            }
        }
    }
    console.error(`所有获取元数据的尝试均失败:`, address, lastError);
    return { online: false, players: 'API 错误', version: 'API 错误' };
}


export async function testAllServers(isInitialLoad = false) {
    if (isInitialLoad) initState();
    if (window.countdownInterval) clearInterval(window.countdownInterval);

    const progressBar = document.getElementById('progressBar');
    progressBar.style.transition = 'transform 0.5s ease';
    progressBar.style.transform = 'scaleX(0)';
    progressBar.classList.add('progress-pulse');
    if (!isInitialLoad) {
        await updateUI({ isRefresh: true, skipAnimations: true });
    }

    await new Promise(resolve => setTimeout(resolve, 50));

    let { results } = getState();
    const tasks = [];

    results.forEach(group => {
        group.nodes.forEach(node => {
            const javaVersion = node.versions.find(v => v.type === 'Java');
            node.versions.forEach(version => {
                let addressToPing = version.fullAddress;
                if (version.type === 'PE') {
                    if (javaVersion) {
                        addressToPing = javaVersion.fullAddress;
                    } else {
                        const [host] = version.fullAddress.split(':');
                        addressToPing = `${host}:80`;
                    }
                }
                tasks.push({
                    version: version,
                    addressToPing: addressToPing,
                    metadataAddress: version.fullAddress,
                });
            });
        });
    });

    let completedCount = 0;
    let animationFrameId = null;

    const updateProgressBar = () => {
        const percentage = (completedCount / (tasks.length * 2));
        progressBar.style.transform = `scaleX(${percentage})`;
        animationFrameId = null;
    };

    const scheduleProgressBarUpdate = () => {
        completedCount++;
        if (!animationFrameId) {
            animationFrameId = requestAnimationFrame(updateProgressBar);
        }
    };

    const allPromises = tasks.map(async (task) => {
        const [latency, statusData] = await Promise.all([
            pingFromBrowser(task.addressToPing).finally(scheduleProgressBarUpdate),
            fetchServerMetadata(task.metadataAddress).finally(scheduleProgressBarUpdate)
        ]);
        task.version.latency = latency;
        task.version.statusData = statusData;
        task.version.timestamp = new Date().toLocaleTimeString();
    });

    await Promise.all(allPromises);

    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    completedCount = tasks.length * 2;
    updateProgressBar();

    results.forEach(group => {
        let representativeNode = null;
        for (const node of group.nodes) {
            const onlineVersion = node.versions.find(v => v.statusData && v.statusData.online);
            if (onlineVersion) {
                representativeNode = onlineVersion;
                break;
            }
        }
        
        if (representativeNode) {
            const status = representativeNode.statusData;
            group.status = 'online';
            group.players = status.players;
            group.version = status.version;
        } else {
            group.status = 'offline';
            group.players = '?/?';
            group.version = '未知';
        }

        group.nodes.forEach(node => {
            const latencies = node.versions
                .map(v => v.latency)
                .filter(l => l >= 0 && l < 5000);
            node.bestLatency = latencies.length > 0 ? Math.min(...latencies) : -1;
            node.versions.forEach(v => delete v.statusData);
        });
    });

    setState({ results });
    progressBar.classList.remove('progress-pulse');
    await updateUI({ isRefresh: !isInitialLoad });
    startCountdown();
}