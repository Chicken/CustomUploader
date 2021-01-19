const express = require("express");
const multer  = require("multer");
const helmet = require("helmet");
const upload = multer({ dest: "images/" });
const { customAlphabet } = require("nanoid");
const genId = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz", 8);
const fs = require("fs");
const app = new express();
require("dotenv").config();

if(!fs.existsSync("images")) fs.mkdirSync("images");

app.listen(process.env.PORT, () => {
    console.log("Webserver online!");
});

app.use(helmet());

app.get("/", (_req, res) => {
    res.status(200).send("Antti.Codes ShareX Custom Uploader");
})

app.use(express.static("images"));

const authenticate = (req, res, next) => {
    if(req.query.token != process.env.TOKEN) return res.sendStatus(401);
    else next();
}

app.post("/upload", authenticate, upload.single("image"), (req, res) => {
    let id = genId();
    let ext = req.file.originalname.split(".")[1];
    fs.rename(req.file.path, `images/${id}.${ext}`, () => {
        res.status(200).send({
            url: `https://i.antti.codes/${id}.${ext}`
        })
    });
})
