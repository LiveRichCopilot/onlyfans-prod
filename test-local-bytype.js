const https = require('https');

async function run() {
    const token = "cb0ce7d1-e945-4235-96bd-209210e30d62"; // Your active test token
    const payload = JSON.stringify({
        account_ids: ["254581291"], // Your creator ID
        start_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date().toISOString()
    });

    const options = {
        hostname: 'app.onlyfansapi.com',
        path: '/api/analytics/financial/transactions/by-type',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token,
            'Content-Length': Buffer.byteLength(payload)
        }
    };

    const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            console.log(data);
        });
    });

    req.on('error', (e) => {
        console.error("Error:", e);
    });

    req.write(payload);
    req.end();
}

run();
