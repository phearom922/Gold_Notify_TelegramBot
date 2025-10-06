export async function sendTelegram({ token, chatId, text, parseMode = "Markdown", silent = false }) {
    if (!token) throw new Error("TG_TOKEN missing");
    if (!chatId) throw new Error("TG_CHAT_ID missing");
    if (!text) throw new Error("text missing");

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const body = {
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
        disable_notification: !!silent
    };

    const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    if (!r.ok) {
        const t = await r.text();
        throw new Error(`Telegram HTTP ${r.status}: ${t}`);
    }
}
