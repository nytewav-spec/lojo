const express = require("express");
const path = require("path");
const fs = require("fs");

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


// =====================================
// MIDDLEWARE
// =====================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// NOTE: express.static is registered further down, AFTER the specific
// routes (/, /health, /video/:id, /api/*). This guarantees those routes
// always win even if a file/folder happens to exist under public/ with a
// colliding name (e.g. public/video/). Express matches routes/middleware
// in registration order, so this ordering removes any possibility of the
// static folder silently shadowing the preview/redirect logic.


// =====================================
// VIDEO DATABASE
// =====================================

const defaultVideos = [
    {
        id: 1,
        title: "Welcome to Lojo",
        description: "Watch this amazing video now! 🎬",
        thumbnail: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&h=630&fit=crop"
    },
    {
        id: 2,
        title: "Amazing Nature Video",
        description: "Beautiful scenery 🌄",
        thumbnail: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&h=630&fit=crop"
    },
    {
        id: 3,
        title: "Funny Cat Compilation",
        description: "Funny moments 😂",
        thumbnail: "https://images.unsplash.com/photo-1574158622682-e40e69881006?w=1200&h=630&fit=crop"
    }
];


function loadVideos(){

    if(!fs.existsSync(VIDEO_FILE)){

        fs.writeFileSync(
            VIDEO_FILE,
            JSON.stringify(defaultVideos,null,2)
        );

    }


    try{

        return JSON.parse(
            fs.readFileSync(VIDEO_FILE,"utf8")
        );

    }catch(error){

        console.log("Database error:",error);

        return defaultVideos;

    }

}



let videos = loadVideos();



function saveVideos(){

    fs.writeFileSync(
        VIDEO_FILE,
        JSON.stringify(videos,null,2)
    );

}



function findVideo(id){

    return videos.find(
        video => video.id == id
    );

}



function newId(){

    return videos.length
        ? Math.max(...videos.map(v=>v.id)) + 1
        : 1;

}


// =====================================
// HTML ESCAPE (Prevents XSS)
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
// SOCIAL MEDIA BOT DETECTION
// =====================================

const bots = {

    Facebook:[
        "facebookexternalhit",
        "facebot"
    ],

    WhatsApp:[
        "whatsapp"
    ],

    Instagram:[
        "instagram",
        "instagrambot"
    ],

    TikTok:[
        "tiktok",
        "bytedance"
    ],

    Twitter:[
        "twitterbot",
        "xbot"
    ],

    LinkedIn:[
        "linkedinbot"
    ],

    Telegram:[
        "telegrambot"
    ],

    Slack:[
        "slackbot",
        "slack-imgproxy"
    ],

    Pinterest:[
        "pinterest"
    ],

    Discord:[
        "discordbot"
    ],

    Reddit:[
        "redditbot"
    ],

    Skype:[
        "skypeuripreview"
    ],

    Apple:[
        "applebot"
    ],

    Google:[
        "googlebot"
    ],

    Yandex:[
        "yandex"
    ],

    Viber:[
        "viber"
    ],

    Line:[
        "line/"
    ]

};


// Generic fallback for unfurlers/crawlers not explicitly listed above.
// Anything matching this pattern is treated as a bot even if it doesn't
// match one of the named platforms. Tightened to whole-word matches on
// unambiguous crawler/unfurler terms only — the previous version matched
// loose substrings like "fetch"/"check"/"scan" which risked misclassifying
// real browsers/webviews as bots.
const GENERIC_BOT_PATTERN =
    /\b(bot|crawler|crawling|spider|facebookexternalhit|linkpreview|unfurl|embedly|opengraph)\b/i;


function detectBot(agent = "") {

    agent = agent.toLowerCase();

    for (const [platform, signatures] of Object.entries(bots)) {

        if (signatures.some(sig => agent.includes(sig))) {

            return {
                detected: true,
                platform
            };

        }
    }

    if (GENERIC_BOT_PATTERN.test(agent)) {

        return {
            detected: true,
            platform: "generic"
        };

    }

    return {
        detected: false,
        platform: null
    };

}



// =====================================
// HOMEPAGE
// =====================================


app.get("/",(req,res)=>{


    // Old links:
    // /?video=1
    // New:
    // /video/1


    if(req.query.video){

        res.set("Cache-Control", "no-store");

        return res.redirect(
            302,
            `/video/${req.query.video}`
        );

    }


    res.set("Cache-Control", "no-store");

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "index.html"
        )
    );

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


