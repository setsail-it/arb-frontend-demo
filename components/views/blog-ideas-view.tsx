"use client"

import { useState, useEffect } from "react"
import type { Client, BlogIdea, KeywordSet } from "@/types"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface Props {
  client: Client
  skipAutoLoad?: boolean
}

export function BlogIdeasView({ client, skipAutoLoad = false }: Props) {
  const [existingTitles, setExistingTitles] = useState<string[]>([])
  const [blogIdeas, setBlogIdeas] = useState<BlogIdea[]>([])
  const [keywordSets, setKeywordSets] = useState<KeywordSet[]>([])
  const [loadingIdeas, setLoadingIdeas] = useState(false)
  const [generating, setGenerating] = useState(false)

  const refresh = async () => {
    setLoadingIdeas(true)
    try {
      const [contextData, ideasData, setsData] = await Promise.all([
        api.getContext(client.id),
        api.getBlogIdeas(client.id),
        api.getSets(client.id),
      ])
      setExistingTitles(contextData.existing_blog_titles || [])
      setBlogIdeas(ideasData || [])
      setKeywordSets(setsData || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingIdeas(false)
    }
  }

  useEffect(() => {
    // Skip auto-load if skipAutoLoad is true (e.g., after reset)
    if (skipAutoLoad) {
      return
    }
    // Auto-load data when client changes
    refresh()
  }, [client.id, skipAutoLoad])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const ideasData = await api.generateBlogIdeas(client.id)
      setBlogIdeas(ideasData || [])
    } catch (e) {
      console.error("Failed to generate blog ideas", e)
    } finally {
      setGenerating(false)
    }
  }

  const handleQueue = async (ideaId: number) => {
    await api.queueBlogIdea(client.id, String(ideaId))
    const ideasData = await api.getBlogIdeas(client.id)
    setBlogIdeas(ideasData || [])
  }

  const handleTopicUpdate = async (ideaId: number, newTopic: string) => {
    await api.updateBlogIdeaTopic(client.id, String(ideaId), newTopic)
    // Optimistic update locally if needed, or just refresh silently
  }

  const handleDelete = async (ideaId: number) => {
    try {
      await api.deleteBlogIdea(client.id, ideaId)
      // Remove from local state
      setBlogIdeas(blogIdeas.filter((idea) => idea.id !== ideaId))
    } catch (e) {
      console.error("Failed to delete blog idea", e)
      // Refresh to get latest state
      await refresh()
    }
  }

  return (
    <div className="grid grid-cols-2 gap-6 h-full">
      {/* Left Column: Existing Titles */}
      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>Existing Titles</span>
            <span className="text-sm font-normal text-muted-foreground">{existingTitles.length} titles</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto">
          <ul className="space-y-2 text-sm">
            {existingTitles.map((title, i) => (
              <li key={i} className="p-2 bg-muted/30 rounded border">
                {title}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Right Column: Future Ideas */}
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <CardTitle>Future Ideas</CardTitle>
          <Button onClick={handleGenerate} disabled={generating}>
            {generating && <Spinner className="mr-2" />}
            Generate Ideas
          </Button>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto p-0">
          <div className="border-t divide-y">
            {blogIdeas.map((idea) => {
              const keywordSet = idea.keyword_set_id
                ? keywordSets.find((set) => set.id === idea.keyword_set_id)
                : null
              return (
                <BlogIdeaRow
                  key={idea.id}
                  idea={idea}
                  keywordSet={keywordSet}
                  onQueue={() => handleQueue(idea.id)}
                  onUpdateTopic={(topic) => handleTopicUpdate(idea.id, topic)}
                  onDelete={() => handleDelete(idea.id)}
                />
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function BlogIdeaRow({
  idea,
  keywordSet,
  onQueue,
  onUpdateTopic,
  onDelete,
}: {
  idea: BlogIdea
  keywordSet: KeywordSet | null | undefined
  onQueue: () => Promise<void>
  onUpdateTopic: (t: string) => void
  onDelete: () => Promise<void>
}) {
  const [topic, setTopic] = useState(idea.topic)
  const [isDirty, setIsDirty] = useState(false)
  const [isQueueing, setIsQueueing] = useState(false)
  const [isSetExpanded, setIsSetExpanded] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleBlur = () => {
    if (isDirty) {
      onUpdateTopic(topic)
      setIsDirty(false)
    }
  }

  const handleQueueClick = async () => {
    setIsQueueing(true)
    try {
      await onQueue()
    } finally {
      setIsQueueing(false)
    }
  }

  const handleDeleteClick = async () => {
    setIsDeleting(true)
    try {
      await onDelete()
      setShowDeleteDialog(false)
    } catch (e) {
      console.error("Failed to delete blog idea", e)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="p-3 flex flex-col gap-2 hover:bg-muted/20">
      <div className="flex justify-between items-start gap-2">
        <Input
          value={topic}
          onChange={(e) => {
            setTopic(e.target.value)
            setIsDirty(true)
          }}
          onBlur={handleBlur}
          className="h-8 font-medium flex-1"
        />
        <div className="flex items-center gap-2">
          <Badge
            variant={
              idea.state === "complete"
                ? "default"
                : idea.state === "failed"
                  ? "destructive"
                  : idea.state === "in_progress"
                    ? "secondary"
                    : "outline"
            }
          >
            {idea.state}
          </Badge>
          <button
            onClick={() => setShowDeleteDialog(true)}
            className="p-1 hover:bg-destructive/10 rounded text-destructive transition-colors"
            title="Delete blog idea"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="flex justify-between items-center text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          {keywordSet ? (
            <button
              onClick={() => setIsSetExpanded(!isSetExpanded)}
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              {isSetExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              <span>Set: {keywordSet.primary_keyword}</span>
            </button>
          ) : (
            <span>{idea.keyword_set_id ? `Set ID: ${idea.keyword_set_id}` : "No set"}</span>
          )}
        </div>
        {idea.state === "unqueued" && (
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-xs bg-transparent"
            onClick={handleQueueClick}
            disabled={isQueueing}
          >
            {isQueueing ? <Spinner className="h-3 w-3" /> : "Queue"}
          </Button>
        )}
      </div>
      {isSetExpanded && keywordSet && (
        <div className="mt-2 pl-4 border-l-2 border-muted space-y-1">
          <div className="text-xs text-muted-foreground mb-1">
            Blog Idea ID: <span className="font-medium text-foreground">{idea.id}</span>
          </div>
          <div className="text-xs font-medium text-foreground">
            Primary: {keywordSet.primary_keyword}
            {keywordSet.primary_search_volume !== null && (
              <span className="text-muted-foreground ml-2">
                (Vol: {keywordSet.primary_search_volume?.toLocaleString()}, KD: {keywordSet.primary_keyword_difficulty})
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            <div className="font-medium mb-1">Secondaries:</div>
            {keywordSet.secondaries && keywordSet.secondaries.length > 0 ? (
              keywordSet.secondaries.map((sec, i) => (
                <div key={i} className="pl-2">
                  • {sec.keyword}
                  {sec.search_volume !== null && (
                    <span className="ml-2">
                      (Vol: {sec.search_volume?.toLocaleString()}, KD: {sec.keyword_difficulty || "N/A"})
                    </span>
                  )}
                </div>
              ))
            ) : (
              <div className="pl-2 italic">No secondaries</div>
            )}
          </div>
        </div>
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Blog Idea</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{idea.topic}"? This will permanently delete the blog idea and all
              associated artifacts (HTML versions, blog post artifacts). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteClick}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
