"use strict";

const VALID_STATUSES = ["busy", "free", "out-of-office", "tentative"];
const VALID_RECURRENCE = ["none", "daily", "weekly", "monthly"];

class Appointment {
  constructor(title, startDateTime, endDateTime, status = "busy", description = "", extras = {}) {
    const safeExtras = extras && typeof extras === "object" ? extras : {};

    this.id = safeExtras.id || null;
    this.title = title;
    this.startTime = startDateTime;
    this.endTime = endDateTime;
    this.status = status;
    this.description = description;
    this.attendees = safeExtras.attendees;
    this.recurrence = safeExtras.recurrence;
    this.recurrenceCount = safeExtras.recurrenceCount;

    if (this.recurrence === "none") {
      this.recurrenceCount = 1;
    }
  }

  static parseDateTimeLocal(value) {
    if (typeof value !== "string" || value.trim() === "") {
      throw new Error("Date/time must use format YYYY-MM-DDTHH:MM");
    }

    const normalized = value.trim();
    const [datePart, timePart] = normalized.split("T");
    if (!datePart || !timePart) {
      throw new Error("Date/time must use format YYYY-MM-DDTHH:MM");
    }

    const [year, month, day] = datePart.split("-").map(Number);
    const [hour, minute] = timePart.split(":").map(Number);
    if ([year, month, day, hour, minute].some(Number.isNaN)) {
      throw new Error("Date/time contains invalid numeric values");
    }

    const date = new Date(year, month - 1, day, hour, minute, 0, 0);
    if (Number.isNaN(date.getTime())) {
      throw new Error("Date/time could not be parsed");
    }

    return date;
  }

  static createFromJSON(data) {
    if (!data || typeof data !== "object") {
      throw new Error("Appointment payload must be an object");
    }

    return new Appointment(
      data.title,
      data.startDateTime !== undefined ? data.startDateTime : data.startTime,
      data.endDateTime !== undefined ? data.endDateTime : data.endTime,
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

    return this.startDateTime < otherAppointment.endDateTime
      && this.endDateTime > otherAppointment.startDateTime;
  }

  update(data) {
    if (!data || typeof data !== "object") {
      throw new Error("Update payload must be an object");
    }

    const previous = this.toRequestPayload();

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
        this.startTime = data.startTime;
      }
      if (Object.prototype.hasOwnProperty.call(data, "endTime")) {
        this.endTime = data.endTime;
      }
      if (Object.prototype.hasOwnProperty.call(data, "recurrence")) {
        this.recurrence = data.recurrence;
      }
      if (Object.prototype.hasOwnProperty.call(data, "recurrenceCount")) {
        this.recurrenceCount = data.recurrenceCount;
      }

      if (this.endDateTime <= this.startDateTime) {
        throw new Error("End time must be after start time");
      }

      if (this.recurrence === "none") {
        this.recurrenceCount = 1;
      }
    } catch (error) {
      this._restore(previous);
      throw error;
    }
  }

  _restore(data) {
    this.id = data.id;
    this._title = data.title;
    this._description = data.description;
    this._status = data.status;
    this._attendees = data.attendees.slice();
    this._startTime = data.startTime;
    this._endTime = data.endTime;
    this._recurrence = data.recurrence;
    this._recurrenceCount = data.recurrenceCount;
  }

  toDisplayString() {
    let label = this.title + " " + this.startTime.split("T")[1];
    if (this.recurrence !== "none") {
      label += " (" + this.recurrence + ")";
    }
    return label;
  }

  toRequestPayload() {
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

  get duration() {
    const ms = this.endDateTime.getTime() - this.startDateTime.getTime();
    return Math.round(ms / 60000);
  }

  get title() {
    return this._title;
  }

  set title(value) {
    if (typeof value !== "string" || value.trim() === "") {
      throw new Error("Title is required");
    }
    const trimmed = value.trim();
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
      throw new Error("Description must be text");
    }
    this._description = value.trim();
  }

  get status() {
    return this._status;
  }

  set status(value) {
    const next = value === undefined || value === null || value === "" ? "busy" : value;
    if (typeof next !== "string" || !VALID_STATUSES.includes(next)) {
      throw new Error("Invalid status");
    }
    this._status = next;
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
      throw new Error("Attendees must be a list");
    }
    this._attendees = value.map(a => String(a).trim()).filter(a => a);
  }

  get startTime() {
    return this._startTime;
  }

  set startTime(value) {
    const parsed = Appointment.parseDateTimeLocal(value);
    const normalized = value.trim();

    if (this._endTime) {
      const end = Appointment.parseDateTimeLocal(this._endTime);
      if (parsed >= end) {
        throw new Error("Start time must be before end time");
      }
    }

    this._startTime = normalized;
  }

  get endTime() {
    return this._endTime;
  }

  set endTime(value) {
    const parsed = Appointment.parseDateTimeLocal(value);
    const normalized = value.trim();

    if (this._startTime) {
      const start = Appointment.parseDateTimeLocal(this._startTime);
      if (parsed <= start) {
        throw new Error("End time must be after start time");
      }
    }

    this._endTime = normalized;
  }

  get startDateTime() {
    return Appointment.parseDateTimeLocal(this._startTime);
  }

  get endDateTime() {
    return Appointment.parseDateTimeLocal(this._endTime);
  }

  get recurrence() {
    return this._recurrence;
  }

  set recurrence(value) {
    const next = value === undefined || value === null || value === "" ? "none" : value;
    if (typeof next !== "string" || !VALID_RECURRENCE.includes(next)) {
      throw new Error("Invalid recurrence");
    }
    this._recurrence = next;
  }

  get recurrenceCount() {
    return this._recurrenceCount;
  }

  set recurrenceCount(value) {
    const next = value === undefined || value === null || value === "" ? 1 : value;
    if (!Number.isInteger(next) || next < 1) {
      throw new Error("Occurrences must be at least 1");
    }
    this._recurrenceCount = next;
  }
}

