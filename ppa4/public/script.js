function setMessage(text, kind) {
    const p = document.getElementById("message");
    p.textContent = text;
    
    if (kind === "error") {
        p.className = "error";
    } else {
        p.className = "ok";
    }
}

function addReservationRow(reservation) {
    // Determine which table to add to based on court type
    let tbody;
    if (reservation.courtType === "Basketball") {
        tbody = document.getElementById("basketballTableBody");
    } else if (reservation.courtType === "Tennis") {
        tbody = document.getElementById("tennisTableBody");
    } else {
        // Invalid court type
        return;
    }
    
    const tr = document.createElement("tr");
    
    const td1 = document.createElement("td");
    const td2 = document.createElement("td");
    const td3 = document.createElement("td");

    td1.textContent = reservation.startTime;
    td2.textContent = reservation.endTime;
    td3.textContent = reservation.studentId;

    tr.appendChild(td1);
    tr.appendChild(td2);
    tr.appendChild(td3);
    tbody.appendChild(tr);
}

function clearAllTables() {
    document.getElementById("basketballTableBody").innerHTML = "";
    document.getElementById("tennisTableBody").innerHTML = "";
}

function loadAllReservations() {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", "/api/reservations");
    
    xhr.onload = function () {
        if (xhr.status === 200) {
            const data = parseJsonSafely(xhr.responseText);
            if (data.ok) {
                clearAllTables();
                
                // Add basketball reservations
                if (data.value.basketball) {
                    for (let i = 0; i < data.value.basketball.length; i++) {
                        addReservationRow(data.value.basketball[i]);
                    }
                }
                
                // Add tennis reservations
                if (data.value.tennis) {
                    for (let i = 0; i < data.value.tennis.length; i++) {
                        addReservationRow(data.value.tennis[i]);
                    }
                }
            }
        }
    };
    
    xhr.send();
}

function parseJsonSafely(text) {
    try {
        return { ok: true, value: JSON.parse(text) };
    } catch (err) {
        return { ok: false, value: null };
    }
}

// POST /api/reservations?courtType=...&startTime=...&endTime=...&studentId=...
function submitNewReservation(courtType, startTime, endTime, studentId) {
    const xhr = new XMLHttpRequest();
    const requestUrl = "/api/reservations?courtType=" + encodeURIComponent(courtType) +
                       "&startTime=" + encodeURIComponent(startTime) +
                       "&endTime=" + encodeURIComponent(endTime) +
                       "&studentId=" + encodeURIComponent(studentId);

    const submitBtn = document.getElementById("submitBtn");
    submitBtn.disabled = true;
    submitBtn.textContent = "Processing...";

    xhr.open("POST", requestUrl);

    xhr.onload = function () {
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Reservation";
        
        const data = parseJsonSafely(xhr.responseText);
        if (!data.ok) {
            setMessage("Cannot parse JSON from server", "error");
            return;
        }
        
        // Check if reservation was created successfully
        if (xhr.status === 201) {
            addReservationRow(data.value);
            setMessage("Reservation created successfully!", "ok");
            
            // Clear form inputs
            document.getElementById("courtType").value = "";
            document.getElementById("startTime").value = "";
            document.getElementById("endTime").value = "";
            document.getElementById("studentId").value = "";
        }
        // Handle validation errors or conflicts
        else if (xhr.status === 400) {
            setMessage("Validation error: " + data.value.error, "error");
        }
        else if (xhr.status === 409) {
            setMessage("Conflict error: " + data.value.error, "error");
        }
        // Handle other errors
        else {
            setMessage("Server error occurred", "error");
        }
    };

    xhr.send();
}

// DELETE /api/reservations?courtType=...&startTime=...&endTime=...&studentId=...
function deleteReservation(courtType, startTime, endTime, studentId) {
    // Validation with nested conditionals
    if (!courtType || courtType.trim().length === 0) {
        setMessage("Error: Court type is required for deletion", "error");
        return;
    } else if (!startTime || startTime.trim().length === 0) {
        setMessage("Error: Start time is required for deletion", "error");
        return;
    } else if (!endTime || endTime.trim().length === 0) {
        setMessage("Error: End time is required for deletion", "error");
        return;
    } else if (!studentId || studentId.trim().length === 0) {
        setMessage("Error: Student ID is required for deletion", "error");
        return;
    }

    const xhr = new XMLHttpRequest();
    const requestUrl = "/api/reservations?courtType=" + encodeURIComponent(courtType) +
                       "&startTime=" + encodeURIComponent(startTime) +
                       "&endTime=" + encodeURIComponent(endTime) +
                       "&studentId=" + encodeURIComponent(studentId);

    const deleteBtn = document.getElementById("deleteBtn");
    deleteBtn.disabled = true;
    deleteBtn.textContent = "Processing...";

    xhr.open("DELETE", requestUrl);

    xhr.onload = function () {
        deleteBtn.disabled = false;
        deleteBtn.textContent = "Delete Reservation";
        
        const data = parseJsonSafely(xhr.responseText);
        if (!data.ok) {
            setMessage("Cannot parse JSON from server", "error");
            return;
        }
        
        // Check if deletion was successful
        if (xhr.status === 200) {
            // Reload all reservations to reflect the deletion
            loadAllReservations();
            setMessage("Reservation deleted successfully!", "ok");
            
            // Clear form inputs
            document.getElementById("courtType").value = "";
            document.getElementById("startTime").value = "";
            document.getElementById("endTime").value = "";
            document.getElementById("studentId").value = "";
        }
        // Handle not found error
        else if (xhr.status === 404) {
            setMessage("Error: " + data.value.error, "error");
        }
        // Handle validation errors
        else if (xhr.status === 400) {
            setMessage("Validation error: " + data.value.error, "error");
        }
        // Handle other errors
        else {
            setMessage("Server error occurred", "error");
        }
    };

    xhr.send();
}

// Form submit handler for Submit Reservation button
document.getElementById("reservationForm").addEventListener("submit", function (event) {
    event.preventDefault();

    const courtType = document.getElementById("courtType").value;
    const startTime = document.getElementById("startTime").value;
    const endTime = document.getElementById("endTime").value;
    const studentId = document.getElementById("studentId").value;

    submitNewReservation(courtType, startTime, endTime, studentId);
});

// Delete button handler
document.getElementById("deleteBtn").addEventListener("click", function () {
    const courtType = document.getElementById("courtType").value;
    const startTime = document.getElementById("startTime").value;
    const endTime = document.getElementById("endTime").value;
    const studentId = document.getElementById("studentId").value;

    deleteReservation(courtType, startTime, endTime, studentId);
});

// Load all reservations when page loads
window.addEventListener("load", function () {
    loadAllReservations();
});