// Mobile Repair Tracker with Google Sheets Integration

// DOM Ready
document.addEventListener('DOMContentLoaded', function () {
    if (!localStorage.getItem('repairJobs')) {
        localStorage.setItem('repairJobs', JSON.stringify([]));
    }

    const registerForm = document.getElementById('registerForm');
    const saveToSheetsBtn = document.getElementById('saveToSheets');
    const loadFromSheetsBtn = document.getElementById('loadFromSheets');
    const authModal = document.getElementById('authModal');
    const authButton = document.getElementById('authButton');
    const closeModal = document.querySelector('.close');
    const statusBox = document.getElementById('statusMessage');

    const CONFIG = {
        clientId: '80785123608-hebadvt7k7pcjnthnvkbtodc9i328le0.apps.googleusercontent.com',
        spreadsheetId: '1okznadJPiXLygebie8jLStKPF6WUoDsrqqDAFogLS7o',
        apiKey: 'AIzaSyBtIb_OEZXjsex6BlPZsk35ISO3CVKV2io',
        sheetName: 'status'
    };

    let accessToken = null;

    function showToast(msg, type = 'success') {
        statusBox.textContent = msg;
        statusBox.className = 'status-message ' + type;
        statusBox.style.display = 'block';
        setTimeout(() => statusBox.style.display = 'none', 4000);
    }

    function generateValuesForSheets() {
        const jobs = JSON.parse(localStorage.getItem('repairJobs'));
        if (!jobs || jobs.length === 0) return [];

        const values = jobs.map(job => [
            job['Job Number'],
            job['Customer Name'],
            job['Device Model'],
            job['Fault Description'],
            job['Date Received'],
            job['Estimated Completion'],
            job['Repair Cost'],
            job['Status'],
            job['Status Update Message']
        ]);

        // No header row here to avoid duplication
        return values;
    }

    async function saveToGoogleSheets(clearAfter = true) {
        if (!accessToken) {
            authModal.style.display = 'block';
            return;
        }

        try {
            const values = generateValuesForSheets();
            if (values.length === 0) {
                showToast('No data to save', 'error');
                return;
            }

            const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}/values/${CONFIG.sheetName}!A1:append?valueInputOption=RAW`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    range: `${CONFIG.sheetName}!A1`,
                    majorDimension: 'ROWS',
                    values: values
                })
            });

            if (!response.ok) throw new Error(await response.text());
            showToast('Saved to Google Sheets!');
            if (clearAfter) {
                localStorage.setItem('repairJobs', JSON.stringify([]));
            }
        } catch (err) {
            console.error('Sheets API Error:', err);
            showToast('Failed to save to Sheets', 'error');
        }
    }

    async function loadFromGoogleSheets() {
        if (!accessToken) {
            authModal.style.display = 'block';
            return;
        }

        try {
            const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}/values/${CONFIG.sheetName}!A2:I`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (!response.ok) throw new Error(await response.text());

            const data = await response.json();
            if (!data.values || data.values.length === 0) {
                showToast('No data found in Sheets', 'error');
                return;
            }

            const jobs = data.values.map(row => ({
                'Job Number': row[0] || '',
                'Customer Name': row[1] || '',
                'Device Model': row[2] || '',
                'Fault Description': row[3] || '',
                'Date Received': row[4] || new Date().toISOString(),
                'Estimated Completion': row[5] || '',
                'Repair Cost': row[6] || '',
                'Status': row[7] || '',
                'Status Update Message': row[8] || ''
            }));

            localStorage.setItem('repairJobs', JSON.stringify(jobs));
            showToast('Loaded from Google Sheets!');
        } catch (err) {
            console.error('Sheets API Error:', err);
            showToast('Failed to load from Sheets', 'error');
        }
    }

    function handleAuthClick(callback) {
        if (typeof google === 'undefined' || !google.accounts) {
            showToast('Google API not loaded', 'error');
            return;
        }

        const client = google.accounts.oauth2.initTokenClient({
            client_id: CONFIG.clientId,
            scope: 'https://www.googleapis.com/auth/spreadsheets',
            prompt: 'consent',
            callback: (tokenResponse) => {
                if (tokenResponse && tokenResponse.access_token) {
                    accessToken = tokenResponse.access_token;
                    authModal.style.display = 'none';
                    showToast('Authenticated');
                    if (typeof callback === 'function') callback();
                } else {
                    showToast('Authentication failed', 'error');
                }
            }
        });
        client.requestAccessToken();
    }

    async function generateUniqueJobNumber() {
        const localJobs = JSON.parse(localStorage.getItem('repairJobs')) || [];

        const localNumbers = new Set(
            localJobs
                .map(job => job['Job Number'])
                .filter(jn => /^DR\d{6}$/.test(jn))
                .map(jn => parseInt(jn.slice(2)))
        );

        let sheetNumbers = new Set();
        try {
            const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}/values/${CONFIG.sheetName}!A2:A`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            if (response.ok) {
                const data = await response.json();
                sheetNumbers = new Set(
                    (data.values || [])
                        .map(row => row[0])
                        .filter(jn => /^DR\d{6}$/.test(jn))
                        .map(jn => parseInt(jn.slice(2)))
                );
            }
        } catch (err) {
            console.error('Error fetching sheet job numbers:', err);
        }

        const allUsed = new Set([...localNumbers, ...sheetNumbers]);

        let nextNumber = 1;
        while (allUsed.has(nextNumber) && nextNumber <= 999999) {
            nextNumber++;
        }

        if (nextNumber > 999999) {
            throw new Error('All job numbers are used up');
        }

        return `DR${String(nextNumber).padStart(6, '0')}`;
    }

    async function handleRegisterSubmit(e) {
        e.preventDefault();

        const customerNameEl = document.getElementById('newCustomerName');
        const deviceModelEl = document.getElementById('newDeviceModel');
        const faultDescEl = document.getElementById('newFault');
        const estCompletionEl = document.getElementById('newEstimatedCompletion');
        const repairCostEl = document.getElementById('newRepairCost');

        if (!customerNameEl.value.trim() || !deviceModelEl.value.trim() || !faultDescEl.value.trim() || !estCompletionEl.value || !repairCostEl.value.trim()) {
            showToast('Please fill all required fields', 'error');
            return;
        }

        if (!accessToken) {
            return handleAuthClick(() => handleRegisterSubmit(e));
        }

        let jobs = JSON.parse(localStorage.getItem('repairJobs')) || [];

        let newJobNumber = await generateUniqueJobNumber();

        const job = {
            'Job Number': newJobNumber,
            'Customer Name': customerNameEl.value.trim(),
            'Device Model': deviceModelEl.value.trim(),
            'Fault Description': faultDescEl.value.trim(),
            'Date Received': new Date().toISOString(),
            'Estimated Completion': estCompletionEl.value,
            'Repair Cost': repairCostEl.value.trim(),
            'Status': 'Pending',
            'Status Update Message': 'Job registered'
        };

        jobs.push(job);
        localStorage.setItem('repairJobs', JSON.stringify(jobs));

        await saveToGoogleSheets(true);
        registerForm.reset();
    }

    registerForm.addEventListener('submit', handleRegisterSubmit);
    saveToSheetsBtn.addEventListener('click', () => saveToGoogleSheets(true));
    loadFromSheetsBtn.addEventListener('click', loadFromGoogleSheets);
    authButton.addEventListener('click', () => handleAuthClick());
    closeModal.addEventListener('click', () => authModal.style.display = 'none');
});