let currentMonth = 3;
let currentYear = 2026;
let currentAppointmentId = null;
let currentAppointment = null;
let allAppointments = [];

refreshCalendar();

function showMessage(text, kind) {
  const el = document.getElementById("message");
  el.textContent = text;
  el.className = kind;
}

function refreshCalendar() {
  const xhr = new XMLHttpRequest();
  xhr.open("GET", "/appointments");
  xhr.onload = function () {
    if (xhr.status === 200) {
      try {
        const raw = JSON.parse(xhr.responseText);
        allAppointments = raw.map(item => Appointment.createFromJSON(item));
      } catch (error) {
        allAppointments = [];
        showMessage("Failed to parse appointments: " + error.message, "error");
        return;
      }
      renderCalendar(allAppointments);
      filterAppointments();
    } else {
      showMessage("GET failed: " + String(xhr.status), "error");
    }
  };
  xhr.send();
}

function filterAppointments() {
  const query = document.getElementById("searchInput").value.toLowerCase();
  const statusFilter = document.getElementById("filterStatus").value;

  const filtered = allAppointments.filter(appt => {
    const matchesText = !query
      || appt.title.toLowerCase().includes(query)
      || appt.description.toLowerCase().includes(query);
    const matchesStatus = !statusFilter || appt.status === statusFilter;
    return matchesText && matchesStatus;
  });

  renderAppointments(filtered);
}

