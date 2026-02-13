// server.js
// Multi-Court Reservation System
// Supports Basketball and Tennis court bookings

const http = require("http");
const url = require("url");
const fs = require("fs");

// In-memory data model - separate arrays for each court type
const basketballReservations = [];
const tennisReservations = [];

function sendJson(res, statusCode, payload) {
    res.writeHead(statusCode, { "Content-Type": "application/json" });
    res.end(JSON.stringify(payload));
}

function nextId(reservations) {
    return reservations.length + 1;
}

function validateReservation(courtType, startTime, endTime, studentId) {
    // Check if court type is provided
    if (!courtType || courtType.trim().length === 0) {
        return { ok: false, message: "Court type is required" };
    }

    // Check if court type is selected
    if (courtType !== "Basketball" && courtType !== "Tennis") {
        return { ok: false, message: "Please select the court type" };
    }

    // Check if start time is provided
    if (typeof startTime !== "string" || startTime.trim().length === 0) {
        return { ok: false, message: "Start time is required" };
    }

    // Check if end time is provided
    if (typeof endTime !== "string" || endTime.trim().length === 0) {
        return { ok: false, message: "End time is required" };
    }

    // Check if end time is after start time
    if (startTime >= endTime) {
        return { ok: false, message: "End time must be after start time" };
    }

    // Check if student ID is provided
    if (typeof studentId !== "string" || studentId.trim().length === 0) {
        return { ok: false, message: "Student ID is required" };
    }

    return { ok: true, message: "" };
}

function hasConflict(courtType, startTime, endTime, reservations) {
    // Check if the requested time overlaps with any existing reservation
    for (let i = 0; i < reservations.length; i++) {
        const reservation = reservations[i];
        
        // Check for time overlap
        if (!(startTime >= reservation.endTime || endTime <= reservation.startTime)) {
            return true;
        }
    }
    return false;
}

function findExactMatch(courtType, startTime, endTime, studentId, reservations) {
    // Find reservation with exact matching fields
    for (let i = 0; i < reservations.length; i++) {
        const reservation = reservations[i];
        
        if (reservation.startTime === startTime &&
            reservation.endTime === endTime &&
            reservation.studentId === studentId) {
            return i; // Return index of matching reservation
        }
    }
    return -1; // No match found
}

function getReservationArray(courtType) {
    if (courtType === "Basketball") {
        return basketballReservations;
    } else if (courtType === "Tennis") {
        return tennisReservations;
    } else {
        return null;
    }
}

const server = http.createServer(function (req, res) {
    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    const query = parsedUrl.query;

    // Serve index.html
    if (req.url === "/") {
        const filePath = "./public/index.html";
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

    // Serve styles.css
    if (req.url === "/styles.css") {
        fs.readFile("./public/styles.css", (err, content) => {
            if (err) {
                res.writeHead(500);
                res.end("Server error");
                return;
            }
            res.writeHead(200, { "Content-Type": "text/css" });
            res.end(content);
        });
        return;
    }

    // Serve script.js
    if (req.url === "/script.js") {
        fs.readFile("./public/script.js", (err, content) => {
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

    // GET: Retrieve all reservations for both courts
    if (req.method === "GET" && path === "/api/reservations") {
        const response = {
            basketball: basketballReservations,
            tennis: tennisReservations
        };
        sendJson(res, 200, response);
        return;
    }

    // POST: Create a new reservation
    if (req.method === "POST" && path === "/api/reservations") {
        const courtType = query.courtType;
        const startTime = query.startTime;
        const endTime = query.endTime;
        const studentId = query.studentId;

        // Validate input
        const validationResult = validateReservation(courtType, startTime, endTime, studentId);
        if (!validationResult.ok) {
            sendJson(res, 400, { error: validationResult.message });
            return;
        }

        // Get the appropriate reservation array
        const reservations = getReservationArray(courtType);
        
        // Check for time conflicts
        if (hasConflict(courtType, startTime, endTime, reservations)) {
            sendJson(res, 409, { error: "Time conflict: Court is already booked for this time slot" });
            return;
        }

        // Create new reservation
        const reservation = {
            id: nextId(reservations),
            courtType: courtType,
            startTime: startTime,
            endTime: endTime,
            studentId: studentId
        };

        reservations.push(reservation);
        sendJson(res, 201, reservation);
        return;
    }

    // DELETE: Remove a reservation when there is an exact match
    if (req.method === "DELETE" && path === "/api/reservations") {
        const courtType = query.courtType;
        const startTime = query.startTime;
        const endTime = query.endTime;
        const studentId = query.studentId;

        // Validate court type
        if (!courtType || (courtType !== "Basketball" && courtType !== "Tennis")) {
            sendJson(res, 400, { error: "Court type is required to delete" });
            return;
        }

        // Get the appropriate reservation array
        const reservations = getReservationArray(courtType);

        // Find exact match
        const index = findExactMatch(courtType, startTime, endTime, studentId, reservations);

        if (index === -1) {
            sendJson(res, 404, { error: "No matching reservation found" });
            return;
        }

        // Remove the reservation
        const deleted = reservations.splice(index, 1)[0];
        sendJson(res, 200, { message: "Reservation deleted successfully", deleted: deleted });
        return;
    }

    // Default: 404 Not Found
    sendJson(res, 404, { error: "Not found" });
});

server.listen(3000, function () {
    console.log("Multi-Court Reservation System running on http://localhost:3000");
});