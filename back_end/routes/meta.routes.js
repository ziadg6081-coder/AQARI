const express = require("express");
const meta = require("../controllers/meta.controller");

const router = express.Router();

router.get("/governorates", meta.getGovernorates);
router.get("/property-types", meta.getPropertyTypes);

module.exports = router;
