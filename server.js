const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const app = express();

// =====================================
// CONFIG
// =====================================

const PORT = process.env.PORT || 3000;
const SITE_NAME = "Lojo";
const SITE_URL =
    process.env.SITE_URL ||
    (process.env.RAILWAY_PUBLIC_DOMAIN
        ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
        : "http://localhost:3000");

const VIDEO_FILE = path.join(__dirname, "videos.json");

// Create uploads folder (fallback if Cloudinary fails)
const UPLOAD_DIR = path.join(__dirname, "public", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// =====================================
// CLOUDINARY SETUP
// =====================================

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "rtlbhsis",
    api_key: process.env.CLOUDINARY_API_KEY || "785564953654681",
    api_secret: process.env.CLOUDINARY_API_SECRET || "62626262662626",
    secure: true   // ← IMPORTANT: ensures image URLs use HTTPS
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'lojo-videos',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        transformation: [{ width: 1200, height: 630, crop: 'limit' }]
    }
});

const upload = multer({ storage: storage });

// =====================================
// MIDDLEWARE
// =====================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// =====================================
// VIDEO DATABASE
// =====================================

const defaultVideos = [
    {
        id: 1,
        title: "Welcome to Lojo",
        description: "Watch this amazing video now! 🎬",
        thumbnail: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&h=630&fit=crop",
        siteName: "Viral Videos"
    },
    {
        id: 2,
        title: "Amazing Nature Video",
        description: "Beautiful scenery 🌄",
        thumbnail: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&h=630&fit=crop",
        siteName: "Nature Lovers"
    },
    {
        id: 3,
        title: "Funny Cat Compilation",
        description: "Funny moments 😂",
        thumbnail: "https://images.unsplash.com/photo-1574158622682-e40e69881006?w=1200&h=630&fit=crop",
        siteName: "Funny Moments"
    }
];

function loadVideos() {
    if (!fs.existsSync(VIDEO_FILE)) {
        fs.writeFileSync(VIDEO_FILE, JSON.stringify(defaultVideos, null, 2));
    }
    try {
        return JSON.parse(fs.readFileSync(VIDEO_FILE, "utf8"));
    } catch (error) {
        console.log("Database error:", error);
        return defaultVideos;
    }
}

let videos = loadVideos();

function saveVideos() {
    fs.writeFileSync(VIDEO_FILE, JSON.stringify(videos, null, 2));
}

function findVideo(id) {
    return videos.find(video => video.id == id);
}

function newId() {
    return videos.length ? Math.max(...videos.map(v => v.id)) + 1 : 1;
}

// =====================================
// HTML ESCAPE
// =====================================

function escapeHtml(text) {
    if (!text) return "";
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// =====================================
// BOT DETECTION
// =====================================

const bots = {
    Facebook: ["facebookexternalhit", "facebot"],
    WhatsApp: ["whatsapp"],
    Instagram: ["instagram", "instagrambot"],
    TikTok: ["tiktok", "bytedance"],
    Twitter: ["twitterbot", "xbot"],
    LinkedIn: ["linkedinbot"],
    Telegram: ["telegrambot"],
    Slack: ["slackbot", "slack-imgproxy"],
    Pinterest: ["pinterest"],
    Discord: ["discordbot"],
    Reddit: ["redditbot"],
    Skype: ["skypeuripreview"],
    Apple: ["applebot"],
    Google: ["googlebot"],
    Yandex: ["yandex"],
    Viber: ["viber"],
    Line: ["line/"]
};

const GENERIC_BOT_PATTERN = /\b(bot|crawler|crawling|spider|facebookexternalhit|linkpreview|unfurl|embedly|opengraph)\b/i;

function detectBot(agent = "") {
    agent = agent.toLowerCase();
    for (const [platform, signatures] of Object.entries(bots)) {
        if (signatures.some(sig => agent.includes(sig))) {
            return { detected: true, platform };
        }
    }
    if (GENERIC_BOT_PATTERN.test(agent)) {
        return { detected: true, platform: "generic" };
    }
    return { detected: false, platform: null };
}

// =====================================
// UPLOAD ROUTE (Cloudinary)
// =====================================

app.post("/api/upload", upload.single("image"), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No image file uploaded" });
    }
    res.json({
        imageUrl: req.file.path,
        filename: req.file.filename,
        message: "Image uploaded successfully to Cloudinary"
    });
});

// =====================================
// HOMEPAGE
// =====================================

app.get("/", (req, res) => {
    if (req.query.video) {
        res.set("Cache-Control", "no-store");
        return res.redirect(302, `/video/${req.query.video}`);
    }
    res.set("Cache-Control", "no-store");
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// =====================================
// HEALTH CHECK
// =====================================

app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        service: "Lojo",
        timestamp: new Date().toISOString()
    });
});

// =====================================
// VIDEO SOCIAL PREVIEW
// =====================================

