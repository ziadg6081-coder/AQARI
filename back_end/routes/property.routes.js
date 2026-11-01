const express = require("express");
const { authenticateToken } = require("../middleware/auth");
const { loadOwnedProperty } = require("../middleware/loadOwnedProperty");
const { handleImageUpload } = require("../middleware/upload");
const property = require("../controllers/property.controller");
const images = require("../controllers/propertyImage.controller");

const router = express.Router();

// Public
router.get("/", property.getAllProperties);
router.get("/:id", property.getPropertyById);

// Any logged-in user
router.post("/", authenticateToken, handleImageUpload, property.createProperty);

// Owner (own property) and Admin
router.put("/:id", authenticateToken, loadOwnedProperty, property.updateProperty);
router.put("/:id/status", authenticateToken, loadOwnedProperty, property.updatePropertyStatus);
router.delete("/:id", authenticateToken, loadOwnedProperty, property.deleteProperty);

router.post("/:id/images", authenticateToken, loadOwnedProperty, handleImageUpload, images.addImages);
router.delete("/:id/images/:imageId", authenticateToken, loadOwnedProperty, images.deleteImage);

module.exports = router;