function renderCalendar(appointments) {
  setMonthTitle(currentMonth, currentYear);

  const grid = document.getElementById("calendarGrid");
  grid.innerHTML = "";

  const firstDay = new Date(currentYear, currentMonth - 1, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();

  const today = new Date();
  const todayDay = today.getDate();
  const todayMonth = today.getMonth() + 1;
  const todayYear = today.getFullYear();

  for (let i = 0; i < 42; i += 1) {
    const dayNumber = i - startWeekday + 1;
    const cell = document.createElement("div");
    cell.className = "dayCell";

    if (dayNumber >= 1 && dayNumber <= daysInMonth) {
      if (dayNumber === todayDay && currentMonth === todayMonth && currentYear === todayYear) {
        cell.classList.add("today");
      }

      const label = document.createElement("div");
      label.className = "dayNumber";
      label.textContent = String(dayNumber);
      cell.appendChild(label);

      for (let j = 0; j < appointments.length; j += 1) {
        const appt = appointments[j];
        const [datePart] = appt.startTime.split("T");
        const [y, m, d] = datePart.split("-").map(Number);

        if (d === dayNumber && m === currentMonth && y === currentYear) {
          const item = document.createElement("div");
          item.className = "slotAvail status-" + appt.status;
          item.textContent = appt.toDisplayString();
          item.addEventListener("click", function () {
            openAppointmentModal(appt);
          });
          cell.appendChild(item);
        }
      }
    } else {
      cell.className += " empty";
    }

    grid.appendChild(cell);
  }
}

function renderAppointments(appointmentsArray) {
  const calendar = document.getElementById("calendar");
  calendar.innerHTML = "";

  for (let i = 0; i < appointmentsArray.length; i += 1) {
    const appt = appointmentsArray[i];

    const card = document.createElement("div");
    card.className = "appointmentCard status-" + appt.status;

    const info = document.createElement("div");
    const titleEl = document.createElement("strong");
    titleEl.textContent = appt.title;
    info.appendChild(titleEl);

    const timeLine = document.createElement("div");
    timeLine.textContent = appt.startTime.replace("T", " ") + " to " + appt.endTime.replace("T", " ");
    info.appendChild(timeLine);

    if (appt.description) {
      const descriptionLine = document.createElement("em");
      descriptionLine.textContent = appt.description;
      info.appendChild(descriptionLine);
    }

    if (appt.recurrence !== "none") {
      const recurrenceLine = document.createElement("div");
      recurrenceLine.textContent = "Repeats: " + appt.recurrence
        + " (" + String(appt.recurrenceCount) + " occurrences)";
      info.appendChild(recurrenceLine);
    }

    const durationLine = document.createElement("div");
    durationLine.textContent = "Duration: " + String(appt.duration) + " minutes";
    info.appendChild(durationLine);

    card.appendChild(info);

    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", function () {
      openAppointmentModal(appt);
    });
    card.appendChild(editBtn);

    calendar.appendChild(card);
  }
}

function openAppointmentModal(appointment) {
  currentAppointmentId = appointment.id;
  currentAppointment = appointment;

  document.getElementById("modalTitle").value = appointment.title;
  document.getElementById("modalDescription").value = appointment.description;
  document.getElementById("modalStartTime").value = appointment.startTime;
  document.getElementById("modalEndTime").value = appointment.endTime;
  document.getElementById("modalStatus").value = appointment.status;
  document.getElementById("modalAttendees").value = appointment.attendees.join(", ");
  document.getElementById("modalRecurrence").value = appointment.recurrence;
  document.getElementById("modalRecurrenceCount").value = String(appointment.recurrenceCount);

  document.getElementById("modalOverlay").style.display = "flex";
}

function saveAppointmentChanges() {
  const title = document.getElementById("modalTitle").value.trim();
  const description = document.getElementById("modalDescription").value.trim();
  const startTime = document.getElementById("modalStartTime").value;
  const endTime = document.getElementById("modalEndTime").value;
  const status = document.getElementById("modalStatus").value;
  const attendeesRaw = document.getElementById("modalAttendees").value;
  const recurrence = document.getElementById("modalRecurrence").value;
  const recurrenceCountRaw = Number(document.getElementById("modalRecurrenceCount").value);
  const recurrenceCount = recurrence === "none" ? 1 : recurrenceCountRaw;
  const attendees = attendeesRaw
    ? attendeesRaw.split(",").map(a => a.trim()).filter(a => a)
    : [];

  let candidate;
  try {
    candidate = Appointment.createFromJSON(currentAppointment.toRequestPayload());
    candidate.update({
      title,
      description,
      startTime,
      endTime,
      status,
      attendees,
      recurrence,
      recurrenceCount,
    });
  } catch (error) {
    showMessage(error.message, "error");
    return;
  }

  const xhr = new XMLHttpRequest();
  xhr.open("PUT", "/appointments/" + currentAppointmentId);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.onload = function () {
    if (xhr.status === 200) {
      showMessage("Appointment updated", "ok");
      closeModal();
      refreshCalendar();
    } else {
      showMessage("Update failed: " + xhr.responseText, "error");
    }
  };
  xhr.send(JSON.stringify(candidate.toRequestPayload()));
}

