const fs = require("fs");
const path = require("path");
const db = require("../config/db");
const {
    GOVERNORATES,
    isValidPropertyType
} = require("../config/constants");
const { UPLOADS_DIR } = require("../config/upload");
const { hasValue } = require("../utils/helpers");
const { normalizePhone } = require("../utils/phone");
const { parseDetails } = require("../utils/details");
const { deleteUploadedFiles, attachImages } = require("../utils/images");

// Property + the owner's name and average rating
// (no other user data is exposed)
const PROPERTY_WITH_OWNER_SQL =
    "SELECT properties.*, users.name AS owner_name, " +
    "(SELECT ROUND(AVG(rating), 1) FROM owner_ratings WHERE owner_id = properties.owner_id) AS owner_rating, " +
    "(SELECT COUNT(*) FROM owner_ratings WHERE owner_id = properties.owner_id) AS owner_ratings_count " +
    "FROM properties LEFT JOIN users ON properties.owner_id = users.id";


// GET /api/properties (public, with optional filters)
//   governorate, type, min_price, max_price, bedrooms, bathrooms
function getAllProperties(req, res) {
    const {
        governorate,
        type,
        min_price,
        max_price,
        bedrooms,
        bathrooms
    } = req.query;

    const conditions = [];
    const params = [];

    if (hasValue(governorate)) {
        if (!GOVERNORATES.includes(governorate)) {
            return res.status(400).json({ message: "Invalid governorate" });
        }

        conditions.push("properties.governorate = ?");
        params.push(governorate);
    }

    if (hasValue(type)) {
        if (!isValidPropertyType(type)) {
            return res.status(400).json({ message: "Invalid property type" });
        }

        conditions.push("properties.property_type = ?");
        params.push(type);
    }

    let minPrice = null;
    let maxPrice = null;

    if (hasValue(min_price)) {
        minPrice = Number(min_price);

        if (isNaN(minPrice) || minPrice < 0) {
            return res.status(400).json({
                message: "min_price must be a non-negative number"
            });
        }

        conditions.push("properties.price >= ?");
        params.push(minPrice);
    }

    if (hasValue(max_price)) {
        maxPrice = Number(max_price);

        if (isNaN(maxPrice) || maxPrice < 0) {
            return res.status(400).json({
                message: "max_price must be a non-negative number"
            });
        }

        conditions.push("properties.price <= ?");
        params.push(maxPrice);
    }

    if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
        return res.status(400).json({
            message: "Min price cannot be greater than max price"
        });
    }

    const countFilters = [
        ["bedrooms", bedrooms],
        ["bathrooms", bathrooms]
    ];

    for (const [field, raw] of countFilters) {
        if (!hasValue(raw)) {
            continue;
        }

        const number = Number(raw);

        if (!Number.isInteger(number) || number < 0) {
            return res.status(400).json({
                message: `${field} must be a non-negative whole number`
            });
        }

        // Field names come from the fixed list above, never from the user
        conditions.push(`properties.${field} >= ?`);
        params.push(number);
    }

    const sql =
        PROPERTY_WITH_OWNER_SQL +
        (conditions.length > 0 ? " WHERE " + conditions.join(" AND ") : "");

    db.query(sql, params, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: "Failed to fetch properties" });
        }

        attachImages(req, results, (err, properties) => {
            if (err) {
                console.error(err);
                return res.status(500).json({
                    message: "Failed to fetch properties"
                });
            }

            res.json(properties);
        });
    });
}


// GET /api/properties/:id (public)
function getPropertyById(req, res) {
    const { id } = req.params;

    db.query(
        PROPERTY_WITH_OWNER_SQL + " WHERE properties.id = ?",
        [id],
        (err, results) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ message: "Failed to fetch property" });
            }

            if (results.length === 0) {
                return res.status(404).json({ message: "Property not found" });
            }

            attachImages(req, [results[0]], (err, properties) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({
                        message: "Failed to fetch property"
                    });
                }

                res.json(properties[0]);
            });
        }
    );
}


