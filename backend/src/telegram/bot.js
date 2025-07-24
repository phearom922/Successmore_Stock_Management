require('dotenv').config();
const express = require('express');
const { Telegraf } = require('telegraf');
const axios = require('axios');

// Environment variables
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API_BASE_URL = process.env.API_BASE_URL.replace('localhost', '127.0.0.1');
const SERVICE_USER = process.env.SERVICE_USER;
const SERVICE_PASS = process.env.SERVICE_PASS;
const WEBHOOK_URL = process.env.WEBHOOK_URL;       // e.g. https://yourdomain.com
const PORT = process.env.PORT || 3002;

// Bot setup
const bot = new Telegraf(BOT_TOKEN);
let serviceToken = null;

// 1.พื่อดึง JWT ทุกครั้งที่จำเป็น
async function loginService() {
    const res = await axios.post(
        `${API_BASE_URL}/api/auth/login`,
        { username: SERVICE_USER, password: SERVICE_PASS }
    );
    serviceToken = res.data.token;
    console.log('✔️ Service logged in, token acquired');
}

// 2. Wrapper เรียก API summary พร้อม retry ถ้า token หมดอายุ
async function fetchSummary(code) {
    if (!serviceToken) {
        await loginService();
    }
    try {
        return await axios.get(
            `${API_BASE_URL}/api/stock-reports`,
            {
                params: { type: 'summary', search: code },
                headers: { Authorization: `Bearer ${serviceToken}` },
                timeout: 5000
            }
        );
    } catch (err) {
        if (err.response?.status === 401) {
            // token หมดอายุ → ล็อกอินใหม่แล้ว retry
            await loginService();
            return await axios.get(
                `${API_BASE_URL}/api/stock-reports`,
                {
                    params: { type: 'summary', search: code },
                    headers: { Authorization: `Bearer ${serviceToken}` },
                    timeout: 5000
                }
            );
        }
        throw err;
    }
}

// 3. สร้างเมนู /help ใน UI
(async () => {
    try {
        await bot.telegram.setMyCommands([
            { command: 'help', description: 'Show usage instructions' },
        ]);
        console.log('✅ Bot commands set');
    } catch (err) {
        console.error('❌ Failed to set commands:', err);
    }
})();

// 4. /help command
bot.command('help', (ctx) => {
    ctx.reply(
        'សូមវាយលេខកូដផលិតផលដែលអ្នកចង់ដឹង ហាមដកឃ្លា ឬការសរសេរជាអក្សរតូច ឧទាហរណ៍ 1015KH'
    );
});

// 5. ฟังก์ชันสรุปยอดรวมต่อ warehouse
function formatSummaryMessage(rows, code) {
    if (!rows.length) {
        return `❌ សុំទោស មិនមានផលិតផលកូដ \`${code}\``;
    }
    const totals = {};
    rows.forEach(r => {
        const wh = r.warehouse || 'Unknown';
        const q = Number(r.qtyOnHand) || 0;
        totals[wh] = (totals[wh] || 0) + q;
    });
    let msg = `📦 Summary for *${code}*\n\n`;
    for (const [warehouse, sum] of Object.entries(totals)) {
        msg += `🏭 _${warehouse}_\n   • *${sum}*\n`;
    }
    return msg;
}

// 6. Main text handler
bot.on('text', async (ctx) => {
    const code = ctx.message.text.trim();

    // กรอง /help และรูปแบบโค้ด
    if (code === '/help') return;
    if (!/^[A-Z0-9]+$/.test(code)) {
        return ctx.reply(
            'សូមវាយលេខកូដផលិតផលដែលអ្នកចង់ដឹង ហាមដកឃ្លា ឬការសរសេរជាអក្សរតូច ឧទាហរណ៍ 1015KH'
        );
    }

    try {
        const resp = await fetchSummary(code);
        const rows = resp.data.data || [];
        const reply = formatSummaryMessage(rows, code);
        return ctx.replyWithMarkdown(reply);
    } catch (err) {
        console.error('Bot error:', err.response?.data || err.message);
        return ctx.reply('❗ មានបញ្ហាកើតឡើង សូមព្យាយាមម្តងទៀត');
    }
});

// 7. Webhook setup with Express
const app = express();

// ให้ Express รับ Webhook POST
const hookPath = `/bot${BOT_TOKEN}`;
app.use(bot.webhookCallback(hookPath));

app.get('/', (req, res) => res.send('Bot is running'));

// ตั้ง Webhook บอก Telegram ส่ง update มาที่ URL นี้
(async () => {
    try {
        await bot.telegram.setWebhook(`${WEBHOOK_URL}${hookPath}`);
        console.log('✅ Webhook set to', `${WEBHOOK_URL}${hookPath}`);
    } catch (err) {
        console.error('❌ Failed to set webhook:', err);
        process.exit(1);
    }
})();

// Start server
app.listen(PORT, () => {
    console.log(`Express server + Bot listening on port ${PORT}`);
});