// server.js
// Appointment scheduling server (PPA 3)
// Uses Node.js http module only (no frameworks)
// Sequential POST handling: parameters are passed in the URL query string

const http = require("http");
const url = require("url");
const fs = require("fs");

// In-memory data model (persistence added in PPA 4)
const slots = [];

function sendJson(res, statusCode, payload) {
    res.writeHead(statusCode, { "Content-Type": "application/json" });
    res.end(JSON.stringify(payload));
}

function nextId() {
    return slots.length + 1;
}

function validateSlotTimes(startTime, endTime) {
    if (typeof startTime !== "string" || startTime.trim().length === 0) {
        return { ok: false, message: "startTime is required" };
    }
    if (typeof endTime !== "string" || endTime.trim().length === 0) {
        return { ok: false, message: "endTime is required" };
    }
    // TODO (bonus): verify endTime is after startTime
    if (startTime > endTime) {
        return {ok: false, message: "endTime is before startTime"};
    }
    return { ok: true, message: "" };
}

function isDuplicate(startTime, endTime) {
    // TODO (bonus): return true if a slot with the same times already exists
    for (let i = 0; i < slots.length; i++) {
        const curr_slot = slots[i];
        
        // Check if both start and end times match
        if (curr_slot.startTime === startTime && curr_slot.endTime === endTime) {
            return true;
        }
    }
    return false;
}

const server = http.createServer(function (req, res) {
    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    const query = parsedUrl.query;

    if (req.url === "/provider") {
        const filePath = "./provider.html";
        fs.readFile(filePath, (err, content) => {
            if (err) {
              res.writeHead(500);
              res.end("Server error");
              return;
            }
            
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(content);
          });
        return;
    }

    if (req.url === "/provider.js") {
        fs.readFile("./provider.js", (err, content) => {
            if (err) {
                res.writeHead(500);
                res.end("Server error");
                return;
            }
            res.writeHead(200, { "Content-Type": "application/javascript" });
            res.end(content);
        });
        return;
    }

    // GET: Retrieve all slots
    if (req.method === "GET" && path === "/api/slots") {
        sendJson(res, 200, slots);
        return;
    }

    // POST: Create a new slot
    if (req.method === "POST" && path === "/api/slots") {
        const startTime = query.startTime;
        const endTime = query.endTime;

        const result = validateSlotTimes(startTime, endTime);
        if (!result.ok) {
            sendJson(res, 400, { error: result.message });
            return;
        }

        // TODO (bonus): prevent duplicates
        if (isDuplicate(startTime, endTime)) {
            sendJson(res, 409, { error: "Duplicate slot" });
            return;
        }

        const slot = {
            id: nextId(),
            startTime: startTime,
            endTime: endTime,
            status: "available"
        };

        slots.push(slot);
        sendJson(res, 201, slot);
        return;
    }

    // Default: 404 Not Found
    sendJson(res, 404, { error: "Not found" });
});

server.listen(3000, function () {
    console.log("Server running on http://localhost:3000");
});