app.get("/video/:id", (req, res) => {
    const video = findVideo(req.params.id);
    if (!video) {
        res.set("Cache-Control", "no-store");
        return res.status(404).send("<h1>Video Not Found</h1>");
    }

    const visitor = detectBot(req.headers["user-agent"] || "");
    if (!visitor.detected) {
        res.set("Cache-Control", "no-store");
        return res.redirect(302, "/");
    }

    res.set({
        "Cache-Control": "private, no-store",
        "Vary": "User-Agent",
        "X-Robots-Tag": "all"
    });

    const safeTitle = escapeHtml(video.title);
    const safeDescription = escapeHtml(video.description);
    const safeThumbnail = escapeHtml(video.thumbnail);
    const safeId = escapeHtml(String(video.id));
    const safeSiteName = escapeHtml(video.siteName || SITE_NAME);

    console.log("📤 Serving OG tags for video:", video.id);
    console.log("   Title:", safeTitle);
    console.log("   Thumbnail:", safeThumbnail);

    res.send(`

<!DOCTYPE html>
<html>
<head>
<title>${safeTitle}</title>
<link rel="canonical" href="${SITE_URL}/video/${safeId}">
<meta property="og:title" content="${safeTitle}">
<meta property="og:description" content="${safeDescription}">
<meta property="og:image" content="${safeThumbnail}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${safeTitle}">
<meta property="og:locale" content="en_US">
<meta property="og:type" content="video.other">
<meta property="og:url" content="${SITE_URL}/video/${safeId}">
<meta property="og:site_name" content="${safeSiteName}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${safeTitle}">
<meta name="twitter:description" content="${safeDescription}">
<meta name="twitter:image" content="${safeThumbnail}">
</head>
<body></body>
</html>

`);
});

// =====================================
// VIDEO API
// =====================================

app.get("/api/videos", (req, res) => {
    res.json(videos);
});

app.get("/api/videos/:id", (req, res) => {
    const video = findVideo(req.params.id);
    if (!video) return res.status(404).json({ error: "Video not found" });
    res.json(video);
});

app.post("/api/videos", (req, res) => {
    let { title, description, thumbnail, siteName } = req.body;
    if (!title || !description || !thumbnail) {
        return res.status(400).json({ error: "Missing fields: title, description, and thumbnail are required" });
    }
    title = typeof title === "string" ? title.trim() : "";
    description = typeof description === "string" ? description.trim() : "";
    thumbnail = typeof thumbnail === "string" ? thumbnail.trim() : "";
    siteName = typeof siteName === "string" ? siteName.trim() : SITE_NAME;
    if (!title || !description || !thumbnail) {
        return res.status(400).json({ error: "Fields cannot be empty or contain only whitespace" });
    }
    const video = { id: newId(), title, description, thumbnail, siteName };
    videos.push(video);
    saveVideos();
    res.status(201).json(video);
});

app.put("/api/videos/:id", (req, res) => {
    const video = findVideo(req.params.id);
    if (!video) return res.status(404).json({ error: "Video not found" });
    const updatedFields = {};
    if (req.body.title !== undefined) {
        const title = typeof req.body.title === "string" ? req.body.title.trim() : "";
        if (title) updatedFields.title = title;
    }
    if (req.body.description !== undefined) {
        const description = typeof req.body.description === "string" ? req.body.description.trim() : "";
        if (description) updatedFields.description = description;
    }
    if (req.body.thumbnail !== undefined) {
        const thumbnail = typeof req.body.thumbnail === "string" ? req.body.thumbnail.trim() : "";
        if (thumbnail) updatedFields.thumbnail = thumbnail;
    }
    if (req.body.siteName !== undefined) {
        const siteName = typeof req.body.siteName === "string" ? req.body.siteName.trim() : "";
        if (siteName) updatedFields.siteName = siteName;
    }
    Object.assign(video, updatedFields);
    saveVideos();
    res.json(video);
});

app.delete("/api/videos/:id", (req, res) => {
    const before = videos.length;
    videos = videos.filter(video => video.id != req.params.id);
    if (videos.length === before) {
        return res.status(404).json({ error: "Video not found" });
    }
    saveVideos();
    res.json({ message: "Video deleted" });
});

// =====================================
// STATIC FILES
// =====================================

app.use(express.static(path.join(__dirname, "public")));

// =====================================
// 404
// =====================================

app.use((req, res) => {
    res.status(404).send("<h1>404 Page Not Found</h1>");
});

// =====================================
// START SERVER
// =====================================

app.listen(PORT, "0.0.0.0", () => {
    console.log("==============================");
    console.log(`🚀 ${SITE_NAME} running`);
    console.log(`🌐 ${SITE_URL}`);
    console.log(`📹 Videos: ${videos.length}`);
    console.log("🤖 Social preview enabled");
    console.log("💾 Storage: videos.json");
    console.log("☁️ Cloudinary: Enabled");
    console.log("==============================");
});

module.exports = app;
