import { getState, setState, initState } from './state.js';
import { updateUI, startCountdown } from './ui.js';

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
    progressBar.style.transition = 'width 0.5s ease';
    progressBar.style.width = '0%';
    progressBar.classList.add('progress-pulse');

    // During refresh, we don't need a full animated update here
    if (!isInitialLoad) {
        await updateUI({ isRefresh: true, skipAnimations: true });
    }

    await new Promise(resolve => setTimeout(resolve, 50));

    let { results } = getState();

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
        completedCount++;
        progressBar.style.width = `${(completedCount / allVersions.length) * 100}%`;
    });

    await Promise.all(latencyPromises);

    results.forEach(group => {
        group.nodes.forEach(node => {
            const latencies = node.versions.map(v => v.latency).filter(l => l >= 0 && l < 5000);
            node.bestLatency = latencies.length > 0 ? Math.min(...latencies) : -1;
        });
    });

    setState({ results });

    progressBar.classList.remove('progress-pulse');
    // FIX: Pass appropriate flag to distinguish refresh from initial load/group switch
    await updateUI({ isRefresh: !isInitialLoad });
    startCountdown();
}