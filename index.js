// Get configs from .env
require("dotenv").config();
const { PORT, DOMAIN, TOKEN, CHARS, IDLENGTH, DELETELENGTH, TMPDEST } = process.env;
// Require dependencies
const express = require("express");
const multer = require("multer");
const helmet = require("helmet");
const Enmap = require("enmap");
const fs = require("fs");
// Define the database for files
const db = new Enmap("files");
// Define multer upload middleware for express
const upload = multer({ dest: TMPDEST });
// Require the custom function from nanoid
const { customAlphabet } = require("nanoid");
// Make custom function for generating ids and tokens
const genId = customAlphabet(CHARS, parseInt(IDLENGTH));
const genDeleteToken = customAlphabet(CHARS, parseInt(DELETELENGTH));
// Define the webserver
const app = new express();

/**
 * Generate a formatted time for logging
 * @returns {string} date formatted as [hh:mm:ss]
 */
const timeGen = () => {
    let date = new Date();
    return `[${date.getHours().toString().padStart(2, "0")}`
         + `:${date.getMinutes().toString().padStart(2, "0")}`
         + `:${date.getSeconds().toString().padStart(2, "0")}] `;
};

/**
 * Logging function
 * @param {string} msg message to log
 * @param {boolean} error used internal by error function
 */
const log = (msg, error = false) => {
    // Prepend the message with timestamp
    msg = timeGen() + msg;
    // Error if error, log if normal
    if(error) console.error(msg);
    else console.log(msg);
    // Append message to .log file
    fs.appendFile("uploader.log", msg + "\n", err => {
        // And handle error if writing failed
        if(err) console.error(timeGen() + "Error writing to log file");
    });
};

/**
 * Error logging function
 * @param {string} msg message to log
 */
const error = msg => log(msg, true);

// Create data directories if they don't exists
if(!fs.existsSync("files")) fs.mkdirSync("files");
if(!fs.existsSync("images")) fs.mkdirSync("images");
if(!fs.existsSync("uploader.log")) fs.closeSync(fs.openSync("uploader.log", "a"));

// Make the app listen on the defined port
app.listen(PORT, () => {
    log(`Webserver running on port ${PORT}, ` +
        `accesible at https://${DOMAIN}/`);
});

// Use some basic security features
app.use(helmet());

// Resolve root to index.html
app.get("/", (_req, res) => {
    res.status(200).sendFile(__dirname + "/index.html");
});

// Serve images staticly on /i/ for embedding on services like Discord
app.use("/i/", express.static("images"));

// Download any file with the original name (even images) from /f/
app.get("/f/:id", (req, res) => {
    // Split by . because then the id can be abcdef.png or just abcdef
    let id = req.params.id.split(".")[0];
    // If the upload is nonexistant, return with 404 (Not Found)
    if(!db.has(id)) return res.sendStatus(404);
    // Get the upload details from database
    let { file, name } = db.get(id);
    // Send the file to the user using the original name
    res.download(file, name);
});

/**
 * Express middleware function to authenticate upload requests
 * @param {function} req express request
 * @param {function} res express reponse
 * @param {function} next express next
 */
const authenticate = (req, res, next) => {
    // Check if token is not the one defined
    if(req.query.token !== TOKEN) {
        // Log the unauthorized attempt
        log("Unauthorized upload attempt!");
        // Respond with 401 (Unauthorized)
        return res.sendStatus(401);
    // Otherwise continue
    } else next();
};

// The upload endpoint
// Use  the authenticate middleware and multer's upload single middleware for the upload
app.post("/upload", authenticate, upload.single("file"), (req, res) => {
    // Wrap everything in try block in case of errors
    try {
        // If type is not in the known list
        if(!(["file", "image"].includes(req.query.type)))
            // Respond with 400 (Bad Request)
            return res.sendStatus(400);
        // Simple boolean for type (might need to change in future in case of more types, like albums/collections)
        let isImage = req.query.type == "image";
        // Find the extension of the file
        let ext = "." + req.file.originalname.split(".").reverse()[0];
        // Generate a unique id for the upload 
        let id = genId();
        // And even more unique token that's hard to guess
        let deleteToken = genDeleteToken();
        // Append the extension to the file if this is an image it isn't it just empty.
        let file = id + (ext != "." && isImage ? ext : "");
        // Change the upload folder depending on type too
        let path = `${isImage ? "images" : "files"}/${file}`;
        // Rename (move) file to our data folders
        fs.rename(req.file.path, path, () => {
            // Set the id on the database to reference the upload's details
            db.set(id, {
                file: path,
                name: req.file.originalname,
                token: deleteToken
            });
            // Send a 200 (OK) response with json containing the upload public url and url for deletion with the delete token
            res.status(200).send({
                status: 200,
                url: `https://${DOMAIN}/${isImage ? "i" : "f"}/${file}`,
                delete: `https://${DOMAIN}/d/${id}/${deleteToken}`
            });
            // Log the event
            log(`Uploaded new file "${req.file.originalname}" with id of "${id}"`);
        });
    } catch(e) {
        // Log the error
        error(e);
        // Respond with 500 (Internal Server Error)
        res.status(500).send({
            status: 500,
            message: "Internal server error occured trying to upload file"
        });
    }
});

// Delete endpoint
app.get("/d/:id/:token", (req, res) => {
    // Wrap everything in try block incase of errors
    try {
        // Check if the id is valid
        // And respond with 404 (Not Found) if it isn't
        if(!db.has(req.params.id)) return res.sendStatus(404);
        // Get the upload details from database
        let { token, file, name } = db.get(req.params.id);
        // Check if the token in url matches the one in database
        // And respond with 401 (Unauthorized) if it doesn't
        if(token != req.params.token) return res.sendStatus(401);
        // Unlink (remove) the file
        fs.unlink("./" + file, () => {
            // Respond with 200 (OK)
            res.sendStatus(200);
            // Delete the upload details from the database
            db.delete(req.params.id);
            // Log this event as well
            log(`Deleted file "${name}" with id of "${req.params.id}"`);
        });
    } catch (e) {
        // Log the error
        error(e);
        // Respond with 500 (Internal Server Error)
        res.status(500).send({
            status: 500,
            message: "Internal server error occured trying to delete the file"
        });
    }
});
