const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Add/Delete DNS Record</title>
</head>
<body>
  <h1>Add/Delete DNS Record</h1>
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
      const response = await fetch(\`/add-record?name=\${name}&ips=\${JSON.stringify(ips)}&ttl=\${ttl}\`, { method: "POST" });
      const result = await response.json();
      alert(result.message);
    }

    async function deleteRecords(event) {
      event.preventDefault();
      const name = document.getElementById("delete-name").value;
      const response = await fetch(\`/delete-records?name=\${name}\`, { method: "POST" });
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
  const url = new URL(request.url)
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
    const name = url.searchParams.get('name')
    const ips = JSON.parse(url.searchParams.get('ips'))
    const ttl = url.searchParams.get('ttl')
    if (name && ips && ttl) {
      const apiKey = 'API_TOKEN'
      const zoneId = 'ZONE_ID'
      const proxied = false
      const recordId = await getRecordId(apiKey, zoneId, name)
      if (recordId) {
        const response = await editRecord(apiKey, zoneId, recordId, name, ips, ttl, proxied)
        return new Response(JSON.stringify({ message: `Record ${name} updated with IPs ${ips}` }), { headers: { 'Content-Type': 'application/json' } })
      } else {
        const response =await addRecord(apiKey, zoneId, name, ips, ttl, proxied)
        return new Response(JSON.stringify({ message: `Record ${name} created with IPs ${ips}` }), { headers: { 'Content-Type': 'application/json' } })
      }
    } else {
      return new Response(null, { status: 400 })
    }
  } else if (url.pathname === '/delete-records') {
    const name = url.searchParams.get('name')
    if (name) {
      const apiKey = 'API_TOKEN'
      const zoneId = 'ZONE_ID'
      const recordId = await getRecordId(apiKey, zoneId, name)
      if (recordId) {
        const response = await deleteRecord(apiKey, zoneId, recordId)
        return new Response(JSON.stringify({ message: `Record ${name} deleted` }), { headers: { 'Content-Type': 'application/json' } })
      } else {
        return new Response(JSON.stringify({ message: `Record ${name} not found` }), { headers: { 'Content-Type': 'application/json' } })
      }
    } else {
      return new Response(null, { status: 400 })
    }
  } else {
    return new Response('Not found', { status: 404 })
  }
}

async function getRecordId(apiKey, zoneId, name) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?type=A&name=${name}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  })
  const data = await response.json()
  if (data.result.length > 0) {
    return data.result[0].id
  } else {
    return null
  }
}

async function addRecord(apiKey, zoneId, name, ips, ttl, proxied) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: 'A',
      name: name,
      content: ips[0],
      ttl: ttl,
      proxied: proxied
    })
  })
  const data = await response.json()
  return data
}

async function editRecord(apiKey, zoneId, recordId, name, ips, ttl, proxied) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: 'A',
      name: name,
      content: ips[0],
      ttl: ttl,
      proxied: proxied
    })
  })
  const data = await response.json()
  return data
}

async function deleteRecord(apiKey, zoneId, recordId) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  })
  const data = await response.json()
  return data
}
