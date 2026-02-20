async function run() {
    const token = "cb0ce7d1-e945-4235-96bd-209210e30d62"; // Your test API key
    const payload = {
        account_ids: ["254581291"], // Your creator ID from earlier logs
        start_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date().toISOString()
    };

    const res = await fetch("https://app.onlyfansapi.com/api/analytics/financial/transactions/by-type", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token
        },
        body: JSON.stringify(payload)
    });

    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}

run();
