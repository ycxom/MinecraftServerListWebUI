import { getState, setState, initState } from './state.js';
import { updateUI, startCountdown } from './ui.js';

/**
 * Fetches server status from the single, specified local API endpoint.
 * This function assumes the local API returns an object containing online status,
 * player counts, version, and latency.
 * @param {string} address The server address in "host:port" format.
 * @returns {Promise<object>} A promise that resolves with a standardized server status object.
 */
async function fetchServerStatus(address) {

    const [host, port = '25565'] = address.split(':');

    try {

        const response = await fetch(`https://mc.ycxom.top/api/status?address=${host}&type=${port}`);
        if (!response.ok) {
            throw new Error(`Local API failed with status: ${response.status}`);
        }
        const data = await response.json();

        if (!data.online) {
            return { online: false, players: 'N/A', version: 'N/A', latency: 5000 };
        }

        return {
            online: true,
            players: `${data.players?.online || 0}/${data.players?.max || 0}`,
            version: data.version?.name || data.version || "未知",
            latency: data.latency ? Math.round(data.latency) : 5000
        };
    } catch (error) {
        console.warn(`Local API request failed for ${address}.`, error);
        return { online: false, players: 'API 错误', version: 'API 错误', latency: 5000 };
    }
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
    const allVersions = results.flatMap(g => g.nodes.flatMap(n => n.versions));
    let completedCount = 0;
    let animationFrameId = null;

    const updateProgressBar = () => {
        const percentage = (completedCount / allVersions.length);
        progressBar.style.transform = `scaleX(${percentage})`;
        animationFrameId = null;
    };

    const allPromises = allVersions.map(async (version) => {
        const status = await fetchServerStatus(version.fullAddress);
        version.statusData = status;
        version.latency = status.latency;
        version.timestamp = new Date().toLocaleTimeString();
        completedCount++;
        if (!animationFrameId) {
            animationFrameId = requestAnimationFrame(updateProgressBar);
        }
    });

    await Promise.all(allPromises);

    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    updateProgressBar();



    results.forEach(group => {

        const representativeNode = group.nodes[0]?.versions[0];
        if (representativeNode && representativeNode.statusData) {
            const status = representativeNode.statusData;
            group.status = status.online ? 'online' : 'offline';
            group.players = status.online ? status.players : '?/?';
            group.version = status.online ? status.version : '未知';
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