const express = require("express");
const multer = require("multer");
const helmet = require("helmet");
const Enmap = require("enmap");
const db = new Enmap("deletes");
const upload = multer({ dest: "images/" });
const { customAlphabet } = require("nanoid");
const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const genId = customAlphabet(chars, 8);
const genDeleteId = customAlphabet(chars, 32);
const fs = require("fs");
const app = new express();
require("dotenv").config();

if(!fs.existsSync("images")) fs.mkdirSync("images");

app.listen(process.env.PORT, () => {
    console.log("Webserver online!");
});

app.use(helmet());

app.get("/", (_req, res) => {
    res.status(200).sendFile(__dirname + "/index.html");
})

app.use(express.static("images"));

const authenticate = (req, res, next) => {
    if(req.query.token != process.env.TOKEN) return res.sendStatus(401);
    else next();
}

app.post("/upload", authenticate, upload.single("image"), (req, res) => {
    try {
        let name = genId() + "." + req.file.originalname.split(".")[1];
        let deleteId = genDeleteId();
        fs.rename(req.file.path, `images/${name}`, () => {
            db.set(deleteId, name);
            res.status(200).send({
                status: 200,
                url: `https://i.antti.codes/${name}`,
                delete: `https://i.antti.codes/delete/${deleteId}`
            })
        });
    } catch(e) {
        console.error(e);
        res.status(500).send({
            status: 500,
            message: "Internal server error occured trying to upload file"
        });
    }
})

app.get("/delete/:id", (req, res) => {
    try {
        fs.unlink(`./images/${db.get(req.params.id)}`, () => {
            res.status(200).send({
                status: 200,
                message: "File delete succesfully."
            });
        });
        db.delete(req.params.id);
    } catch (e) {
        console.error(e);
        res.status(500).send({
            status: 500,
            message: "Internal server error occured trying to delete the file"
        });
    }
})
