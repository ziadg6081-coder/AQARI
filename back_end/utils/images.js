const fs = require("fs");
const db = require("../config/db");

function deleteUploadedFiles(files) {
    (files || []).forEach((file) => {
        fs.unlink(file.path, () => {});
    });
}

function buildImageUrl(req, filename) {
    return `${req.protocol}://${req.get("host")}/uploads/${filename}`;
}

// Adds images: [{ id, url }] to each property
function attachImages(req, properties, callback) {
    if (properties.length === 0) {
        return callback(null, properties);
    }

    const ids = properties.map(p => p.id);

    db.query(
        "SELECT id, property_id, filename FROM property_images WHERE property_id IN (?) ORDER BY id",
        [ids],
        (err, images) => {
            if (err) {
                return callback(err);
            }

            const byProperty = {};

            images.forEach((image) => {
                if (!byProperty[image.property_id]) {
                    byProperty[image.property_id] = [];
                }

                byProperty[image.property_id].push({
                    id: image.id,
                    url: buildImageUrl(req, image.filename)
                });
            });

            properties.forEach((property) => {
                property.images = byProperty[property.id] || [];

                // MySQL returns AVG as a string, so convert it to a number
                if (
                    property.owner_rating !== undefined &&
                    property.owner_rating !== null
                ) {
                    property.owner_rating = Number(property.owner_rating);
                }
            });

            callback(null, properties);
        }
    );
}

module.exports = { deleteUploadedFiles, buildImageUrl, attachImages };
