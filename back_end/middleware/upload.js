const { upload, MAX_IMAGES_PER_UPLOAD } = require("../config/upload");

// Runs multer and turns its errors into normal JSON responses
function handleImageUpload(req, res, next) {
    upload.array("images", MAX_IMAGES_PER_UPLOAD)(req, res, (err) => {
        if (err) {
            let message = err.message;

            if (err.code === "LIMIT_FILE_SIZE") {
                message = "Each image must be 5MB or less";
            }

            if (
                err.code === "LIMIT_FILE_COUNT" ||
                err.code === "LIMIT_UNEXPECTED_FILE"
            ) {
                message = `You can upload up to ${MAX_IMAGES_PER_UPLOAD} images at once (field name: images)`;
            }

            return res.status(400).json({ message: message });
        }

        next();
    });
}

module.exports = { handleImageUpload };
