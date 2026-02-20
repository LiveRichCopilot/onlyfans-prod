const token = "cb0ce7d1-e945-4235-96bd-209210e30d62";

async function run() {
    const payload = {
        account_ids: ["254581291"], // Your creator ID from logs
        start_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date().toISOString()
    };
    
    // Fallback to older node fetch or builtin
    let fetchFn;
    if (typeof fetch !== 'undefined') {
        fetchFn = fetch;
    } else {
        const https = require('https');
        fetchFn = (url, options) => new Promise((resolve, reject) => {
            const req = https.request(url, options, res => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve({ json: () => JSON.parse(data) }));
            });
            req.on('error', reject);
            if (options.body) req.write(options.body);
            req.end();
        });
    }

    try {
        const res = await fetchFn("https://app.onlyfansapi.com/api/analytics/financial/transactions/by-type", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        console.log(JSON.stringify(data, null, 2));
    } catch(e) {
        console.error(e);
    }
}
run();
