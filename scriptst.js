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

    const CONFIG = {
        clientId: '80785123608-hebadvt7k7pcjnthnvkbtodc9i328le0.apps.googleusercontent.com',
        spreadsheetId: '1okznadJPiXLygebie8jLStKPF6WUoDsrqqDAFogLS7o',
        apiKey: 'AIzaSyBtIb_OEZXjsex6BlPZsk35ISO3CVKV2io',
        sheetName: 'status'
    };

    let accessToken = null;

    function showToast(msg) {
        alert(msg);
    }

    function generateValuesForSheets() {
        const jobs = JSON.parse(localStorage.getItem('repairJobs'));
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
        values.unshift(['Job Number', 'Customer Name', 'Device Model', 'Fault Description', 'Date Received', 'Estimated Completion', 'Repair Cost', 'Status', 'Status Update Message']);
        return values;
    }

    async function saveToGoogleSheets() {
        if (!accessToken) {
            authModal.style.display = 'block';
            return;
        }

        try {
            // Clear existing data
            await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}/values/${CONFIG.sheetName}!A1:Z1000?valueInputOption=RAW`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    range: `${CONFIG.sheetName}!A1:Z1000`,
                    majorDimension: 'ROWS',
                    values: []
                })
            });

            // Save new data
            const values = generateValuesForSheets();
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
        } catch (err) {
            console.error(err);
            showToast('Failed to save to Sheets');
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
            const jobs = data.values.map(row => ({
                'Job Number': row[0],
                'Customer Name': row[1],
                'Device Model': row[2],
                'Fault Description': row[3],
                'Date Received': row[4],
                'Estimated Completion': row[5],
                'Repair Cost': row[6],
                'Status': row[7],
                'Status Update Message': row[8]
            }));

            localStorage.setItem('repairJobs', JSON.stringify(jobs));
            showToast('Loaded from Google Sheets!');
        } catch (err) {
            console.error(err);
            showToast('Failed to load from Sheets');
        }
    }

    function handleAuthClick() {
        const client = google.accounts.oauth2.initTokenClient({
            client_id: CONFIG.clientId,
            scope: 'https://www.googleapis.com/auth/spreadsheets',
            prompt: 'consent',
            callback: (tokenResponse) => {
                if (tokenResponse.access_token) {
                    accessToken = tokenResponse.access_token;
                    authModal.style.display = 'none';
                    showToast('Authenticated');
                }
            }
        });
        client.requestAccessToken();
    }

    function handleRegisterSubmit(e) {
        e.preventDefault();
        const job = {
            'Job Number': document.getElementById('newJobNumber').value.trim(),
            'Customer Name': document.getElementById('newCustomerName').value.trim(),
            'Device Model': document.getElementById('newDeviceModel').value.trim(),
            'Fault Description': document.getElementById('newFault').value.trim(),
            'Date Received': document.getElementById('newDateReceived').value,
            'Estimated Completion': document.getElementById('newEstimatedCompletion').value,
            'Repair Cost': document.getElementById('newRepairCost').value.trim(),
            'Status': document.getElementById('newStatus').value.trim(),
            'Status Update Message': document.getElementById('newStatusMessage').value.trim()
        };

        let jobs = JSON.parse(localStorage.getItem('repairJobs'));
        jobs.push(job);
        localStorage.setItem('repairJobs', JSON.stringify(jobs));

        showToast('Repair job added');
        registerForm.reset();
    }

    // Events
    registerForm.addEventListener('submit', handleRegisterSubmit);
    saveToSheetsBtn.addEventListener('click', saveToGoogleSheets);
    loadFromSheetsBtn.addEventListener('click', loadFromGoogleSheets);
    authButton.addEventListener('click', handleAuthClick);
    closeModal.addEventListener('click', () => authModal.style.display = 'none');
});