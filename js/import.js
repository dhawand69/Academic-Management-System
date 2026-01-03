// import.js - Data Import Functions with Sanitization
// UPDATED: Supports Internal Marks & Safe Wipe

// 1. COLUMN SANITIZATION
function sanitizeRecord(store, record) {
  const validColumns = {
    students: ['id', 'rollno', 'firstname', 'lastname', 'email', 'department', 'year', 'semester', 'createdat', 'updatedat'],
    faculty: ['id', 'facultyid', 'firstname', 'lastname', 'email', 'department', 'specialization', 'password', 'createdat', 'updatedat'],
    classes: ['id', 'code', 'name', 'department', 'semester', 'faculty', 'year', 'credits', 'max_midsem', 'max_assignment', 'max_attendance', 'createdat', 'updatedat', 'is_active'],
    attendance: ['id', 'classid', 'studentid', 'date', 'session', 'status', 'notes', 'createdat', 'updatedat'],
    internal_marks: ['id', 'classid', 'studentid', 'midsem', 'assignment', 'attendance', 'total', 'createdat', 'updatedat'],
    academic_years: ['id', 'year', 'startdate', 'enddate', 'type', 'createdat'],
    settings: ['id', 'key', 'value', 'createdat', 'updatedat']
  };

  const cleanedRecord = {};
  const columns = validColumns[store] || [];

  columns.forEach(column => {
    // Find matching key (case-insensitive)
    const sourceKey = Object.keys(record).find(key => 
      key.toLowerCase() === column.toLowerCase()
    );

    if (sourceKey && record[sourceKey] !== undefined && record[sourceKey] !== null) {
      cleanedRecord[column] = record[sourceKey];
    }
  });

  return Object.keys(cleanedRecord).length > 0 ? cleanedRecord : record;
}

// 2. SAFE DATABASE WIPE (Order Matters!)
async function wipeDatabase(progressBar) {
  console.log("🧹 Starting Safe Database Wipe...");
  if(progressBar) progressBar.textContent = "Cleaning old data...";

  // Delete Children First (Foreign Key Dependencies)
  await clearStore('internal_marks');
  await clearStore('attendance');
  if(progressBar) progressBar.style.width = '20%';

  // Delete Classes
  await clearStore('classes');
  if(progressBar) progressBar.style.width = '40%';

  // Delete Independent Tables
  await clearStore('students');
  await clearStore('faculty');
  await clearStore('academic_years');
  await clearStore('settings');
  
  if(progressBar) progressBar.style.width = '50%';
  console.log("✅ Database Wiped Clean");
}

// 3. IMPORT LOGIC (ZIP)
async function importStructuredData(zipContent, progressBar) {
  await wipeDatabase(progressBar);

  // Import Order: Independent -> Dependent
  const stores = ['students', 'faculty', 'academic_years', 'settings', 'classes', 'attendance', 'internal_marks'];

  for (let i = 0; i < stores.length; i++) {
    const store = stores[i];
    const file = zipContent.file(store + '.json');

    if (file) {
      try {
        const text = await file.async('text');
        const data = JSON.parse(text);

        for (const item of data) {
          const cleanedItem = sanitizeRecord(store, item);
          await addRecord(store, cleanedItem);
        }
        console.log(`✅ Imported ${store}`);

      } catch (error) {
        console.error(`Error importing ${store}:`, error);
      }
    }

    const percent = 50 + Math.round(((i + 1) / stores.length) * 50);
    if(progressBar) {
        progressBar.style.width = percent + '%';
        progressBar.textContent = percent + '%';
    }
  }
}

// 4. IMPORT LOGIC (JSON File)
async function importFromStructuredJSON(completeData, progressBar) {
  await wipeDatabase(progressBar);

  const stores = ['students', 'faculty', 'academic_years', 'settings', 'classes', 'attendance', 'internal_marks'];

  for (let i = 0; i < stores.length; i++) {
    const store = stores[i];
    const data = completeData.data[store];

    if (data && Array.isArray(data)) {
      try {
        for (const item of data) {
          const cleanedItem = sanitizeRecord(store, item);
          await addRecord(store, cleanedItem);
        }
        console.log(`✅ Imported ${store}`);
      } catch (error) {
        console.error(`Error importing ${store}:`, error);
      }
    }

    const percent = 50 + Math.round(((i + 1) / stores.length) * 50);
    if(progressBar) {
        progressBar.style.width = percent + '%';
        progressBar.textContent = percent + '%';
    }
  }
}

// 5. MAIN HANDLER
async function handleCompleteDbUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const progressDiv = document.getElementById('completeDbProgress');
  const progressBar = document.getElementById('completeDbProgressBar');

  if (progressDiv) progressDiv.style.display = 'block';
  if (progressBar) { progressBar.style.width = '5%'; progressBar.textContent = '5%'; }

  try {
    if (file.name.endsWith('.zip')) {
      // ZIP Logic
      if (typeof JSZip === 'undefined') throw new Error('JSZip library missing.');
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(file);
      await importStructuredData(zipContent, progressBar);

    } else if (file.name.endsWith('.json')) {
      // JSON Logic
      const text = await file.text();
      const data = JSON.parse(text);
      
      if(data.data) {
          await importFromStructuredJSON(data, progressBar);
      } else {
          // Legacy format fallback
          alert("Legacy format not fully supported with new modules. Please convert.");
      }
    } 

    if (progressBar) { progressBar.style.width = '100%'; progressBar.textContent = '100%'; }
    showToast('✅ Database imported successfully!', 'success');

    setTimeout(() => {
        location.reload(); // Best to reload to refresh all caches
    }, 1500);

  } catch (error) {
    console.error('Import error:', error);
    showToast(`Import failed: ${error.message}`, 'error');
    if (progressDiv) progressDiv.style.display = 'none';
  }
  event.target.value = '';
}
