const { PORT } = require("./config/env");
const app = require("./app");

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
