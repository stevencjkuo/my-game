const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors()); // 允許跨網域請求
app.use(express.json());

// 這是一個代理路由
app.get('/api/data', async (req, res) => {
    try {
        // 從環境變數讀取金鑰，金鑰不會傳給前端
        const API_KEY = process.env.MY_SECRET_KEY; 
        
        // 呼叫真正的第三方 API
        const response = await axios.get(`https://api.external-service.com/v1/data?key=${API_KEY}`);
        
        // 只回傳資料給前端
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: '伺服器錯誤' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`伺服器運行於埠號 ${PORT}`));
