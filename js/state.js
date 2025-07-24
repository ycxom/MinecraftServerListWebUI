let state = {
    serverData: [],
    results: [],
    pageConfig: {},
    groupSelectorDropdown: null,
    isTransitioning: false,
};

export function getState() {
    return state;
}

export function setState(newState) {
    state = { ...state, ...newState };
}

export function initState() {
    const { serverData } = state;
    const results = JSON.parse(JSON.stringify(serverData));
    results.forEach(group => {
        group.status = 'testing';
        group.players = '?/?';
        group.version = '未知';
        group.nodes.forEach(node => {
            node.isOpen = false;
            node.bestLatency = -1;
            node.versions.forEach(version => {
                version.latency = -1;
                version.timestamp = new Date().toLocaleTimeString();
            });
        });
    });
    setState({ results });
}