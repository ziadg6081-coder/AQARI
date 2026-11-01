const { GOVERNORATES, PROPERTY_TYPES } = require("../config/constants");

// GET /api/governorates (public)
function getGovernorates(req, res) {
    res.json(GOVERNORATES);
}

// GET /api/property-types (public)
function getPropertyTypes(req, res) {
    res.json(PROPERTY_TYPES);
}

module.exports = { getGovernorates, getPropertyTypes };
