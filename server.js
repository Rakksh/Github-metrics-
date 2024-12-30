import express from "express";
import cors from "cors";
import { exec } from "child_process";
import path from "path";

const app = express();
const PORT = 3000;

// Enable CORS
app.use(cors());

// Serve static files from "public" folder
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile(path.resolve("public/index.html"));
});

// Endpoint to trigger the script
app.get("/trigger-script", (req, res) => {
  exec("node script.js", (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing script: ${error.message}`);
      res.status(500).send("Error executing script");
      return;
    }
    res.send("Metrics successfully updated in Google Sheets!");
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
