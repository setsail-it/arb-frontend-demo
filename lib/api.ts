import { BACKEND_BASE_URL } from "./config"
import type { Client, ClientContext, KeywordIdea, KeywordCluster, KeywordSet, BlogIdea, BlogIdeaDebug, BestAlternateResult } from "@/types"

class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function fetchJson<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const baseUrl = BACKEND_BASE_URL.replace(/\/$/, "")
  const safeEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`

  const res = await fetch(`${baseUrl}${safeEndpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  })

  if (!res.ok) {
    let errorMessage = `API Error: ${res.status} ${res.statusText}`
    try {
      const errorBody = await res.json()
      if (errorBody.detail) {
        errorMessage = errorBody.detail
      }
    } catch (e) {
      // Could not parse error body, ignore
    }
    throw new ApiError(errorMessage, res.status)
  }
  return res.json()
}

export const api = {
  // Clients
  getClients: () => fetchJson<Client[]>("/clients"),
  createClient: (name: string) =>
    fetchJson<Client>("/clients", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  deleteClient: (clientId: string) =>
    fetchJson(`/clients/${clientId}`, {
      method: "DELETE",
    }),
  renameClient: (clientId: string, name: string) =>
    fetchJson<Client>(`/clients/${clientId}/rename`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    }),

  // Context
  getContext: async (clientId: string) => {
    try {
      return await fetchJson<ClientContext>(`/clients/${clientId}/context`)
    } catch (e: any) {
      if (e.status === 404) {
        return {}
      }
      throw e
    }
  },
  saveContext: (clientId: string, data: ClientContext) =>
    fetchJson(`/clients/${clientId}/context`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  fetchContextFromSite: (clientId: string, domain: string) =>
    fetchJson(`/clients/${clientId}/context/fetch`, {
      method: "POST",
      body: JSON.stringify({ domain }),
    }),
  fetchContextFromSiteStream: async (
    clientId: string,
    domain: string,
    onProgress: (message: string, step: number) => void,
    onComplete: (data: ClientContext) => void,
    onError: (error: string) => void,
  ) => {
    const baseUrl = BACKEND_BASE_URL.replace(/\/$/, "")
    const endpoint = `/clients/${clientId}/context/fetch-stream`

    console.log("[v0] Opening SSE stream to:", `${baseUrl}${endpoint}`)

    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ domain }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error("No response body")
      }

      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          console.log("[v0] SSE stream ended")
          if (buffer.trim()) {
            console.log("[v0] Processing remaining buffer:", buffer)
            const lines = buffer.split("\n")
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6).trim()
                if (data && data !== "[DONE]") {
                  try {
                    const event = JSON.parse(data)
                    console.log("[v0] Parsed final event:", event.type)
                    if (event.type === "complete") {
                      console.log("[v0] Complete event from buffer, calling onComplete")
                      onComplete(event.data)
                    }
                  } catch (e) {
                    console.error("[v0] Failed to parse final event:", e)
                  }
                }
              }
            }
          }
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim()
            if (data === "[DONE]") {
              console.log("[v0] Received [DONE] marker")
              continue
            }

            try {
              const event = JSON.parse(data)
              console.log("[v0] Parsed SSE event:", event.type)

              if (event.type === "progress") {
                onProgress(event.message, event.step || 0)
              } else if (event.type === "complete") {
                console.log("[v0] Complete event received, calling onComplete with data")
                onComplete(event.data)
              } else if (event.type === "error") {
                onError(event.message || "Unknown error occurred")
              }
            } catch (e) {
              console.error("[v0] Failed to parse SSE event:", e, "Raw data:", data)
            }
          }
        }
      }
    } catch (e: any) {
      console.error("[v0] Stream fetch error:", e)
      onError(e.message || "Failed to fetch from site")
    }
  },

  // Keywords
  generateKeywordIdeasStream: async (
    clientId: string,
    params: { min_sv?: number; max_kd?: number },
    onProgress: (message: string, step: number) => void,
    onComplete: (data: KeywordIdea[]) => void,
    onError: (error: string) => void,
  ) => {
    const baseUrl = BACKEND_BASE_URL.replace(/\/$/, "")
    const endpoint = `/clients/${clientId}/keywords/generate-ideas`

    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error("No response body")
      }

      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          if (buffer.trim()) {
            const lines = buffer.split("\n")
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6).trim()
                if (data && data !== "[DONE]") {
                  try {
                    const event = JSON.parse(data)
                    if (event.type === "complete") {
                      onComplete(event.data)
                    }
                  } catch (e) {
                    // ignore parse errors
                  }
                }
              }
            }
          }
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim()
            if (data === "[DONE]") continue

            try {
              const event = JSON.parse(data)
              if (event.type === "progress") {
                onProgress(event.message, event.step || 0)
              } else if (event.type === "complete") {
                onComplete(event.data)
              } else if (event.type === "error") {
                onError(event.message || "Unknown error occurred")
              }
            } catch (e) {
              // ignore parse errors
            }
          }
        }
      }
    } catch (e: any) {
      onError(e.message || "Failed to generate keyword ideas")
    }
  },
  getKeywordIdeas: (clientId: string) => fetchJson<KeywordIdea[]>(`/clients/${clientId}/keywords/ideas`),

  developClusters: (
    clientId: string,
    params: {
      max_num_kws_per_seed?: number
      sv_min?: number
      kd_max?: number
      sim_threshold?: number
      intent_min?: number
      intent_max?: number
    },
  ) =>
    fetchJson(`/clients/${clientId}/keywords/develop-clusters`, {
      method: "POST",
      body: JSON.stringify(params),
    }),
  getClusters: (clientId: string) => fetchJson<KeywordCluster[]>(`/clients/${clientId}/keywords/clusters`),

  developSets: (
    clientId: string,
    params: {
      keyword_ids: number[]
      min_sv?: number
    },
  ) =>
    fetchJson<KeywordSet[]>(`/clients/${clientId}/keywords/develop-sets`, {
      method: "POST",
      body: JSON.stringify({
        keyword_ids: params.keyword_ids,
        min_sv: params.min_sv,
      }),
    }),
  getSets: (clientId: string) => fetchJson<KeywordSet[]>(`/clients/${clientId}/keywords/sets`),

  getBestAlternates: (clientId: string) =>
    fetchJson<BestAlternateResult[]>(`/clients/${clientId}/keywords/best-alternates`),

  bestAlternate: (
    clientId: string,
    keywordId: number,
    params: {
      sim_threshold?: number
      limit_per_seed?: number
    },
  ) =>
    fetchJson<BestAlternateResult>(`/clients/${clientId}/keywords/best-alternate`, {
      method: "POST",
      body: JSON.stringify({
        keyword_id: keywordId,
        sim_threshold: params.sim_threshold,
        limit_per_seed: params.limit_per_seed,
      }),
    }),

  // Blog Ideas
  getBlogIdeas: (clientId: string) => fetchJson<BlogIdea[]>(`/clients/${clientId}/blog-ideas`),
  generateBlogIdeas: (clientId: string) =>
    fetchJson<BlogIdea[]>(`/clients/${clientId}/blog-ideas/generate`, {
      method: "POST",
    }),
  updateBlogIdeaTopic: (clientId: string, ideaId: string, topic: string) =>
    fetchJson(`/clients/${clientId}/blog-ideas/${ideaId}`, {
      method: "PUT",
      body: JSON.stringify({ topic }),
    }),
  queueBlogIdea: (clientId: string, ideaId: string) =>
    fetchJson<BlogIdea>(`/clients/${clientId}/blog-ideas/${ideaId}/queue`, { method: "POST" }),
  deleteBlogIdea: (clientId: string, blogIdeaId: number) =>
    fetchJson(`/clients/${clientId}/blog-ideas/${blogIdeaId}`, {
      method: "DELETE",
    }),

  // Automation
  processQueued: (clientId: string) =>
    fetchJson<Array<{ blog_idea_id: number; state: string }>>(`/clients/${clientId}/blog-ideas/process-queued`, {
      method: "POST",
    }),
  getBlogIdeaDebug: (clientId: string, ideaId: string) =>
    fetchJson<BlogIdeaDebug>(`/clients/${clientId}/blog-ideas/${ideaId}/debug`),
  getBlogIdeaProcessStream: async (
    clientId: string,
    blogIdeaId: number,
    onProgress: (message: string, step: number) => void,
    onComplete: (data: { blog_idea_id: number; state: string; final_version_number?: number }) => void,
    onError: (data: { blog_idea_id: number; state: string; message: string }) => void,
    abortSignal?: AbortSignal,
  ) => {
    const baseUrl = BACKEND_BASE_URL.replace(/\/$/, "")
    const endpoint = `/clients/${clientId}/blog-ideas/${blogIdeaId}/process-stream`

    console.log(`[Process Stream] Starting stream for blog idea ${blogIdeaId}`)

    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        signal: abortSignal,
      })

      console.log(`[Process Stream] Response status: ${response.status}, Content-Type: ${response.headers.get("content-type")}`)

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`[Process Stream] Error response: ${errorText}`)
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error("No response body")
      }

      let buffer = ""

      while (true) {
        // Check if aborted
        if (abortSignal?.aborted) {
          reader.cancel()
          break
        }

        const { done, value } = await reader.read()
        if (done) {
          if (buffer.trim()) {
            const lines = buffer.split("\n")
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6).trim()
                if (data && data !== "[DONE]") {
                  try {
                    const event = JSON.parse(data)
                    if (event.type === "complete") {
                      onComplete(event.data)
                    } else if (event.type === "error") {
                      onError(event.data)
                    }
                  } catch (e) {
                    // ignore parse errors
                  }
                }
              }
            }
          }
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim()
            if (data === "[DONE]") continue

            try {
              const event = JSON.parse(data)
              console.log(`[Process Stream] Received event:`, event.type, event)
              if (event.type === "progress") {
                onProgress(event.message, event.step || 0)
              } else if (event.type === "complete") {
                console.log(`[Process Stream] Complete event received`)
                onComplete(event.data)
              } else if (event.type === "error") {
                console.error(`[Process Stream] Error event received:`, event.data)
                onError(event.data)
              }
            } catch (e) {
              console.error(`[Process Stream] Failed to parse event:`, e, "Raw data:", data)
            }
          }
        }
      }
    } catch (e: any) {
      console.error(`[Process Stream] Stream error:`, e)
      // Don't call onError if aborted
      if (!abortSignal?.aborted) {
        onError({
          blog_idea_id: blogIdeaId,
          state: "failed",
          message: e.message || "Failed to stream process events",
        })
      }
    }
  },
  getBlogIdeaHtml: (clientId: string, blogIdeaId: number, versionNumber?: number) => {
    const params = versionNumber ? `?version_number=${versionNumber}` : ""
    return fetchJson<{ blog_idea_id: number; version_number: number; html: string }>(
      `/clients/${clientId}/blog-ideas/${blogIdeaId}/html${params}`,
    )
  },

  getXmlUrl: (blogPostId: string) => `${BACKEND_BASE_URL}/blog-posts/${blogPostId}/xml`,
}
