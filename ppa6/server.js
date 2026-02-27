"use strict";

const http = require("http");
const url = require("url");
const fs = require("fs");

const DATA_FILE = "appointments.json";
let appointments = [];

// If the file does not exist or the JSON is invalid, start with an empty array.
// Errors are logged to the console so the developer knows something went wrong.
function loadAppointments() {
  // TODO list: decide what should happen if the file does not exist.
  // TODO list: decide what should happen if the JSON is invalid.
  // TODO list: decide whether to log errors to the console or stay silent.
  try {
    const text = fs.readFileSync(DATA_FILE, "utf8");
    appointments = JSON.parse(text);
    if (!Array.isArray(appointments)) {
      appointments = [];
    }
  } catch (error) {
    console.log("Could not load appointments.json, starting with empty array.");
    appointments = [];
  }
}

// Pretty-print JSON (2-space indent) so the file is human-readable.
// If writing fails, log the error but do not crash the server.
function saveAppointments() {
  // TODO list: decide how you want the JSON formatted (pretty vs compact).
  // TODO list: decide what to do if writing fails.
  try {
    const text = JSON.stringify(appointments, null, 2);
    fs.writeFileSync(DATA_FILE, text, "utf8");
  } catch (error) {
    console.log("Failed to save appointments.json: " + error.message);
  }
}

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

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, { "Content-Type": "application/json" });
  response.end(JSON.stringify(data));
}

function sendText(response, statusCode, message) {
  response.writeHead(statusCode, { "Content-Type": "text/plain" });
  response.end(message);
}

loadAppointments();

const server = http.createServer(function (request, response) {
  const parsedUrl = url.parse(request.url, true);

  if (request.url === "/") {
    serveFile(response, "./public/appointment.html", "text/html");
    return;
  }

  if (request.url === "/styles.css") {
    serveFile(response, "./public/styles.css", "text/css");
    return;
  }

  if (request.url === "/provider.js") {
    serveFile(response, "./public/provider.js", "application/javascript");
    return;
  }

  if (request.method === "GET" && parsedUrl.pathname === "/appointments") {
    // TODO list: decide whether you want to return raw appointments or a wrapper object.
    sendJson(response, 200, appointments);
  }

  else if (request.method === "POST" && parsedUrl.pathname === "/appointments") {
    let body = "";
    request.on("data", function (chunk) {
      body += chunk;
    });
    request.on("end", function () {
      // TODO list: validate the incoming appointment fields before pushing into the array.
      let newAppointment;
      try {
        newAppointment = JSON.parse(body);
      } catch (e) {
        sendText(response, 400, "Invalid JSON");
        return;
      }

      // Validate that startTime and endTime are present strings.
      if (typeof newAppointment.startTime !== "string" || newAppointment.startTime === "") {
        sendText(response, 400, "Missing or invalid startTime");
        return;
      }
      if (typeof newAppointment.endTime !== "string" || newAppointment.endTime === "") {
        sendText(response, 400, "Missing or invalid endTime");
        return;
      }
      if (newAppointment.endTime <= newAppointment.startTime) {
        sendText(response, 400, "endTime must be after startTime");
        return;
      }

      appointments.push(newAppointment);
      saveAppointments();
      sendText(response, 201, "Appointment added");
    });
  }

  else if (request.method === "DELETE" &&
    parsedUrl.pathname.startsWith("/appointments/")) {
    const parts = parsedUrl.pathname.split("/");
    const index = Number(parts[2]);
    // TODO list: decide what error message to send for an invalid index.
    if (!Number.isNaN(index) && index >= 0 && index < appointments.length) {
      appointments.splice(index, 1);
      saveAppointments();
      sendText(response, 200, "Appointment deleted");
    } else {
      sendText(response, 400, "Invalid index");
    }
  }

  else {
    sendText(response, 404, "Not found");
  }
});

server.listen(3000);
console.log("Server running at http://localhost:3000");
