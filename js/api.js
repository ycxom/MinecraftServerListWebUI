import { getState, setState, initState } from './state.js';
import { updateUI, startCountdown } from './ui.js';

const apiEndpoints = [
    // ... (API端点定义保持不变)
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
 * **PERFORMANCE OPTIMIZATION**
 * Fetches server status by racing all available API endpoints in parallel
 * and returning the result from the first one that responds successfully.
 * This significantly reduces the wait time compared to a sequential retry mechanism.
 * @param {string} address The server address.
 * @returns {Promise<object>} A promise that resolves with the server status.
 */
async function fetchServerStatusFaster(address) {
    try {
        const result = await Promise.any(apiEndpoints.map(api => api.fetcher(address)));
        return result.online ? result : { online: false, players: 'N/A', version: 'N/A' };
    } catch (error) {
        // Promise.any throws an AggregateError if all promises reject.
        console.warn(`All APIs failed for ${address}.`, error);
        return { online: false, players: '全部API错误', version: '全部API错误' };
    }
}

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

export async function testAllServers(isInitialLoad = false) {
    if (isInitialLoad) initState();
    if (window.countdownInterval) clearInterval(window.countdownInterval);

    const progressBar = document.getElementById('progressBar');
    progressBar.style.transition = 'transform 0.5s ease';
    progressBar.style.transform = 'scaleX(0)';
    progressBar.classList.add('progress-pulse');

    // On non-initial loads, we now use the highly efficient refresh flow
    if (!isInitialLoad) {
        await updateUI({ isRefresh: true, skipAnimations: true });
    }

    await new Promise(resolve => setTimeout(resolve, 50));

    let { results } = getState();

    // Fetch group statuses (online/offline) in parallel
    const groupPromises = results.map(async (group) => {
        const representativeNode = group.nodes[0]?.versions[0];
        if (representativeNode) {
            // Use the new, faster fetching strategy
            const status = await fetchServerStatusFaster(representativeNode.fullAddress);
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
    let animationFrameId = null;

    // **PERFORMANCE OPTIMIZATION**
    // This function updates the progress bar. By checking if an animation frame is
    // already pending, we prevent queuing up hundreds of redundant render calls.
    const updateProgressBar = () => {
        const percentage = (completedCount / allVersions.length);
        progressBar.style.transform = `scaleX(${percentage})`;
        animationFrameId = null; // Reset the ID after the frame has been rendered
    };

    // Fetch individual latencies in parallel
    const latencyPromises = allVersions.map(async (version) => {
        version.latency = await probeNodeLatency(version.fullAddress);
        version.timestamp = new Date().toLocaleTimeString();
        completedCount++;
        // Only request a new animation frame if one is not already pending
        if (!animationFrameId) {
            animationFrameId = requestAnimationFrame(updateProgressBar);
        }
    });

    await Promise.all(latencyPromises);

    // Ensure the final state of the progress bar is rendered correctly
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    updateProgressBar(); // Render the 100% state

    results.forEach(group => {
        group.nodes.forEach(node => {
            const latencies = node.versions.map(v => v.latency).filter(l => l >= 0 && l < 5000);
            node.bestLatency = latencies.length > 0 ? Math.min(...latencies) : -1;
        });
    });

    setState({ results });

    progressBar.classList.remove('progress-pulse');
    await updateUI({ isRefresh: !isInitialLoad });
    startCountdown();
}