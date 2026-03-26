"use strict";

const http = require("http");
const url = require("url");
const fs = require("fs");

const DATA_FILE = "appointments.json";
const VALID_STATUSES = ["busy", "free", "out-of-office", "tentative"];
const VALID_RECURRENCE = ["none", "daily", "weekly", "monthly"];

class Appointment {
  constructor(title, startDateTime, endDateTime, status = "busy", description = "", extras = {}) {
    const safeExtras = extras && typeof extras === "object" ? extras : {};
    this._id = null;

    this.title = title;
    this.startDateTime = startDateTime;
    this.endDateTime = endDateTime;
    this.status = status;
    this.description = description;
    this.attendees = safeExtras.attendees;
    this.recurrence = safeExtras.recurrence;
    this.recurrenceCount = safeExtras.recurrenceCount;

    if (safeExtras.id !== undefined) {
      this.id = safeExtras.id;
    }

    if (this._recurrence === "none") {
      this._recurrenceCount = 1;
    }
  }

  static parseDateTimeLocal(value) {
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        throw new Error("Invalid date value");
      }
      return new Date(value.getTime());
    }

    if (typeof value !== "string") {
      throw new Error("Date/time must be a datetime-local string");
    }

    const trimmed = value.trim();
    const [datePart, timePart] = trimmed.split("T");
    if (!datePart || !timePart) {
      throw new Error("Date/time must use format YYYY-MM-DDTHH:MM");
    }

    const [year, month, day] = datePart.split("-").map(Number);
    const [hour, minute] = timePart.split(":").map(Number);
    if ([year, month, day, hour, minute].some(Number.isNaN)) {
      throw new Error("Date/time contains invalid numeric values");
    }

    const parsed = new Date(year, month - 1, day, hour, minute, 0, 0);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error("Date/time could not be parsed");
    }

    return parsed;
  }

  static formatDateTimeLocal(dateObj) {
    const pad = n => String(n).padStart(2, "0");
    return (
      String(dateObj.getFullYear())
      + "-" + pad(dateObj.getMonth() + 1)
      + "-" + pad(dateObj.getDate())
      + "T" + pad(dateObj.getHours())
      + ":" + pad(dateObj.getMinutes())
    );
  }

  static statusBlocksConflict(status) {
    return status !== "free";
  }

  static createFromJSON(data) {
    if (!data || typeof data !== "object") {
      throw new Error("Appointment payload must be an object");
    }

    const start = data.startDateTime !== undefined ? data.startDateTime : data.startTime;
    const end = data.endDateTime !== undefined ? data.endDateTime : data.endTime;

    return new Appointment(
      data.title,
      start,
      end,
      data.status !== undefined ? data.status : "busy",
      data.description !== undefined ? data.description : "",
      {
        id: data.id,
        attendees: data.attendees,
        recurrence: data.recurrence,
        recurrenceCount: data.recurrenceCount,
      }
    );
  }

  conflictsWith(other) {
    const otherAppointment = other instanceof Appointment
      ? other
      : Appointment.createFromJSON(other);

    if (!Appointment.statusBlocksConflict(this.status)) {
      return false;
    }
    if (!Appointment.statusBlocksConflict(otherAppointment.status)) {
      return false;
    }

    return this.startDateTime < otherAppointment.endDateTime
      && this.endDateTime > otherAppointment.startDateTime;
  }

  update(data) {
    if (!data || typeof data !== "object") {
      throw new Error("Update payload must be an object");
    }

    const previous = this.toJSON();

    try {
      if (Object.prototype.hasOwnProperty.call(data, "title")) {
        this.title = data.title;
      }
      if (Object.prototype.hasOwnProperty.call(data, "description")) {
        this.description = data.description;
      }
      if (Object.prototype.hasOwnProperty.call(data, "status")) {
        this.status = data.status;
      }
      if (Object.prototype.hasOwnProperty.call(data, "attendees")) {
        this.attendees = data.attendees;
      }
      if (Object.prototype.hasOwnProperty.call(data, "startTime")) {
        this.startDateTime = data.startTime;
      }
      if (Object.prototype.hasOwnProperty.call(data, "startDateTime")) {
        this.startDateTime = data.startDateTime;
      }
      if (Object.prototype.hasOwnProperty.call(data, "endTime")) {
        this.endDateTime = data.endTime;
      }
      if (Object.prototype.hasOwnProperty.call(data, "endDateTime")) {
        this.endDateTime = data.endDateTime;
      }
      if (Object.prototype.hasOwnProperty.call(data, "recurrence")) {
        this.recurrence = data.recurrence;
      }
      if (Object.prototype.hasOwnProperty.call(data, "recurrenceCount")) {
        this.recurrenceCount = data.recurrenceCount;
      }

      if (this.endDateTime <= this.startDateTime) {
        throw new Error("endTime must be after startTime");
      }

      if (this.recurrence === "none") {
        this._recurrenceCount = 1;
      }
    } catch (error) {
      this._restore(previous);
      throw error;
    }
  }

  _restore(serialized) {
    this._id = serialized.id || null;
    this._title = serialized.title;
    this._description = serialized.description;
    this._status = serialized.status;
    this._attendees = serialized.attendees.slice();
    this._startDateTime = Appointment.parseDateTimeLocal(serialized.startTime);
    this._endDateTime = Appointment.parseDateTimeLocal(serialized.endTime);
    this._recurrence = serialized.recurrence;
    this._recurrenceCount = serialized.recurrenceCount;
  }

  toDisplayString() {
    const base = this.title + " " + this.startTime + " - " + this.endTime;
    if (this.description) {
      return base + " (" + this.description + ")";
    }
    return base;
  }

  toJSON() {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      startTime: this.startTime,
      endTime: this.endTime,
      status: this.status,
      attendees: this.attendees.slice(),
      recurrence: this.recurrence,
      recurrenceCount: this.recurrenceCount,
    };
  }

  get id() {
    return this._id;
  }

  set id(value) {
    if (value === undefined || value === null || value === "") {
      this._id = null;
      return;
    }
    if (typeof value !== "string") {
      throw new Error("id must be a string");
    }
    const trimmed = value.trim();
    if (!trimmed) {
      throw new Error("id must not be empty");
    }
    this._id = trimmed;
  }

  get title() {
    return this._title;
  }

  set title(value) {
    if (typeof value !== "string") {
      throw new Error("Missing or invalid title");
    }
    const trimmed = value.trim();
    if (!trimmed) {
      throw new Error("Missing or invalid title");
    }
    if (trimmed.length > 120) {
      throw new Error("Title is too long");
    }
    this._title = trimmed;
  }

  get description() {
    return this._description;
  }

  set description(value) {
    if (value === undefined || value === null) {
      this._description = "";
      return;
    }
    if (typeof value !== "string") {
      throw new Error("Description must be a string");
    }
    this._description = value.trim();
  }

  get status() {
    return this._status;
  }

  set status(value) {
    if (value === undefined || value === null || value === "") {
      this._status = "busy";
      return;
    }
    if (typeof value !== "string" || !VALID_STATUSES.includes(value)) {
      throw new Error("Invalid status");
    }
    this._status = value;
  }

  get attendees() {
    return this._attendees;
  }

  set attendees(value) {
    if (value === undefined || value === null) {
      this._attendees = [];
      return;
    }
    if (!Array.isArray(value)) {
      throw new Error("Attendees must be an array");
    }
    const normalized = value
      .map(entry => String(entry).trim())
      .filter(entry => entry.length > 0);
    this._attendees = normalized;
  }

  get startDateTime() {
    return new Date(this._startDateTime.getTime());
  }

  set startDateTime(value) {
    const parsed = Appointment.parseDateTimeLocal(value);
    if (this._endDateTime && parsed >= this._endDateTime) {
      throw new Error("startTime must be before endTime");
    }
    this._startDateTime = parsed;
  }

  get endDateTime() {
    return new Date(this._endDateTime.getTime());
  }

  set endDateTime(value) {
    const parsed = Appointment.parseDateTimeLocal(value);
    if (this._startDateTime && parsed <= this._startDateTime) {
      throw new Error("endTime must be after startTime");
    }
    this._endDateTime = parsed;
  }

  get startTime() {
    return Appointment.formatDateTimeLocal(this._startDateTime);
  }

  get endTime() {
    return Appointment.formatDateTimeLocal(this._endDateTime);
  }

  get recurrence() {
    return this._recurrence;
  }

  set recurrence(value) {
    if (value === undefined || value === null || value === "") {
      this._recurrence = "none";
      return;
    }
    if (typeof value !== "string" || !VALID_RECURRENCE.includes(value)) {
      throw new Error("Invalid recurrence");
    }
    this._recurrence = value;
    if (value === "none") {
      this._recurrenceCount = 1;
    }
  }

  get recurrenceCount() {
    return this._recurrenceCount;
  }

  set recurrenceCount(value) {
    if (value === undefined || value === null || value === "") {
      this._recurrenceCount = 1;
      return;
    }
    if (!Number.isInteger(value) || value < 1) {
      throw new Error("Invalid recurrenceCount");
    }
    this._recurrenceCount = value;
  }

  get duration() {
    return Math.round((this._endDateTime.getTime() - this._startDateTime.getTime()) / 60000);
  }
}

