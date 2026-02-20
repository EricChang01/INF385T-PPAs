// server.js

const http = require("http");
const fs = require("fs");
const url = require("url");

const slots = [];

function serveFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500);
      res.end("Server error");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

const server = http.createServer(function (req, res) {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const query = parsedUrl.query;

  if (req.url === "/") {
    serveFile(res, "./public/provider.html", "text/html");
    return;
  }

  if (req.url === "/styles.css") {
    serveFile(res, "./public/styles.css", "text/css");
    return;
  }

  if (req.url === "/provider.js") {
    serveFile(res, "./public/provider.js", "application/javascript");
    return;
  }

  // GET: Return all slots
  if (req.method === "GET" && path === "/api/slots") {
    sendJson(res, 200, slots);
    return;
  }

  // POST: Create a new slot
  if (req.method === "POST" && path === "/api/slots") {
    const { startTime, endTime } = query;

    if (!startTime || !endTime) {
      sendJson(res, 400, { error: "startTime and endTime are required" });
      return;
    }

    if (startTime >= endTime) {
      sendJson(res, 400, { error: "End time must be after start time" });
      return;
    }

    const slot = { id: slots.length + 1, startTime, endTime, status: "available" };
    slots.push(slot);
    sendJson(res, 201, slot);
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(3000, function () {
  console.log("Server running on http://localhost:3000");
});