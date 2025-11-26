"use client"

import { Accordion, AccordionTrigger, AccordionContent, AccordionItem } from "@/components/ui/accordion"
import { useState, useEffect } from "react"
import type { Client, ClientContext } from "@/types"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { Plus, Trash2, Info } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { FetchProgressTracker } from "@/components/fetch-progress-tracker"

interface Props {
  client: Client
  skipAutoLoad?: boolean
}

export function ClientContextView({ client, skipAutoLoad = false }: Props) {
  const [context, setContext] = useState<ClientContext>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fetchProgress, setFetchProgress] = useState<{ message: string; step: number } | null>(null)
  const [isNewClient, setIsNewClient] = useState(false)

  const loadContext = async () => {
    setLoading(true)
    setError(null)
    setIsNewClient(false)
    try {
      const data = await api.getContext(client.id)
      setContext(data)
      if (!data || Object.keys(data).length === 0 || (!data.domain && !data.about)) {
        setIsNewClient(true)
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Skip auto-load if skipAutoLoad is true (e.g., after reset)
    if (skipAutoLoad) {
      return
    }
    // Auto-load context when client changes
    loadContext()
  }, [client.id, skipAutoLoad])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await api.saveContext(client.id, context)
      setIsNewClient(false)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleFetchFromSite = async () => {
    if (!context.domain) return
    setFetching(true)
    setFetchProgress({ message: "Initializing...", step: 0 })
    setError(null)

    await api.fetchContextFromSiteStream(
      client.id,
      context.domain,
      (message, step) => {
        setFetchProgress({ message, step })
      },
      (data) => {
        setContext(data)
        setFetching(false)
        setFetchProgress(null)
        setIsNewClient(false)
        window.location.reload()
      },
      (errorMsg) => {
        setError(errorMsg)
        setFetching(false)
        setFetchProgress(null)
      },
    )
  }

  const addQuestionnaireItem = () => {
    setContext((prev) => ({
      ...prev,
      questionnaire: [...(prev.questionnaire || []), { question: "", answer: "" }],
    }))
  }

  const updateQuestionnaireItem = (index: number, field: "question" | "answer", value: string) => {
    setContext((prev) => {
      const newQuestionnaire = [...(prev.questionnaire || [])]
      if (newQuestionnaire[index]) {
        newQuestionnaire[index] = { ...newQuestionnaire[index], [field]: value }
      }
      return { ...prev, questionnaire: newQuestionnaire }
    })
  }

  const removeQuestionnaireItem = (index: number) => {
    setContext((prev) => {
      const newQuestionnaire = [...(prev.questionnaire || [])]
      newQuestionnaire.splice(index, 1)
      return { ...prev, questionnaire: newQuestionnaire }
    })
  }

  if (loading)
    return (
      <div className="p-8 flex justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">{client.name} Context</h2>
        <div className="flex gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={fetching || !context.domain}>
                Fetch from Site
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-destructive border-destructive text-destructive-foreground">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-white">Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription className="text-white">
                  Warning: Fetching from Site will destroy all current data and replace it. Are you sure you wish to
                  proceed?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-white text-black hover:bg-white/90">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleFetchFromSite} className="bg-white text-black hover:bg-white/90">
                  Proceed
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button onClick={handleSave} disabled={saving}>
            {saving && <Spinner className="mr-2" />}
            Save Context
          </Button>
        </div>
      </div>

      {isNewClient && !fetching && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>New Client - No Context Yet</AlertTitle>
          <AlertDescription>
            This client doesn't have any context data yet. Enter the domain below and click "Fetch from Site" to
            automatically populate fields, or manually fill in the information and click "Save Context".
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {fetching && fetchProgress && (
        <FetchProgressTracker currentStep={fetchProgress.step} message={fetchProgress.message} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Core Identity */}
        <Card>
          <CardHeader>
            <CardTitle>Core Identity</CardTitle>
            <CardDescription>Essential company information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <label htmlFor="domain" className="text-sm font-medium">
                Domain
              </label>
              <Input
                id="domain"
                value={context.domain || ""}
                onChange={(e) => setContext({ ...context, domain: e.target.value })}
                placeholder="example.com"
                disabled={fetching}
              />
            </div>

            <div className="grid gap-2">
              <label htmlFor="about" className="text-sm font-medium">
                About
              </label>
              <Textarea
                id="about"
                value={context.about || ""}
                onChange={(e) => setContext({ ...context, about: e.target.value })}
                placeholder="Company description..."
                rows={4}
                disabled={fetching}
              />
            </div>

            <div className="grid gap-2">
              <label htmlFor="brand_pov" className="text-sm font-medium">
                Brand POV
              </label>
              <Textarea
                id="brand_pov"
                value={context.brand_pov || ""}
                onChange={(e) => setContext({ ...context, brand_pov: e.target.value })}
                placeholder="Unique point of view..."
                rows={3}
                disabled={fetching}
              />
            </div>
          </CardContent>
        </Card>

        {/* Strategy & Market */}
        <Card>
          <CardHeader>
            <CardTitle>Strategy & Market</CardTitle>
            <CardDescription>Target audience and positioning</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <label htmlFor="ideal_target_market" className="text-sm font-medium">
                Ideal Target Market
              </label>
              <Textarea
                id="ideal_target_market"
                value={context.ideal_target_market || ""}
                onChange={(e) => setContext({ ...context, ideal_target_market: e.target.value })}
                placeholder="Who are we selling to?"
                rows={3}
                disabled={fetching}
              />
            </div>

            <div className="grid gap-2">
              <label htmlFor="competitors" className="text-sm font-medium">
                Competitors
              </label>
              <Textarea
                id="competitors"
                value={context.competitors || ""}
                onChange={(e) => setContext({ ...context, competitors: e.target.value })}
                placeholder="List main competitors..."
                rows={3}
                disabled={fetching}
              />
            </div>

            <div className="grid gap-2">
              <label htmlFor="call_to_action" className="text-sm font-medium">
                Call to Action
              </label>
              <Input
                id="call_to_action"
                value={context.call_to_action || ""}
                onChange={(e) => setContext({ ...context, call_to_action: e.target.value })}
                placeholder="e.g. Book a demo"
                disabled={fetching}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Writing Style */}
      <Card>
        <CardHeader>
          <CardTitle>Writing Style</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <label htmlFor="author_tone" className="text-sm font-medium">
              Author Tone
            </label>
            <Textarea
              id="author_tone"
              value={context.author_tone || ""}
              onChange={(e) => setContext({ ...context, author_tone: e.target.value })}
              placeholder="e.g. Professional, witty, authoritative..."
              rows={2}
              disabled={fetching}
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="author_rules" className="text-sm font-medium">
              Author Rules
            </label>
            <Textarea
              id="author_rules"
              value={context.author_rules || ""}
              onChange={(e) => setContext({ ...context, author_rules: e.target.value })}
              placeholder="Specific do's and don'ts for writing..."
              rows={3}
              disabled={fetching}
            />
          </div>
        </CardContent>
      </Card>

      {/* Brand Safety */}
      <Card>
        <CardHeader>
          <CardTitle>Brand Safety</CardTitle>
          <CardDescription>Content guidelines and restrictions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Disallowed Tones</label>
            <Textarea
              value={
                Array.isArray(context.brand_safety?.disallowed_tones)
                  ? context.brand_safety.disallowed_tones.join("\n")
                  : ""
              }
              onChange={(e) =>
                setContext({
                  ...context,
                  brand_safety: {
                    ...context.brand_safety,
                    disallowed_tones: e.target.value.split("\n").filter((s) => s.trim()),
                  },
                })
              }
              placeholder="One per line..."
              rows={3}
              disabled={fetching}
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Disallowed Claims</label>
            <Textarea
              value={
                Array.isArray(context.brand_safety?.disallowed_claims)
                  ? context.brand_safety.disallowed_claims.join("\n")
                  : ""
              }
              onChange={(e) =>
                setContext({
                  ...context,
                  brand_safety: {
                    ...context.brand_safety,
                    disallowed_claims: e.target.value.split("\n").filter((s) => s.trim()),
                  },
                })
              }
              placeholder="One per line..."
              rows={3}
              disabled={fetching}
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Sensitive Topics</label>
            <Textarea
              value={
                Array.isArray(context.brand_safety?.sensitive_topics)
                  ? context.brand_safety.sensitive_topics.join("\n")
                  : ""
              }
              onChange={(e) =>
                setContext({
                  ...context,
                  brand_safety: {
                    ...context.brand_safety,
                    sensitive_topics: e.target.value.split("\n").filter((s) => s.trim()),
                  },
                })
              }
              placeholder="One per line..."
              rows={3}
              disabled={fetching}
            />
          </div>
        </CardContent>
      </Card>

      {/* Brand Assets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Logos</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={Array.isArray(context.logos) ? context.logos.join("\n") : ""}
              onChange={(e) =>
                setContext({
                  ...context,
                  logos: e.target.value.split("\n").filter((s) => s.trim()),
                })
              }
              placeholder="Logo URLs (one per line)"
              rows={4}
              disabled={fetching}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Colors</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={Array.isArray(context.colors) ? context.colors.join("\n") : ""}
              onChange={(e) =>
                setContext({
                  ...context,
                  colors: e.target.value.split("\n").filter((s) => s.trim()),
                })
              }
              placeholder="Color codes (one per line)"
              rows={4}
              disabled={fetching}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fonts</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={Array.isArray(context.fonts) ? context.fonts.join("\n") : ""}
              onChange={(e) =>
                setContext({
                  ...context,
                  fonts: e.target.value.split("\n").filter((s) => s.trim()),
                })
              }
              placeholder="Font names (one per line)"
              rows={4}
              disabled={fetching}
            />
          </CardContent>
        </Card>
      </div>

      {/* Detailed Questionnaire */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xl font-semibold">Detailed Questionnaire</CardTitle>
          <Button variant="outline" size="sm" onClick={addQuestionnaireItem} disabled={fetching}>
            <Plus className="h-4 w-4 mr-2" />
            Add Question
          </Button>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {context.questionnaire && context.questionnaire.length > 0 ? (
            <div className="grid gap-4">
              {context.questionnaire.map((item, idx) => (
                <div key={idx} className="flex gap-3 items-start p-4 border rounded-lg bg-muted/10 group">
                  <div className="flex-1 space-y-2">
                    <Input
                      placeholder="Question"
                      value={item.question}
                      onChange={(e) => updateQuestionnaireItem(idx, "question", e.target.value)}
                      className="font-medium border-transparent bg-transparent hover:bg-background focus:bg-background focus:border-input transition-colors px-2 -mx-2"
                      disabled={fetching}
                    />
                    <Textarea
                      placeholder="Answer"
                      value={item.answer}
                      onChange={(e) => updateQuestionnaireItem(idx, "answer", e.target.value)}
                      rows={2}
                      className="text-sm text-muted-foreground border-transparent bg-transparent hover:bg-background focus:bg-background focus:border-input transition-colors px-2 -mx-2 min-h-[60px]"
                      disabled={fetching}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeQuestionnaireItem(idx)}
                    className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
                    title="Remove item"
                    disabled={fetching}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground bg-muted/10 rounded-lg border border-dashed">
              No questions added yet.
              <br />
              <Button variant="link" onClick={addQuestionnaireItem} className="mt-2" disabled={fetching}>
                Add your first question
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Social Links */}
      <Card>
        <CardHeader>
          <CardTitle>Social Presence</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {["twitter", "linkedin", "facebook", "instagram", "youtube", "tiktok"].map((platform) => (
              <div key={platform} className="grid gap-2">
                <label htmlFor={`social-${platform}`} className="text-sm font-medium capitalize">
                  {platform}
                </label>
                <Input
                  id={`social-${platform}`}
                  value={context.social_links?.[platform as keyof typeof context.social_links] || ""}
                  onChange={(e) =>
                    setContext({
                      ...context,
                      social_links: {
                        ...context.social_links,
                        [platform]: e.target.value,
                      },
                    })
                  }
                  placeholder={`https://${platform}.com/...`}
                  disabled={fetching}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Company Details */}
      <Card>
        <CardHeader>
          <CardTitle>Company Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Industry</label>
              <Input
                value={context.company_details?.industry || ""}
                onChange={(e) =>
                  setContext({
                    ...context,
                    company_details: { ...context.company_details, industry: e.target.value },
                  })
                }
                disabled={fetching}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Location</label>
              <Input
                value={context.company_details?.location || ""}
                onChange={(e) =>
                  setContext({
                    ...context,
                    company_details: { ...context.company_details, location: e.target.value },
                  })
                }
                disabled={fetching}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Employees</label>
              <Input
                value={context.company_details?.employees || ""}
                onChange={(e) =>
                  setContext({
                    ...context,
                    company_details: { ...context.company_details, employees: e.target.value },
                  })
                }
                disabled={fetching}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Founded</label>
              <Input
                value={context.company_details?.founded || ""}
                onChange={(e) =>
                  setContext({
                    ...context,
                    company_details: { ...context.company_details, founded: e.target.value },
                  })
                }
                disabled={fetching}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Images Used */}
      <Card>
        <CardHeader>
          <CardTitle>Images Used (Read-only)</CardTitle>
          <CardDescription>Images discovered from the website</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted p-3 rounded-md text-sm max-h-[200px] overflow-y-auto">
            {context.images_used && context.images_used.length > 0 ? (
              <ul className="list-disc list-inside space-y-1 break-all">
                {context.images_used.map((url, i) => (
                  <li key={i}>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-muted-foreground italic">No images found yet.</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Existing Blog Titles */}
      <Card>
        <CardHeader>
          <CardTitle>Existing Blog Titles (Read-only)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted p-3 rounded-md text-sm min-h-[100px]">
            {context.existing_blog_titles && context.existing_blog_titles.length > 0 ? (
              <ul className="list-disc list-inside space-y-1">
                {context.existing_blog_titles.map((title, i) => (
                  <li key={i}>{title}</li>
                ))}
              </ul>
            ) : (
              <span className="text-muted-foreground italic">No titles found yet.</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Raw JSON (Collapsible for debugging) */}
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="raw-json">
          <AccordionTrigger>Raw Context JSON</AccordionTrigger>
          <AccordionContent>
            <pre className="bg-slate-950 text-slate-50 p-4 rounded-lg overflow-auto text-xs max-h-[300px]">
              {JSON.stringify(context, null, 2)}
            </pre>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
