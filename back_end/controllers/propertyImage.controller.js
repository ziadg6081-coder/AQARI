const fs = require("fs");
const path = require("path");
const db = require("../config/db");
const { UPLOADS_DIR, MAX_IMAGES_PER_PROPERTY } = require("../config/upload");
const { deleteUploadedFiles, attachImages } = require("../utils/images");

// POST /api/properties/:id/images
// Owner (own property) and Admin. Form field name: images
function addImages(req, res) {
    const files = req.files || [];

    if (files.length === 0) {
        return res.status(400).json({
            message: "Please select at least one image"
        });
    }

    db.query(
        "SELECT COUNT(*) AS total FROM property_images WHERE property_id = ?",
        [req.property.id],
        (err, rows) => {
            if (err) {
                console.error(err);
                deleteUploadedFiles(files);
                return res.status(500).json({ message: "Failed to upload images" });
            }

            if (rows[0].total + files.length > MAX_IMAGES_PER_PROPERTY) {
                deleteUploadedFiles(files);
                return res.status(400).json({
                    message: `A property can have at most ${MAX_IMAGES_PER_PROPERTY} images`
                });
            }

            const values = files.map(file => [req.property.id, file.filename]);

            db.query(
                "INSERT INTO property_images (property_id, filename) VALUES ?",
                [values],
                (err) => {
                    if (err) {
                        console.error(err);
                        deleteUploadedFiles(files);
                        return res.status(500).json({
                            message: "Failed to upload images"
                        });
                    }

                    attachImages(req, [req.property], (err, properties) => {
                        if (err) {
                            console.error(err);
                            return res.status(500).json({
                                message: "Images uploaded but failed to load them"
                            });
                        }

                        res.status(201).json({
                            message: "Images uploaded successfully",
                            images: properties[0].images
                        });
                    });
                }
            );
        }
    );
}

// DELETE /api/properties/:id/images/:imageId
// Owner (own property) and Admin
function deleteImage(req, res) {
    db.query(
        "SELECT filename FROM property_images WHERE id = ? AND property_id = ?",
        [req.params.imageId, req.property.id],
        (err, results) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ message: "Failed to delete image" });
            }

            if (results.length === 0) {
                return res.status(404).json({ message: "Image not found" });
            }

            db.query(
                "DELETE FROM property_images WHERE id = ?",
                [req.params.imageId],
                (err) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).json({
                            message: "Failed to delete image"
                        });
                    }

                    fs.unlink(path.join(UPLOADS_DIR, results[0].filename), () => {});

                    res.json({ message: "Image deleted successfully" });
                }
            );
        }
    );
}

module.exports = { addImages, deleteImage };
