// js/main.js - Async Modal Handler
// ==========================================
// ASYNC MODAL HANDLER
// ==========================================
document.getElementById("confirmActionBtn").onclick = async function () {
  const btn = this;
  const originalText = btn.innerHTML;

  // If there is an action waiting to happen
  if (typeof pendingAction === 'function') {
    try {
      // 1. Lock Button
      btn.innerHTML = "Processing...";
      btn.disabled = true;

      // 2. Await the Logic (The database updates happen here)
      await pendingAction();

    } catch (error) {
      console.error("Action Failed:", error);
      alert("An error occurred during processing. Check console.");
    } finally {
      // 3. Unlock and Close
      btn.innerHTML = originalText;
      btn.disabled = false;
      closeModal("confirmationModal");
      pendingAction = null;
    }
  } else {
    // Just close if nothing to do
    closeModal("confirmationModal");
  }
};


document.getElementById("attendanceDate").valueAsDate = new Date();

(async () => {
  const dbInit = await initDB();
  if (!dbInit) {
    console.error("Failed to initialize database");
    showToast("Database connection failed. Please refresh page.", "error");
    return;
  }
  await loadStudents();
  await loadFaculty();
  await loadClasses();
  await loadYears();
  await populateAdminClassFilter("all", "all");
  await updateDashboard();

  // Initialize date filter
  document.querySelectorAll('input[name="dateFilterType"]').forEach((radio) => {
    radio.addEventListener("change", toggleDateRange);
  });
  toggleDateRange(); // Initial call

  // Add event listeners for filters to update class dropdown
  document
    .getElementById("adminSemesterFilter")
    .addEventListener("change", async function () {
      const semesterFilter = this.value;
      const branchFilter = document.getElementById("adminBranchFilter").value;
      await updateClassFilterDropdown(semesterFilter, branchFilter);
    });

  document
    .getElementById("adminBranchFilter")
    .addEventListener("change", async function () {
      const branchFilter = this.value;
      const semesterFilter = document.getElementById(
        "adminSemesterFilter"
      ).value;
      await updateClassFilterDropdown(semesterFilter, branchFilter);
    });

  // ==========================================
  // DYNAMIC SEMESTER FILTER (Attendance History)
  // ==========================================
  const historyYearFilter = document.getElementById("adminYearFilter");

  if (historyYearFilter) {
    historyYearFilter.addEventListener("change", async function () {
      // Made async
      const year = this.value;
      const semSelect = document.getElementById("adminSemesterFilter");
      const branchFilter = document.getElementById("adminBranchFilter").value; // Get current branch

      // 1. Clear current options
      semSelect.innerHTML = '<option value="all">All Semesters</option>';

      // 2. Determine which semesters to show
      let startSem, endSem;

      if (year === "all") {
        startSem = 1;
        endSem = 8;
      } else {
        const y = parseInt(year);
        // Year 1 -> 1, 2 | Year 2 -> 3, 4 | etc.
        startSem = (y - 1) * 2 + 1;
        endSem = startSem + 1;
      }

      // 3. Generate Options
      for (let i = startSem; i <= endSem; i++) {
        const opt = document.createElement("option");
        opt.value = i;
        opt.textContent = `Semester ${i}`;
        semSelect.appendChild(opt);
      }

      // 4. CRITICAL FIX: Trigger the data update
      // Since we just changed the available semesters, we usually default to "all"
      // or the first available semester.
      // Let's refresh the class dropdown based on the new state.

      // Check if updateClassFilterDropdown is globally available
      if (typeof updateClassFilterDropdown === "function") {
        // We pass "all" because we just reset the semSelect to have 'all' as the first option
        await updateClassFilterDropdown("all", branchFilter);
      }
    });
  }
})();