// POST /api/properties
// Any logged-in user (the creator becomes the owner)
// JSON or multipart/form-data (optional images in the "images" field)
function createProperty(req, res) {
    const {
        title,
        location,
        governorate,
        property_type,
        phone,
        price
    } = req.body;

    const files = req.files || [];

    if (
        !title ||
        !location ||
        !price ||
        isNaN(Number(price)) ||
        Number(price) <= 0
    ) {
        deleteUploadedFiles(files);
        return res.status(400).json({
            message: "Title, location and a valid price are required"
        });
    }

    if (!GOVERNORATES.includes(governorate)) {
        deleteUploadedFiles(files);
        return res.status(400).json({
            message: "A valid governorate is required"
        });
    }

    if (!isValidPropertyType(property_type)) {
        deleteUploadedFiles(files);
        return res.status(400).json({
            message: "A valid property type is required"
        });
    }

    const normalizedPhone = normalizePhone(phone);

    if (!normalizedPhone) {
        deleteUploadedFiles(files);
        return res.status(400).json({
            message: "A valid Egyptian mobile number is required (e.g. 01012345678)"
        });
    }

    const parsed = parseDetails(req.body);

    if (parsed.error) {
        deleteUploadedFiles(files);
        return res.status(400).json({ message: parsed.error });
    }

    const newProperty = {
        title: title,
        location: location,
        governorate: governorate,
        property_type: property_type,
        phone: normalizedPhone,
        price: price,
        owner_id: req.user.id,
        ...parsed.details
    };

    db.query(
        "INSERT INTO properties SET ?",
        [newProperty],
        (err, result) => {
            if (err) {
                console.error(err);
                deleteUploadedFiles(files);
                return res.status(500).json({ message: "Failed to add property" });
            }

            const property = {
                id: result.insertId,
                ...newProperty,
                status: "available"
            };

            const sendResponse = () => {
                attachImages(req, [property], (err) => {
                    if (err) {
                        console.error(err);
                        property.images = [];
                    }

                    res.status(201).json({
                        message: "Property added successfully",
                        property: property
                    });
                });
            };

            if (files.length === 0) {
                return sendResponse();
            }

            const values = files.map(file => [property.id, file.filename]);

            db.query(
                "INSERT INTO property_images (property_id, filename) VALUES ?",
                [values],
                (err) => {
                    if (err) {
                        console.error(err);

                        // Undo the property so we do not keep a half-saved one
                        db.query("DELETE FROM properties WHERE id = ?", [property.id]);

                        deleteUploadedFiles(files);

                        return res.status(500).json({
                            message: "Failed to save property images"
                        });
                    }

                    sendResponse();
                }
            );
        }
    );
}


// PUT /api/properties/:id
// Owner (own property) and Admin (any property)
// Optional fields are updated only if they are sent
function updateProperty(req, res) {
    const {
        title,
        location,
        governorate,
        property_type,
        phone,
        price
    } = req.body;

    if (
        !title ||
        !location ||
        !price ||
        isNaN(Number(price)) ||
        Number(price) <= 0
    ) {
        return res.status(400).json({
            message: "Title, location and a valid price are required"
        });
    }

    if (governorate !== undefined && !GOVERNORATES.includes(governorate)) {
        return res.status(400).json({ message: "Invalid governorate" });
    }

    if (property_type !== undefined && !isValidPropertyType(property_type)) {
        return res.status(400).json({ message: "Invalid property type" });
    }

    let normalizedPhone;

    if (phone !== undefined) {
        normalizedPhone = normalizePhone(phone);

        if (!normalizedPhone) {
            return res.status(400).json({
                message: "A valid Egyptian mobile number is required (e.g. 01012345678)"
            });
        }
    }

    const parsed = parseDetails(req.body);

    if (parsed.error) {
        return res.status(400).json({ message: parsed.error });
    }

    const fields = ["title = ?", "location = ?", "price = ?"];
    const values = [title, location, price];

    if (governorate !== undefined) {
        fields.push("governorate = ?");
        values.push(governorate);
    }

    if (property_type !== undefined) {
        fields.push("property_type = ?");
        values.push(property_type);
    }

    if (phone !== undefined) {
        fields.push("phone = ?");
        values.push(normalizedPhone);
    }

    // Field names come from the fixed DETAIL_FIELDS list, never from the user
    Object.keys(parsed.details).forEach((field) => {
        fields.push(`${field} = ?`);
        values.push(parsed.details[field]);
    });

    values.push(req.property.id);

    db.query(
        `UPDATE properties SET ${fields.join(", ")} WHERE id = ?`,
        values,
        (err) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ message: "Failed to update property" });
            }

            res.json({ message: "Property updated successfully" });
        }
    );
}


// PUT /api/properties/:id/status (available / sold)
function updatePropertyStatus(req, res) {
    const { status } = req.body;

    if (status !== "available" && status !== "sold") {
        return res.status(400).json({
            message: "Status must be available or sold"
        });
    }

    db.query(
        "UPDATE properties SET status = ? WHERE id = ?",
        [status, req.property.id],
        (err) => {
            if (err) {
                console.error(err);
                return res.status(500).json({
                    message: "Failed to update property status"
                });
            }

            res.json({
                message: "Property status updated successfully",
                status: status
            });
        }
    );
}


// DELETE /api/properties/:id (also removes its image files)
function deleteProperty(req, res) {
    // Read the file names first (the rows are removed by ON DELETE CASCADE)
    db.query(
        "SELECT filename FROM property_images WHERE property_id = ?",
        [req.property.id],
        (err, images) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ message: "Failed to delete property" });
            }

            db.query(
                "DELETE FROM properties WHERE id = ?",
                [req.property.id],
                (err) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).json({
                            message: "Failed to delete property"
                        });
                    }

                    images.forEach((image) => {
                        fs.unlink(path.join(UPLOADS_DIR, image.filename), () => {});
                    });

                    res.json({ message: "Property deleted successfully" });
                }
            );
        }
    );
}

module.exports = {
    getAllProperties,
    getPropertyById,
    createProperty,
    updateProperty,
    updatePropertyStatus,
    deleteProperty
};
