const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();


// =====================================
// CONFIG
// =====================================

const PORT = 3000;
const SITE_NAME = "Lojo";
const SITE_URL = `http://localhost:${PORT}`;

const VIDEO_FILE = path.join(__dirname, "videos.json");


// =====================================
// MIDDLEWARE
// =====================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


// =====================================
// VIDEO DATABASE
// =====================================

const defaultVideos = [
    {
        id: 1,
        title: "Welcome to Lojo",
        description: "Watch this amazing video now! 🎬",
        thumbnail: "https://picsum.photos/1200/630"
    },
    {
        id: 2,
        title: "Amazing Nature Video",
        description: "Beautiful scenery 🌄",
        thumbnail: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200"
    },
    {
        id: 3,
        title: "Funny Cat Compilation",
        description: "Funny moments 😂",
        thumbnail: "https://images.unsplash.com/photo-1574158622682-e40e69881006?w=1200"
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
        "twitterbot"
    ],

    LinkedIn:[
        "linkedinbot"
    ],

    Telegram:[
        "telegrambot"
    ],

    Slack:[
        "slackbot"
    ],

    Pinterest:[
        "pinterest"
    ]

};



function detectBot(agent){

    agent = agent.toLowerCase();


    for(const platform in bots){

        if(
            bots[platform]
            .some(name => agent.includes(name))
        ){

            return {
                detected:true,
                platform
            };

        }

    }


    return {
        detected:false,
        platform:null
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

        return res.redirect(
            `/video/${req.query.video}`
        );

    }


    res.sendFile(
        path.join(
            __dirname,
            "public",
            "index.html"
        )
    );

});



// =====================================
// VIDEO SOCIAL PREVIEW
// =====================================


app.get("/video/:id",(req,res)=>{


    const video =
    findVideo(req.params.id);



    if(!video){

        return res.status(404)
        .send(
            "<h1>Video Not Found</h1>"
        );

    }



    const visitor =
    detectBot(
        req.headers["user-agent"] || ""
    );



    // Humans go to login

    if(!visitor.detected){

        return res.redirect("/");

    }



    // Social platforms preview


    res.send(`

<!DOCTYPE html>

<html>

<head>

<title>${video.title}</title>


<meta property="og:title"
content="${video.title}">


<meta property="og:description"
content="${video.description}">


<meta property="og:image"
content="${video.thumbnail}">


<meta property="og:type"
content="video.other">


<meta property="og:url"
content="${SITE_URL}/video/${video.id}">


<meta property="og:site_name"
content="${SITE_NAME}">


<meta name="twitter:card"
content="summary_large_image">


</head>


<body>

<h1>${video.title}</h1>

<p>${video.description}</p>

<img src="${video.thumbnail}"
style="width:100%;max-width:600px">


</body>

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


    const {
        title,
        description,
        thumbnail
    } = req.body;



    if(!title || !description || !thumbnail){

        return res.status(400)
        .json({
            error:"Missing fields"
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



    Object.assign(
        video,
        req.body
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


app.listen(PORT,()=>{

    console.log("==============================");
    console.log(`🚀 ${SITE_NAME} running`);
    console.log(`🌐 ${SITE_URL}`);
    console.log(`📹 Videos: ${videos.length}`);
    console.log("🤖 Social preview enabled");
    console.log("💾 Storage: videos.json");
    console.log("==============================");

});
