// src/server.js
import "dotenv/config.js";
import express from "express";
import { upsertSubscriber } from "./db.js";
import { sendTelegram } from "./notifyTelegram.js";

const app = express();
app.use(express.json({ limit: "1mb" }));

const WEBHOOK_SECRET = process.env.TG_WEBHOOK_SECRET || "";
const TG_TOKEN = process.env.TG_TOKEN;

// 👉 helper log แบบสั้น
function log(...args) { console.log("[WEBHOOK]", ...args); }

app.post("/tg/webhook", (req, res) => {
    // 1) ตรวจ secret เร็วๆ
    if (WEBHOOK_SECRET && req.query.secret !== WEBHOOK_SECRET) {
        log("403 bad secret");
        return res.status(403).send("Forbidden");
    }

    // 2) ตอบ OK ก่อน เพื่อไม่ให้ Telegram รอ
    res.json({ ok: true });

    // 3) ประมวลผล “ฉากหลัง” (ไม่รบกวนการตอบ HTTP)
    (async () => {
        try {
            const update = req.body;
            const msg = update?.message || update?.edited_message;
            if (!msg) return;

            // log ทุกคำขอ เพื่อดูว่ามาถึงจริงไหม
            log("update from", msg.from?.id, "text:", msg.text);

            if (msg.chat?.type === "private" && typeof msg.chat?.id !== "undefined") {
                const chat_id = String(msg.chat.id);
                const text = (msg.text || "").trim();

                if (text === "/start") {
                    await upsertSubscriber({
                        chat_id,
                        first_name: msg.from?.first_name,
                        username: msg.from?.username,
                        language_code: msg.from?.language_code
                    });

                    const name = msg.from?.first_name || "";
                    const welcome =
                        `សួស្តី ${name} 👋  
អ្នកបានចុះឈ្មោះជាវដើម្បីទទួលការជូនដំណឹងតម្លៃមាសប្រចាំថ្ងៃហើយ 💰  
បើចង់ឈប់ទទួលការជូនដំណឹង សូមផ្ញើ /stop មកខ្ញុំ។`;

                    await sendTelegram({
                        token: TG_TOKEN,
                        chatId: chat_id,
                        text: welcome,
                        parseMode: "Markdown"
                    });
                    log("welcomed", chat_id);
                }

                if (text === "/stop") {
                    // (ถ้าต้องการ: ลบออกจาก subscribers — ไว้เพิ่มทีหลังได้)
                }
            }
        } catch (e) {
            log("handler error:", e?.message || e);
        }
    })();
});

const PORT = process.env.PORT || 3000;
app.get("/", (_req, res) => res.send("Telegram webhook is alive."));
app.listen(PORT, () => console.log(`Webhook listening on :${PORT}`));
