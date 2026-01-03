document.getElementById("confirmActionBtn").onclick = function () {
  if (pendingAction) pendingAction();
  closeModal("confirmationModal");
  pendingAction = null;
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
    historyYearFilter.addEventListener("change", function () {
      const year = this.value;
      const semSelect = document.getElementById("adminSemesterFilter");

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
    });
  }
})();
