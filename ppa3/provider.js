// provider.js
// Interactive UI logic for PPA 3
// Uses XMLHttpRequest (no Promises, no async/await)

function setMessage(text, kind) {
    const p = document.getElementById("message");
    p.textContent = text;
    
    if (kind === "error") {
        p.className = "error";
    } else {
        p.className = "ok";
    }
}

function addSlotRow(slot) {
    const tbody = document.getElementById("slotTableBody");
    const tr = document.createElement("tr");
    
    const td1 = document.createElement("td");
    const td2 = document.createElement("td");
    const td3 = document.createElement("td");

    td1.textContent = slot.startTime;
    td2.textContent = slot.endTime;
    td3.textContent = slot.status;

    tr.appendChild(td1);
    tr.appendChild(td2);
    tr.appendChild(td3);
    tbody.appendChild(tr);
}

function parseJsonSafely(text) {
    try {
        return { ok: true, value: JSON.parse(text) };
    } catch (err) {
        return { ok: false, value: null };
    }
}

// POST /api/slots?startTime=...&endTime=...
function submitNewSlot(startTime, endTime) {
    const xhr = new XMLHttpRequest();
    const requestUrl = "/api/slots?startTime=" + encodeURIComponent(startTime) +
                       "&endTime=" + encodeURIComponent(endTime);

    const submitBtn = document.getElementById("createBtn");
    submitBtn.disabled = true;
    submitBtn.textContent = "Processing...";

    xhr.open("POST", requestUrl);

    xhr.onload = function () {
        submitBtn.disabled = false;
        submitBtn.textContent = "Create slot";
        // TODO: parse JSON response safely
        const data = parseJsonSafely(xhr.responseText);
        if (!data.ok) {
            setMessage("Cannot parse json from server", "error");
            return;
        }
        // TODO: if status 201, addSlotRow(slot) and show a success message
        if (xhr.status === 201) {
            addSlotRow(data.value);
            setMessage("Slot added", "ok")
        }
        
        // TODO: if status 400 or 409, show the server error message
        else if (xhr.status === 400 || xhr.status === 409) {
            setMessage("Server error: " + data.value.error, "error");
        }
        
        // TODO: otherwise, show a generic error message
        else {
            setMessage("Server error", "error");
        }

        document.getElementById("startTime").value = "";
        document.getElementById("endTime").value = "";
        document.getElementById("startTime").focus();
    };

    xhr.send();
}

document.getElementById("slotForm").addEventListener("submit", function (event) {
    event.preventDefault();

    const startTime = document.getElementById("startTime").value;
    const endTime = document.getElementById("endTime").value;

    submitNewSlot(startTime, endTime);
});