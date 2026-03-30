const express = require("express");
const multer = require("multer");
const fetch = require("node-fetch");
const cors = require("cors");
const FormData = require("form-data");

const app = express();
app.use(cors());

const upload = multer({ storage: multer.memoryStorage() });

// RATE LIMIT
const rateLimit = new Map();

app.post("/order", upload.single("bukti"), async (req, res) => {
  try {
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const now = Date.now();
    const user = rateLimit.get(ip) || { count: 0, time: now };

    if (now - user.time < 60000) {
      user.count++;
      if (user.count > 3) return res.status(429).json({ error: "Spam detected" });
    } else {
      user.count = 1;
      user.time = now;
    }
    rateLimit.set(ip, user);

    const { nama, paket, telegram } = req.body;
    const file = req.file;

    if (!nama || !file) {
      return res.status(400).json({ error: "Data tidak lengkap" });
    }

    const BOT_TOKEN = process.env.BOT_TOKEN;
    const CHAT_ID = process.env.CHAT_ID;
    const FIREBASE_DB = process.env.FIREBASE_DB;

    const idOrder = "INV-" + Math.floor(Math.random() * 999999);
    const waktu = new Date().toLocaleString("id-ID");

    // 🔥 AUTO APPROVE
    const status = "approved";

    // SIMPAN FIREBASE
    await fetch(`${FIREBASE_DB}/orders/${idOrder}.json`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nama,
        paket,
        waktu,
        status
      })
    });

    // TELEGRAM ADMIN
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: `🔥 AUTO APPROVED
👤 ${nama}
📦 ${paket}
🆔 ${idOrder}`
      })
    });

    // KIRIM FOTO
    const formData = new FormData();
    formData.append("chat_id", CHAT_ID);
    formData.append("photo", file.buffer, file.originalname);

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
      method: "POST",
      body: formData
    });

    // 🤖 KIRIM AKSES KE USER
    if (telegram) {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          chat_id: telegram,
          text: `✅ AKSES AKTIF

📦 Paket: ${paket}
🆔 ID: ${idOrder}

🔗 Link Akses:
https://your-access-link.com

Terima kasih 🙏`
        })
      });
    }

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ error: err.toString() });
  }
});

app.listen(3000, () => console.log("Server running"));
