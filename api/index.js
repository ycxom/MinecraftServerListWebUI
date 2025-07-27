const express = require('express');
const util = require('minecraft-server-util');

const app = express();
const PORT = process.env.PORT || 3001; 

// CORS Middleware
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// 唯一的标准状态端点
app.get('/api/status', async (req, res) => {
    const { address, type = 'java' } = req.query;

    if (!address) {
        return res.status(400).json({ error: 'Server address is required' });
    }

    // --- *** FIX: 修复端口解析逻辑，使其更加灵活 *** ---
    let host;
    let port;

    const addressParts = address.split(':');
    host = addressParts[0];

    if (addressParts.length > 1) {
        // 1. 优先从 address 参数中获取端口 (例如: 'tx_cloud.ycxom.com:25566')
        port = parseInt(addressParts[1], 10);
    } else {
        // 2. 如果 address 中没有端口，尝试从 type 参数解析
        const portFromType = parseInt(type, 10);
        if (!isNaN(portFromType)) {
            // 如果 'type' 是一个有效的数字，则将其用作端口
            port = portFromType;
        } else {
            // 3. 如果 'type' 不是数字 (例如 'java' 或 'pe')，则使用默认端口
            port = (type.toLowerCase() === 'java' ? 25565 : 19132);
        }
    }
    // --- *** 修复结束 *** ---

    try {
        let result;
        // 注意：这里的 type.toLowerCase() 仍然用于判断服务器类型，
        // 即便它有时被用作端口号。这是安全的，因为数字转为小写不变。
        if (type.toLowerCase() === 'pe' || type.toLowerCase() === 'bedrock') {
            result = await util.statusBedrock(host, port, { timeout: 5000 });
            res.json({
                online: true,
                description: result.motd.clean,
                favicon: null,
                latency: result.roundTripLatency,
                players: {
                    max: result.players.max,
                    online: result.players.online,
                    sample: []
                },
                version: {
                    name: result.version || "N/A",
                    protocol: result.protocolVersion || -1
                }
            });
        } else {
            // 对于 'java' 或任何非 'pe'/'bedrock' 的 type 值，都按 Java 版处理
            result = await util.status(host, port, { timeout: 5000 });
            res.json({
                online: true,
                description: result.motd.clean,
                favicon: result.favicon,
                latency: result.roundTripLatency,
                players: {
                    max: result.players.max,
                    online: result.players.online,
                    sample: result.players.sample || []
                },
                version: {
                    name: result.version.name,
                    protocol: result.version.protocol
                }
            });
        }
    } catch (error) {
        // 当查询失败时，返回结构一致的“离线”标准格式
        res.status(200).json({
            online: false,
            description: "服务器离线或无法访问",
            favicon: null,
            latency: -1,
            players: { max: 0, online: 0, sample: [] },
            version: { name: "N/A", protocol: -1 }
        });
    }
});

// 本地调试服务器
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`✅ API服务器已启动 (已修复端口解析), 正在监听 http://localhost:${PORT}`);
    console.log(`🚀 您现在可以用两种方式测试:`);
    console.log(`   1. => http://localhost:${PORT}/api/status?address=tx_cloud.ycxom.com:25566`);
    console.log(`   2. => http://localhost:${PORT}/api/status?address=ai.ycxom.com&type=25566`);
  });
}

module.exports = app;