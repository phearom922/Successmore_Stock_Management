// ใน server.js (หรือ bot.js) แก้ส่วน formatSummaryMessage ให้เป็นแบบนี้

function formatSummaryMessage(rows, code) {
    if (!rows.length) {
        return `❌ មិនមានផលិតផលកូដ \`${code}\``;
    }

    // ดึงชื่อสินค้าจาก object productId ที่ populate มา
    const productName = rows[0].productId?.name || 'Unknown';

    // รวม qty per warehouse
    const totals = {};
    rows.forEach(r => {
        const wh = r.warehouse || 'Unknown';
        totals[wh] = (totals[wh] || 0) + (Number(r.qtyOnHand) || 0);
    });

    // สร้างข้อความตอบกลับ
    let msg = `📦 Summary for *${code}* — _${productName}_\n\n`;
    for (const [warehouse, sum] of Object.entries(totals)) {
        msg += `🏭 _${warehouse}_\n   • ${productName} : *${sum}*\n`;
    }
    return msg;
}

// ตัวอย่างใน handler
bot.on('text', async ctx => {
    const code = ctx.message.text.trim();
    if (!/^[A-Z0-9]+$/.test(code) || code === '/help') {
        return ctx.reply('សូមវាយលេខកូដ...');
    }
    try {
        const resp = await fetchSummary(code);
        const rows = resp.data.data || [];
        const reply = formatSummaryMessage(rows, code);
        return ctx.replyWithMarkdown(reply);
    } catch (err) {
        return ctx.reply('❗ เกิดข้อผิดพลาด ลองใหม่อีกครั้ง');
    }
});