function patchAppointmentStatus() {
  const status = document.getElementById("modalStatus").value;

  let candidate;
  try {
    candidate = Appointment.createFromJSON(currentAppointment.toRequestPayload());
    candidate.update({ status });
  } catch (error) {
    showMessage(error.message, "error");
    return;
  }

  const xhr = new XMLHttpRequest();
  xhr.open("PATCH", "/appointments/" + currentAppointmentId);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.onload = function () {
    if (xhr.status === 200) {
      showMessage("Status updated", "ok");
      closeModal();
      refreshCalendar();
    } else {
      showMessage("Patch failed: " + xhr.responseText, "error");
    }
  };
  xhr.send(JSON.stringify({ status: candidate.status }));
}

const deleteButtonHandler = () => {
  const xhr = new XMLHttpRequest();
  xhr.open("DELETE", "/appointments/" + currentAppointmentId);
  xhr.onload = function () {
    if (xhr.status === 200) {
      showMessage("Appointment deleted", "ok");
      closeModal();
      refreshCalendar();
    } else {
      showMessage("Delete failed: " + xhr.responseText, "error");
    }
  };
  xhr.send();
};

function closeModal() {
  document.getElementById("modalOverlay").style.display = "none";
  currentAppointmentId = null;
  currentAppointment = null;
}

function setMonthTitle(month, year) {
  const names = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  document.getElementById("monthTitle").textContent = names[month - 1] + " " + String(year);
}

function sendCreateAppointment(appointment) {
  const xhr = new XMLHttpRequest();
  xhr.open("POST", "/appointments");
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.onload = function () {
    if (xhr.status === 201) {
      showMessage("Appointment added", "ok");
      refreshCalendar();
    } else {
      showMessage("Create failed: " + xhr.responseText, "error");
    }
  };
  xhr.send(JSON.stringify(appointment.toRequestPayload()));
}

document.getElementById("createAppmtButton").addEventListener("click", function () {
  const title = document.getElementById("titleInput").value.trim();
  const description = document.getElementById("descriptionInput").value.trim();
  const startTime = document.getElementById("startTimeInput").value;
  const endTime = document.getElementById("endTimeInput").value;
  const status = document.getElementById("statusInput").value;
  const attendeesRaw = document.getElementById("attendeesInput").value;
  const recurrence = document.getElementById("recurrenceInput").value;
  const recurrenceCountRaw = Number(document.getElementById("recurrenceCountInput").value);
  const recurrenceCount = recurrence === "none" ? 1 : recurrenceCountRaw;
  const attendees = attendeesRaw
    ? attendeesRaw.split(",").map(a => a.trim()).filter(a => a)
    : [];

  let appointment;
  try {
    appointment = new Appointment(
      title,
      startTime,
      endTime,
      status,
      description,
      {
        attendees,
        recurrence,
        recurrenceCount,
      }
    );
  } catch (error) {
    showMessage(error.message, "error");
    return;
  }

  sendCreateAppointment(appointment);
});

document.getElementById("prevMonthBtn").addEventListener("click", function () {
  currentMonth -= 1;
  if (currentMonth < 1) {
    currentMonth = 12;
    currentYear -= 1;
  }
  refreshCalendar();
});

document.getElementById("nextMonthBtn").addEventListener("click", function () {
  currentMonth += 1;
  if (currentMonth > 12) {
    currentMonth = 1;
    currentYear += 1;
  }
  refreshCalendar();
});

document.getElementById("searchInput").addEventListener("input", filterAppointments);
document.getElementById("filterStatus").addEventListener("change", filterAppointments);

document.getElementById("modalSaveBtn").addEventListener("click", saveAppointmentChanges);
document.getElementById("modalPatchStatusBtn").addEventListener("click", patchAppointmentStatus);
document.getElementById("modalDeleteBtn").addEventListener("click", deleteButtonHandler);
document.getElementById("modalCloseBtn").addEventListener("click", closeModal);
