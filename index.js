require("dotenv").config();
const { PORT, DOMAIN, TOKEN, CHARS, IDLENGTH, DELETELENGTH } = process.env;
const express = require("express");
const multer = require("multer");
const helmet = require("helmet");
const Enmap = require("enmap");
const db = new Enmap("files");
const upload = multer({ dest: "tmp/" });
const { customAlphabet } = require("nanoid");
const genId = customAlphabet(CHARS, parseInt(IDLENGTH));
const genDeleteToken = customAlphabet(CHARS, parseInt(DELETELENGTH));
const fs = require("fs");
const app = new express();

if(!fs.existsSync("files")) fs.mkdirSync("files");
if(!fs.existsSync("images")) fs.mkdirSync("images");

app.listen(PORT, () => {
    console.log(`Webserver running on port ${PORT}, ` +
                `accesible at https://${DOMAIN}/`);
});

app.use(helmet());

app.get("/", (_req, res) => {
    res.status(200).sendFile(__dirname + "/index.html");
});

app.use("/i/", express.static("images"));

app.get("/f/:id", (req, res) => {
    let id = req.params.id.split(".")[0];
    if(!db.has(id)) return res.sendStatus(404);
    let { file, name } = db.get(id);
    res.download(file, name);
});

const authenticate = (req, res, next) => {
    if(req.query.token != TOKEN) return res.sendStatus(401);
    else next();
};

app.post("/upload", authenticate, upload.single("file"), (req, res) => {
    try {
        if(!(["file", "image"].includes(req.query.type)))
            return res.sendStatus(400);
        let isImage = req.query.type == "image";
        let ext = "." + req.file.originalname.split(".").reverse()[0];
        let id = genId();
        let deleteToken = genDeleteToken();
        let file = id + (ext != "." && isImage ? ext : "");
        let path = `${isImage ? "images" : "files"}/${file}`;
        fs.rename(req.file.path, path, () => {
            db.set(id, {
                file: path,
                name: req.file.originalname,
                token: deleteToken
            });
            res.status(200).send({
                status: 200,
                url: `https://${DOMAIN}/${isImage ? "i" : "f"}/${file}`,
                delete: `https://${DOMAIN}/d/${id}/${deleteToken}`
            });
        });
    } catch(e) {
        console.error(e);
        res.status(500).send({
            status: 500,
            message: "Internal server error occured trying to upload file"
        });
    }
});

app.get("/d/:id/:token", (req, res) => {
    try {
        if(!db.has(req.params.id)) return res.sendStatus(404);
        let { token, file } = db.get(req.params.id);
        if(token != req.params.token) return res.sendStatus(401);
        fs.unlink("./" + file, () => {
            res.sendStatus(200);
            db.delete(req.params.id);
        });
    } catch (e) {
        console.error(e);
        res.status(500).send({
            status: 500,
            message: "Internal server error occured trying to delete the file"
        });
    }
});