let appointments = [];

function loadAppointments() {
  try {
    const text = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      appointments = [];
      return;
    }

    const hydrated = [];
    for (let i = 0; i < parsed.length; i += 1) {
      try {
        hydrated.push(Appointment.createFromJSON(parsed[i]));
      } catch (error) {
        console.log("Skipping invalid appointment at index " + String(i) + ": " + error.message);
      }
    }
    appointments = hydrated;
  } catch (error) {
    console.log("Could not load appointments.json, starting with empty array.");
    appointments = [];
  }
}

function saveAppointments() {
  try {
    const text = JSON.stringify(appointments.map(appt => appt.toJSON()), null, 2);
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

function validateAppointment(apptLike) {
  try {
    Appointment.createFromJSON(apptLike);
    return null;
  } catch (error) {
    return error.message;
  }
}

function buildRecurringAppointments(baseAppointment) {
  const recurrence = baseAppointment.recurrence || "none";
  const recurrenceCount = baseAppointment.recurrenceCount || 1;

  if (recurrence === "none" || recurrenceCount === 1) {
    return [Appointment.createFromJSON(baseAppointment.toJSON())];
  }

  const recurringAppointments = [];
  for (let i = 0; i < recurrenceCount; i += 1) {
    const startCopy = baseAppointment.startDateTime;
    const endCopy = baseAppointment.endDateTime;

    if (recurrence === "daily") {
      startCopy.setDate(startCopy.getDate() + i);
      endCopy.setDate(endCopy.getDate() + i);
    } else if (recurrence === "weekly") {
      startCopy.setDate(startCopy.getDate() + (i * 7));
      endCopy.setDate(endCopy.getDate() + (i * 7));
    } else if (recurrence === "monthly") {
      startCopy.setMonth(startCopy.getMonth() + i);
      endCopy.setMonth(endCopy.getMonth() + i);
    }

    recurringAppointments.push(new Appointment(
      baseAppointment.title,
      startCopy,
      endCopy,
      baseAppointment.status,
      baseAppointment.description,
      {
        attendees: baseAppointment.attendees,
        recurrence,
        recurrenceCount,
      }
    ));
  }

  return recurringAppointments;
}

const checkOverlap = (appt, excludeId = null) => {
  return appointments.some(existing => {
    if (existing.id === excludeId) {
      return false;
    }
    return appt.conflictsWith(existing);
  });
};

function updateAppointmentFull(id, updatedAppointmentRaw) {
  const index = appointments.findIndex(a => a.id === id);
  if (index === -1) {
    return { error: "Appointment not found", status: 404 };
  }

  let updatedAppointment;
  try {
    updatedAppointment = Appointment.createFromJSON(updatedAppointmentRaw);
  } catch (error) {
    return { error: error.message, status: 400 };
  }

  const appointmentsToApply = buildRecurringAppointments(updatedAppointment);
  for (let i = 0; i < appointmentsToApply.length; i += 1) {
    if (checkOverlap(appointmentsToApply[i], id)) {
      return { error: "Appointment overlaps with an existing busy appointment", status: 409 };
    }
  }

  const primaryAppointment = appointmentsToApply[0];
  primaryAppointment.id = id;
  appointments[index] = primaryAppointment;

  for (let i = 1; i < appointmentsToApply.length; i += 1) {
    const extraAppointment = appointmentsToApply[i];
    extraAppointment.id = String(Date.now()) + "-u" + String(i);
    appointments.push(extraAppointment);
  }

  saveAppointments();
  return { data: primaryAppointment, status: 200 };
}

function updateAppointmentPartial(id, changes) {
  const index = appointments.findIndex(a => a.id === id);
  if (index === -1) {
    return { error: "Appointment not found", status: 404 };
  }

  const merged = Appointment.createFromJSON(appointments[index].toJSON());
  try {
    merged.update(changes);
  } catch (error) {
    return { error: error.message, status: 400 };
  }
  merged.id = id;

  if (checkOverlap(merged, id)) {
    return { error: "Appointment overlaps with an existing busy appointment", status: 409 };
  }

  appointments[index] = merged;
  saveAppointments();
  return { data: merged, status: 200 };
}

function deleteAppointment(id) {
  const index = appointments.findIndex(a => a.id === id);
  if (index === -1) {
    return { error: "Appointment not found", status: 404 };
  }

  appointments.splice(index, 1);
  saveAppointments();
  return { status: 200 };
}

loadAppointments();

const server = http.createServer(function (request, response) {
  console.log("request url: ", request.url);
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
    sendJson(response, 200, appointments.map(appt => appt.toJSON()));
  }

  else if (request.method === "POST" && parsedUrl.pathname === "/appointments") {
    let body = "";
    request.on("data", function (chunk) {
      body += chunk;
    });
    request.on("end", function () {
      let newAppointmentRaw;
      try {
        newAppointmentRaw = JSON.parse(body);
      } catch (e) {
        sendText(response, 400, "Invalid JSON");
        return;
      }

      const validationError = validateAppointment(newAppointmentRaw);
      if (validationError) {
        sendText(response, 400, validationError);
        return;
      }

      const newAppointment = Appointment.createFromJSON(newAppointmentRaw);
      const appointmentsToCreate = buildRecurringAppointments(newAppointment);

      for (let i = 0; i < appointmentsToCreate.length; i += 1) {
        if (checkOverlap(appointmentsToCreate[i])) {
          sendText(response, 409, "One or more recurring appointments overlap with an existing appointment");
          return;
        }
      }

      const createdAppointments = [];
      for (let i = 0; i < appointmentsToCreate.length; i += 1) {
        const appointment = appointmentsToCreate[i];
        appointment.id = String(Date.now()) + "-" + String(i);
        appointments.push(appointment);
        createdAppointments.push(appointment.toJSON());
      }

      saveAppointments();
      sendJson(response, 201, createdAppointments);
    });
  }

  else if (request.method === "PUT" && parsedUrl.pathname.startsWith("/appointments/")) {
    const id = parsedUrl.pathname.split("/")[2];
    let body = "";
    request.on("data", chunk => { body += chunk; });
    request.on("end", () => {
      let updatedAppointment;
      try {
        updatedAppointment = JSON.parse(body);
      } catch (e) {
        sendText(response, 400, "Invalid JSON");
        return;
      }
      const result = updateAppointmentFull(id, updatedAppointment);
      if (result.error) {
        sendText(response, result.status, result.error);
      } else {
        sendJson(response, result.status, result.data.toJSON());
      }
    });
  }

  else if (request.method === "PATCH" && parsedUrl.pathname.startsWith("/appointments/")) {
    const id = parsedUrl.pathname.split("/")[2];
    let body = "";
    request.on("data", chunk => { body += chunk; });
    request.on("end", () => {
      let changes;
      try {
        changes = JSON.parse(body);
      } catch (e) {
        sendText(response, 400, "Invalid JSON");
        return;
      }
      const result = updateAppointmentPartial(id, changes);
      if (result.error) {
        sendText(response, result.status, result.error);
      } else {
        sendJson(response, result.status, result.data.toJSON());
      }
    });
  }

  else if (request.method === "DELETE" && parsedUrl.pathname.startsWith("/appointments/")) {
    const id = parsedUrl.pathname.split("/")[2];
    const result = deleteAppointment(id);
    if (result.error) {
      sendText(response, result.status, result.error);
    } else {
      sendText(response, 200, "Appointment deleted");
    }
  }

  else {
    sendText(response, 404, "Not found");
  }
});

server.listen(3000);
console.log("Server running at http://localhost:3000");
