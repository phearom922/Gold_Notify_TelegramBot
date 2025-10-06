import "dotenv/config.js";
import express from "express";
import { upsertSubscriber } from "./db.js";
import { sendTelegram } from "./notifyTelegram.js"; // ✅ ใช้ฟังก์ชันส่งข้อความที่มีอยู่แล้ว

const app = express();
app.use(express.json());

const WEBHOOK_SECRET = process.env.TG_WEBHOOK_SECRET || "";
const TG_TOKEN = process.env.TG_TOKEN;

app.post("/tg/webhook", async (req, res) => {
    try {
        if (WEBHOOK_SECRET && req.query.secret !== WEBHOOK_SECRET) {
            return res.status(403).send("Forbidden");
        }

        const update = req.body;
        const msg = update?.message || update?.edited_message;
        if (!msg) return res.json({ ok: true });

        if (msg.chat?.type === "private" && typeof msg.chat?.id !== "undefined") {
            const chat_id = msg.chat.id;
            const text = (msg.text || "").trim();

            // ✅ เมื่อผู้ใช้พิมพ์ /start
            if (text === "/start") {
                await upsertSubscriber({
                    chat_id,
                    first_name: msg.from?.first_name,
                    username: msg.from?.username,
                    language_code: msg.from?.language_code
                });

                // ✅ ส่งข้อความตอบกลับไปหาผู้ใช้
                const name = msg.from?.first_name || "អ្នកប្រើប្រាស់"; // “ผู้ใช้” (เขมร)
                const welcome =
                    `សួស្តី ${name} 👋  
អ្នកបានភ្ជាប់ជាមួយសារជូនដំណឹងអំពីតម្លៃមាសប្រចាំថ្ងៃហើយ 💰  
តម្លៃមាសនឹងត្រូវផ្ញើទៅអ្នករៀងរាល់ 30នាទីម្តង។`;

                await sendTelegram({
                    token: TG_TOKEN,
                    chatId: chat_id,
                    text: welcome,
                    parseMode: "Markdown"
                });
            }
        }

        res.json({ ok: true });
    } catch (e) {
        console.error("Webhook error:", e);
        res.status(500).json({ ok: false });
    }
});

const PORT = process.env.PORT || 3000;
app.get("/", (_req, res) => res.send("Telegram webhook is alive."));
app.listen(PORT, () => console.log(`Webhook listening on :${PORT}`));
