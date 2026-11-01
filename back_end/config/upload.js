const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const UPLOADS_DIR = path.join(__dirname, "..", "uploads");

if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR);
}

const MAX_IMAGES_PER_UPLOAD = 5;
const MAX_IMAGES_PER_PROPERTY = 8;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

// The extension comes from the mimetype, never from the original file name
const ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp"
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },

    filename: (req, file, cb) => {
        cb(
            null,
            Date.now() + "-" +
            crypto.randomBytes(6).toString("hex") +
            ALLOWED_IMAGE_TYPES[file.mimetype]
        );
    }
});

const upload = multer({
    storage: storage,

    limits: {
        fileSize: MAX_IMAGE_SIZE,
        files: MAX_IMAGES_PER_UPLOAD
    },

    fileFilter: (req, file, cb) => {
        if (!ALLOWED_IMAGE_TYPES[file.mimetype]) {
            return cb(new Error("Only JPG, PNG and WEBP images are allowed"));
        }

        cb(null, true);
    }
});

module.exports = {
    UPLOADS_DIR,
    upload,
    MAX_IMAGES_PER_UPLOAD,
    MAX_IMAGES_PER_PROPERTY
};
