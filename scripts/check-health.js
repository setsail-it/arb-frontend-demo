const backendUrl = "https://arb-demo-production.up.railway.app/health"

async function checkHealth() {
  try {
    console.log(`Checking health of ${backendUrl}...`)
    const response = await fetch(backendUrl)
    console.log(`Status: ${response.status}`)
    if (response.ok) {
      const data = await response.json()
      console.log("Health check passed:", data)
    } else {
      console.log("Health check failed")
    }
  } catch (error) {
    console.error("Error connecting to backend:", error.message)
  }
}

checkHealth()
