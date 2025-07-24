import { setState } from './state.js';
import { applyPageConfig } from './ui.js';

export async function loadAndProcessConfig() {
    try {
        const response = await fetch('config.json');
        if (!response.ok) throw new Error(`无法加载 config.json`);
        const fullConfig = await response.json();
        const pageConfig = fullConfig.pageConfig || {};
        setState({ pageConfig });
        applyPageConfig(pageConfig);
        return fullConfig.MCServerList.map(group => ({
            groupName: group.name,
            nodes: group.servers.map(node => {
                const versions = [];
                if (node['port-java']) versions.push({ type: 'Java', port: node['port-java'], fullAddress: `${node.address}:${node['port-java']}` });
                if (node['port-pe']) versions.push({ type: 'PE', port: node['port-pe'], fullAddress: `${node.address}:${node['port-pe']}` });
                return { nodeName: node.name, versions: versions };
            })
        }));
    } catch (error) {
        console.error("加载配置文件失败:", error);
        document.getElementById('groups-container').innerHTML = `<h2 style="color: red; text-align: center;">错误: ${error.message}</h2>`;
        return [];
    }
}