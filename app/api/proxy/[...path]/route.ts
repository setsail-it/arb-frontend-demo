import { type NextRequest, NextResponse } from "next/server"

// The actual backend URL
const BACKEND_URL = "https://arb-demo-production.up.railway.app"

async function handleRequest(request: NextRequest, params: { path: string[] }) {
  // Reconstruct the path (e.g., /clients, /clients/123)
  // params.path is an array, so we join it.
  const path = params.path.join("/")
  const query = request.nextUrl.search

  const targetUrl = `${BACKEND_URL}/${path}${query}`

  console.log(`[Proxy] Forwarding ${request.method} request to: ${targetUrl}`)

  try {
    const headers = new Headers(request.headers)
    // Remove host header to avoid issues with the target server
    headers.delete("host")
    headers.delete("connection")

    // Prepare fetch options
    const options: RequestInit = {
      method: request.method,
      headers: headers,
      cache: "no-store",
    }

    // Attach body for non-GET/HEAD requests
    if (request.method !== "GET" && request.method !== "HEAD") {
      const body = await request.text()
      if (body) {
        options.body = body
      }
    }

    const response = await fetch(targetUrl, options)

    console.log(`[Proxy] Received response status: ${response.status}`)

    // Check if this is a streaming response (text/event-stream)
    const contentType = response.headers.get("content-type") || ""
    const isStreaming = contentType.includes("text/event-stream") || contentType.includes("stream")

    const responseHeaders = new Headers(response.headers)
    // Ensure CORS headers are handled by the proxy if needed, or just forward everything
    // Usually Next.js handles the client-side CORS for the /api route automatically (same origin).

    if (isStreaming && response.body) {
      // For streaming responses, pipe the stream directly
      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      })
    } else {
      // For non-streaming responses, buffer and return
      const responseBody = await response.blob()
      return new NextResponse(responseBody, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      })
    }
  } catch (error) {
    console.error("[Proxy] Error forwarding request:", error)
    return NextResponse.json({ error: "Failed to proxy request" }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const params = await context.params
  return handleRequest(request, params)
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const params = await context.params
  return handleRequest(request, params)
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const params = await context.params
  return handleRequest(request, params)
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const params = await context.params
  return handleRequest(request, params)
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const params = await context.params
  return handleRequest(request, params)
}
