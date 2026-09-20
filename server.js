const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname)));

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    app: "Byenext"
  });
});

app.listen(PORT, () => {
  console.log(`Byenext running on port ${PORT}`);
});
