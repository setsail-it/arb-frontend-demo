"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { flushSync } from "react-dom"
import type { Client, BlogIdea } from "@/types"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DebugPanel } from "@/components/debug-panel"

interface Props {
  client: Client
  skipAutoLoad?: boolean
}

export function BloggerAutomationView({ client, skipAutoLoad = false }: Props) {
  const [ideas, setIdeas] = useState<BlogIdea[]>([])
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)

  // Debugging state
  const [selectedIdea, setSelectedIdea] = useState<BlogIdea | null>(null)

  // Process streaming state
  const [streamingIdea, setStreamingIdea] = useState<BlogIdea | null>(null)
  const [streamProgress, setStreamProgress] = useState<Array<{ message: string; step: number }>>([])
  const [streamAbortController, setStreamAbortController] = useState<AbortController | null>(null)

  // HTML viewer state
  const [htmlViewerIdea, setHtmlViewerIdea] = useState<BlogIdea | null>(null)
  const [htmlContent, setHtmlContent] = useState<string>("")
  const [loadingHtml, setLoadingHtml] = useState(false)

  const refresh = async () => {
    setLoading(true)
    try {
      const data = await api.getBlogIdeas(client.id)
      setIdeas(data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Skip auto-load if skipAutoLoad is true (e.g., after reset)
    if (skipAutoLoad) {
      return
    }
    refresh()
    // Optional: Poll every 10 seconds
    const interval = setInterval(() => {
      api.getBlogIdeas(client.id).then(setIdeas).catch(console.error)
    }, 10000)
    return () => clearInterval(interval)
  }, [client.id, skipAutoLoad])

  const handleQueue = async (id: number) => {
    try {
      const updatedIdea = await api.queueBlogIdea(client.id, String(id))
      // Update the local state with the queued idea instead of refreshing
      setIdeas((prev) => prev.map((idea) => (idea.id === id ? updatedIdea : idea)))
    } catch (error) {
      console.error("Failed to queue blog idea:", error)
      // Refresh on error to get latest state
      refresh()
    }
  }

  const handleProcessQueued = async () => {
    setProcessing(true)
    try {
      const results = await api.processQueued(client.id)
      // Update local state with the new states instead of refreshing
      setIdeas((prev) =>
        prev.map((idea) => {
          const result = results.find((r) => r.blog_idea_id === idea.id)
          if (result) {
            return { ...idea, state: result.state as BlogIdea["state"] }
          }
          return idea
        }),
      )
    } catch (error) {
      console.error("Failed to process queued ideas:", error)
      // Refresh on error to get latest state
      await refresh()
    } finally {
      setProcessing(false)
    }
  }

  const handleViewProcess = (idea: BlogIdea) => {
    setStreamingIdea(idea)
    setStreamProgress([])

    // Create abort controller for this stream
    const abortController = new AbortController()
    setStreamAbortController(abortController)

    // Start streaming
    api.getBlogIdeaProcessStream(
      client.id,
      idea.id,
      (message, step) => {
        // Use flushSync to ensure immediate UI updates
        flushSync(() => {
          setStreamProgress((prev) => [...prev, { message, step }])
        })
      },
      (data) => {
        // Pipeline completed successfully
        setStreamingIdea(null)
        setStreamProgress([])
        setStreamAbortController(null)
        // Refresh to move item to "Done"
        refresh()
      },
      (data) => {
        // Pipeline failed
        setStreamProgress((prev) => [
          ...prev,
          { message: `Error: ${data.message}`, step: prev.length + 1 },
        ])
        // Refresh to show failed state
        setTimeout(() => {
          setStreamingIdea(null)
          setStreamProgress([])
          setStreamAbortController(null)
          refresh()
        }, 2000)
      },
      abortController.signal,
    )
  }

  const handleCloseStream = () => {
    if (streamAbortController) {
      streamAbortController.abort()
      setStreamAbortController(null)
    }
    setStreamingIdea(null)
    setStreamProgress([])
  }

  const handleViewPost = async (idea: BlogIdea) => {
    setHtmlViewerIdea(idea)
    setLoadingHtml(true)
    setHtmlContent("")
    try {
      const result = await api.getBlogIdeaHtml(client.id, idea.id)
      setHtmlContent(result.html)
    } catch (e) {
      console.error("Failed to load HTML", e)
      setHtmlContent("<p>Failed to load HTML content</p>")
    } finally {
      setLoadingHtml(false)
    }
  }

  const unqueued = ideas.filter((i) => i.state === "unqueued")
  const queued = ideas.filter((i) => i.state === "queued")
  const inProgress = ideas.filter((i) => i.state === "in_progress")
  const done = ideas.filter((i) => i.state === "complete" || i.state === "failed")

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 grid grid-cols-4 gap-4 min-h-0">
        {/* Column 1: Unqueued */}
        <KanbanColumn title={`Unqueued (${unqueued.length})`}>
          {unqueued.map((idea) => (
            <KanbanCard key={idea.id} idea={idea} onView={() => setSelectedIdea(idea)}>
              <Button
                size="sm"
                variant="secondary"
                className="w-full mt-2 h-7 text-xs"
                onClick={() => handleQueue(idea.id)}
              >
                Queue
              </Button>
            </KanbanCard>
          ))}
        </KanbanColumn>

        {/* Column 2: Queued */}
        <KanbanColumn
          title={`Queued (${queued.length})`}
          action={
            <Button
              size="sm"
              className="w-full mb-2"
              onClick={handleProcessQueued}
              disabled={processing || queued.length === 0}
            >
              {processing && <Spinner className="mr-2" />}
              Process Queued
            </Button>
          }
        >
          {queued.map((idea) => (
            <KanbanCard key={idea.id} idea={idea} onView={() => setSelectedIdea(idea)} />
          ))}
        </KanbanColumn>

        {/* Column 3: In Progress */}
        <KanbanColumn title={`In Progress (${inProgress.length})`}>
          {inProgress.map((idea) => (
            <KanbanCard
              key={idea.id}
              idea={idea}
              onView={() => setSelectedIdea(idea)}
              onViewProcess={() => handleViewProcess(idea)}
              isInProgress={true}
            />
          ))}
        </KanbanColumn>

        {/* Column 4: Complete/Failed */}
        <KanbanColumn title={`Done (${done.length})`}>
          {done.map((idea) => (
            <KanbanCard
              key={idea.id}
              idea={idea}
              onView={() => setSelectedIdea(idea)}
              onViewPost={() => handleViewPost(idea)}
            />
          ))}
        </KanbanColumn>
      </div>

      <DebugPanel client={client} idea={selectedIdea} onClose={() => setSelectedIdea(null)} />

      {/* Process Stream Dialog */}
      <Dialog open={streamingIdea !== null} onOpenChange={(open) => !open && handleCloseStream()}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Processing: {streamingIdea?.topic}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto space-y-2 p-4 bg-muted/30 rounded-md">
            {streamProgress.length === 0 ? (
              <div className="text-sm text-muted-foreground">Waiting for progress updates...</div>
            ) : (
              streamProgress.map((progress, idx) => (
                <div key={idx} className="text-sm font-mono">
                  <span className="text-muted-foreground">[{progress.step}]</span> {progress.message}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* HTML Viewer Dialog */}
      <Dialog open={htmlViewerIdea !== null} onOpenChange={(open) => !open && setHtmlViewerIdea(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>View Post: {htmlViewerIdea?.topic}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto border rounded-md">
            {loadingHtml ? (
              <div className="flex items-center justify-center p-8">
                <Spinner className="mr-2" />
                Loading HTML...
              </div>
            ) : (
              <iframe
                srcDoc={htmlContent}
                className="w-full h-full min-h-[600px] border-0"
                title="Blog Post HTML"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function KanbanColumn({
  title,
  children,
  action,
}: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="bg-muted/10 rounded-lg border flex flex-col h-full max-h-full">
      <div className="p-3 border-b bg-muted/20 font-semibold text-sm">{title}</div>
      <div className="p-2 overflow-auto flex-1 space-y-2">
        {action}
        {children}
      </div>
    </div>
  )
}

function KanbanCard({
  idea,
  children,
  onView,
  onViewProcess,
  onViewPost,
  isInProgress,
}: {
  idea: BlogIdea
  children?: React.ReactNode
  onView: () => void
  onViewProcess?: () => void
  onViewPost?: () => void
  isInProgress?: boolean
}) {
  return (
    <div
      className={`p-3 rounded border shadow-sm text-sm space-y-2 ${
        isInProgress ? "bg-cyan-50 dark:bg-cyan-950/20 border-cyan-200 dark:border-cyan-800" : "bg-background"
      }`}
    >
      <div className="font-medium leading-tight">{idea.topic}</div>
      <div className="flex justify-between items-center text-xs text-muted-foreground">
        <Badge variant={idea.state === "failed" ? "destructive" : "outline"} className="text-[10px] h-5 px-1">
          {idea.state}
        </Badge>
        <button onClick={onView} className="hover:underline text-primary">
          View details
        </button>
      </div>
      {isInProgress && onViewProcess && (
        <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={onViewProcess}>
          View process
        </Button>
      )}
      {idea.state === "complete" && onViewPost && (
        <Button size="sm" variant="default" className="w-full h-7 text-xs" onClick={onViewPost}>
          View post
        </Button>
      )}
      {children}
    </div>
  )
}
