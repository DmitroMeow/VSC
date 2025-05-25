const express = require("express"); //Main
const app = express(); //Deploying Main
const path = require("path"); //For .public
const port = process.env.PORT || 3000; //Port

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Error handling
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
