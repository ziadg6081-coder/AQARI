const express = require("express");
const cors = require("cors");

const { UPLOADS_DIR } = require("./config/upload");

const authRoutes = require("./routes/auth.routes");
const metaRoutes = require("./routes/meta.routes");
const propertyRoutes = require("./routes/property.routes");
const purchaseRequestRoutes = require("./routes/purchaseRequest.routes");
const userRoutes = require("./routes/user.routes");
const messageRoutes = require("./routes/message.routes");
const notificationRoutes = require("./routes/notification.routes");

const app = express();

app.use(cors());
app.use(express.json());

// Express 5: req.body is undefined when a request has no body
app.use((req, res, next) => {
    if (req.body === undefined) req.body = {};
    next();
});

app.use("/uploads", express.static(UPLOADS_DIR));

app.get("/", (req, res) => {
    res.send("ZIZO ESTATES API is running!");
});

app.use("/api", authRoutes);
app.use("/api", metaRoutes);
app.use("/api/properties", propertyRoutes);
app.use("/api/purchase-requests", purchaseRequestRoutes);
app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/notifications", notificationRoutes);

module.exports = app;
