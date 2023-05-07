const zones = [
  { zoneId: 'ZONE_ID_ONE', zoneName: 'NAME_ONE' },
  { zoneId: 'ZONE_ID_TWO', zoneName: 'NAME_TWO' },
  // Add more zones as needed
];

const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>CFDNS API</title>
</head>
<body>
  <h1>Add/Delete DNS Record</h1>
  <label for="zone-select">Select a zone:</label>
  <select id="zone-select">
    <option value="">Select The Zone Here</option>
    ${zones.map(zone => `<option value="${zone.zoneId}">${zone.zoneName}</option>`).join('')}
  </select>
  <form method="POST" onSubmit="addRecord(event)">
    <h2>Add DNS Record</h2>
    <label for="add-name">Record Name:</label>
    <input type="text" id="add-name" name="add-name"><br><br>
    <label for="add-ip">IP Addresses (JSON array):</label>
    <input type="text" id="add-ip" name="add-ip"><br><br>
    <label for="add-ttl">TTL:</label>
    <input type="number" id="add-ttl" name="add-ttl" value="60"><br><br>
    <button type="submit">Add Record</button>
  </form>
  <br>
  <form method="POST" onSubmit="deleteRecords(event)">
    <h2>Delete DNS Records</h2>
    <label for="delete-name">Record Name:</label>
    <input type="text" id="delete-name" name="delete-name"><br><br>
    <button type="submit">Delete Records</button>
  </form>
  <script>
    async function addRecord(event) {
      event.preventDefault();
      const name = document.getElementById("add-name").value;
      const ips = JSON.parse(document.getElementById("add-ip").value);
      const ttl = document.getElementById("add-ttl").value;
      const zoneId = document.getElementById("zone-select").value;
      const response = await fetch(\`/add-record?zoneId=\${zoneId}&name=\${name}&ips=\${JSON.stringify(ips)}&ttl=\${ttl}\`, { method: "POST" });
      const result = await response.json();
      alert(result.message);
    }

    async function deleteRecords(event) {
      event.preventDefault();
      const name = document.getElementById("delete-name").value;
      const zoneId = document.getElementById("zone-select").value;
      const response = await fetch(\`/delete-records?zoneId=\${zoneId}&name=\${name}\`, { method: "POST" });
      const result = await response.json();
      alert(result.message);
    }
  </script>
</body>
</html>
`;

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url);
  if (url.pathname === '/') {
    // Require authentication
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return new Response(null, {
        status: 401,
        headers: { 'WWW-Authenticate': 'Basic realm="Restricted Area"' },
      })
    }

    // Check username and password
    const credentials = atob(authHeader.slice('Basic '.length)).split(':')
    const username = credentials[0]
    const password = credentials[1]
    if (username !== 'USER_NAME' || password !== 'PASS_WORD') {
      return new Response(null, {
        status: 401,
        headers: { 'WWW-Authenticate': 'Basic realm="Restricted Area"' },
      })
    }

    return new Response(html, { headers: { 'Content-Type': 'text/html' } });
  } else if (url.pathname === '/add-record') {
    const zoneId = url.searchParams.get('zoneId');
    const name = url.searchParams.get('name');
    const ips = JSON.parse(url.searchParams.get('ips'));
    const ttl = url.searchParams.get('ttl');
    const result = await addRecord(zoneId, name, ips, ttl);
    return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
  } else if (url.pathname === '/delete-records') {
    const zoneId = url.searchParams.get('zoneId');
    const name = url.searchParams.get('name');
    const result = await deleteRecords(zoneId, name);
    return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
  } else {
    return new Response('Not found', { status: 404 });
  }
}

async function addRecord(zoneId, name, ips, ttl) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?type=A&name=${name}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer API_KEY_HERE`,
    },
  });

  const result = await response.json();
  const records = result.result;
  if (records.length > 0) {
    // Record already exists
    return { message: `DNS record '${name}' already exists.` };
  }

  // Records do not exist, create them
  const responses = await Promise.all(ips.map(async ip => {
    const response2 = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer API_KEY_HERE`,
      },
      body: JSON.stringify({
        type: 'A',
        name: name,
        content: ip,
        ttl: ttl,
      }),
    });

    return response2.json();
  }));

  const addedIps = responses.filter(response => response.success).map(response => response.result.content);
  if (addedIps.length > 0) {
    return { message: `DNS record '${name}' added for IPs: ${addedIps.join(', ')}.` };
  } else {
    return { message: `Failed to add DNS record '${name}'.` };
  }
}

async function deleteRecords(zoneId, name) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?type=A&name=${name}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer API_KEY_HERE`,
    },
  });

  const result = await response.json();
  const records = result.result;
  if (records.length === 0) {
    // Record does not exist
    return { message: `DNS records of '${name}' does not exist.` };
  }

  // Record(s) exist, delete them
  for (const record of records) {
    const response2 = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${record.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer API_KEY_HERE`,
      },
    });

    await response2.json();
  }

  return { message: `DNS records of '${name}' deleted.` };
}