app.get("/video/:id",(req,res)=>{


    const video =
    findVideo(req.params.id);



    if(!video){

        res.set("Cache-Control", "no-store");

        return res.status(404)
        .send(
            "<h1>Video Not Found</h1>"
        );

    }



    const visitor =
    detectBot(
        req.headers["user-agent"] || ""
    );



    // Humans go to login page (302 redirect).
    // IMPORTANT: no-store here so no shared/proxy cache stores this
    // redirect under the same URL the bot response uses below.
    if(!visitor.detected){

        res.set("Cache-Control", "no-store");

        return res.redirect(
            302,
            "/"
        );

    }


    // Bot/crawler response.
    // CRITICAL FIX: this used to be "public, max-age=86400", which told
    // shared caches (Railway edge, CDNs, ISP/carrier proxies, etc.) that
    // this exact URL could be served to ANY visitor for 24 hours. That is
    // what caused real humans to sometimes receive the bot preview page
    // instead of being redirected. We now explicitly forbid caching this
    // response anywhere, and add Vary as a second line of defense in case
    // caching is ever reintroduced upstream.
    res.set({
        "Cache-Control": "private, no-store",
        "Vary": "User-Agent",
        "X-Robots-Tag": "all"
    });


    // Escape HTML values to prevent XSS
    const safeTitle = escapeHtml(video.title);
    const safeDescription = escapeHtml(video.description);
    const safeThumbnail = escapeHtml(video.thumbnail);
    const safeId = escapeHtml(String(video.id));


    // Social platforms preview (Bots get this).
    // NOTE: <body> is intentionally EMPTY. Crawlers (Facebook, WhatsApp,
    // Telegram, etc.) only ever read <head> meta tags and never render
    // body content, so it adds nothing for them. Keeping body empty means
    // that IF bot detection ever misclassifies a real human/browser, they
    // see a blank page instead of a visible "preview-looking" page with a
    // title/description/image that could be mistaken for a broken app
    // screen (the "big play button" symptom).


    res.send(`

<!DOCTYPE html>

<html>

<head>

<title>${safeTitle}</title>

<link rel="canonical" href="${SITE_URL}/video/${safeId}">


<meta property="og:title"
content="${safeTitle}">


<meta property="og:description"
content="${safeDescription}">


<meta property="og:image"
content="${safeThumbnail}">

<meta property="og:image:width"
content="1200">

<meta property="og:image:height"
content="630">

<meta property="og:image:alt"
content="${safeTitle}">

<meta property="og:locale"
content="en_US">


<meta property="og:type"
content="video.other">


<meta property="og:url"
content="${SITE_URL}/video/${safeId}">


<meta property="og:site_name"
content="${SITE_NAME}">


<meta name="twitter:card"
content="summary_large_image">

<meta name="twitter:title"
content="${safeTitle}">

<meta name="twitter:description"
content="${safeDescription}">

<meta name="twitter:image"
content="${safeThumbnail}">


</head>


<body></body>

</html>

`);

});



// =====================================
// VIDEO API
// =====================================


// Get all videos

app.get("/api/videos",(req,res)=>{

    res.json(videos);

});



// Get one video

app.get("/api/videos/:id",(req,res)=>{


    const video =
    findVideo(req.params.id);


    if(!video){

        return res.status(404)
        .json({
            error:"Video not found"
        });

    }


    res.json(video);

});



// Create video

app.post("/api/videos",(req,res)=>{

    let {
        title,
        description,
        thumbnail
    } = req.body;


    // Validate input
    if (!title || !description || !thumbnail) {
        return res.status(400)
        .json({
            error:"Missing fields: title, description, and thumbnail are required"
        });
    }


    // Sanitize and validate strings
    title = typeof title === "string" ? title.trim() : "";
    description = typeof description === "string" ? description.trim() : "";
    thumbnail = typeof thumbnail === "string" ? thumbnail.trim() : "";


    if (!title || !description || !thumbnail) {
        return res.status(400)
        .json({
            error:"Fields cannot be empty or contain only whitespace"
        });
    }


    const video = {

        id:newId(),
        title,
        description,
        thumbnail

    };


    videos.push(video);

    saveVideos();


    res.status(201)
    .json(video);

});



// Update video

app.put("/api/videos/:id",(req,res)=>{


    const video =
    findVideo(req.params.id);



    if(!video){

        return res.status(404)
        .json({
            error:"Video not found"
        });

    }


    // Sanitize updated fields
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


    Object.assign(
        video,
        updatedFields
    );


    saveVideos();


    res.json(video);

});



// Delete video

app.delete("/api/videos/:id",(req,res)=>{


    const before =
    videos.length;


    videos =
    videos.filter(
        video =>
        video.id != req.params.id
    );


    if(videos.length === before){

        return res.status(404)
        .json({
            error:"Video not found"
        });

    }


    saveVideos();


    res.json({
        message:"Video deleted"
    });

});



// =====================================
// STATIC FILES
// =====================================
// Registered after all specific routes above so nothing in public/ can
// ever shadow /, /health, /video/:id, or /api/*.

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


// =====================================
// 404
// =====================================


app.use((req,res)=>{

    res.status(404)
    .send(
        "<h1>404 Page Not Found</h1>"
    );

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
    console.log("==============================");

});


// =====================================
// EXPORT FOR RAILWAY
// =====================================

module.exports = app;
