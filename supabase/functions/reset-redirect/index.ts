console.log('=== RESET REDIRECT FUNCTION INIT ===')

Deno.serve(async (req) => {
  console.log('=== REQUEST RECEIVED ===')
  console.log('URL:', req.url)
  console.log('Method:', req.method)

  try {
    const url = new URL(req.url)
    const token = url.searchParams.get('token')
    console.log('Token:', token)

    if (!token) {
      console.error('ERROR: Missing token parameter')
      return new Response(
        'Missing token parameter',
        { status: 400, headers: { 'Content-Type': 'text/plain' } }
      )
    }

    const deepLink = `marketplace://reset-password?token=${token}`
    console.log('Deep link:', deepLink)

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Redirecting...</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .container {
      background: white;
      border-radius: 12px;
      padding: 40px;
      text-align: center;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
      max-width: 400px;
      width: 100%;
    }
    h1 {
      color: #333;
      margin-bottom: 20px;
    }
    p {
      color: #666;
      margin-bottom: 30px;
      line-height: 1.6;
    }
    .button {
      display: inline-block;
      background: #4CAF50;
      color: white;
      padding: 15px 30px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: bold;
      font-size: 16px;
      transition: background 0.3s;
    }
    .button:hover {
      background: #45a049;
    }
    .spinner {
      border: 3px solid #f3f3f3;
      border-top: 3px solid #4CAF50;
      border-radius: 50%;
      width: 30px;
      height: 30px;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
  <script>
    setTimeout(() => {
      window.location.href = "${deepLink}";
    }, 500);
  </script>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <h1>Opening App...</h1>
    <p>If the app doesn't open automatically, tap the button below:</p>
    <a href="${deepLink}" class="button">Open App</a>
  </div>
</body>
</html>`

    console.log('Returning HTML response')
    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error('=== EDGE FUNCTION ERROR ===')
    console.error('Error:', error)
    return new Response(
      'Internal server error',
      { status: 500, headers: { 'Content-Type': 'text/plain' } }
    )
  }
})
