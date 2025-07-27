let state = {
    serverData: [],
    results: [],
    pageConfig: {},
    groupSelectorDropdown: null,
    isTransitioning: false,
    countdownIntervalId: null,
};

export function getState() {
    return state;
}

export function setState(newState) {
    state = { ...state, ...newState };
}

export function initState() {
    const { serverData, results: oldResults } = getState();
    const openStates = new Map();
    if (oldResults && oldResults.length > 0) {
        oldResults.forEach(group => {
            group.nodes.forEach(node => {
                const key = `${group.groupName}::${node.nodeName}`;
                if (node.isOpen) {
                    openStates.set(key, true);
                }
            });
        });
    }

    const newResults = JSON.parse(JSON.stringify(serverData));
    newResults.forEach(group => {
        group.status = 'testing';
        group.players = '?/?';
        group.version = '未知';
        group.nodes.forEach(node => {
            const key = `${group.groupName}::${node.nodeName}`;
            node.isOpen = openStates.get(key) || false;
            node.bestLatency = -1;
            node.versions.forEach(version => {
                version.latency = -1;
                version.timestamp = new Date().toLocaleTimeString();
            });
        });
    });

    setState({ results: newResults });
}