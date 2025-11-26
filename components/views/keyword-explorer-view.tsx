"use client"

import { useState, useEffect } from "react"
import { flushSync } from "react-dom"
import type { Client, KeywordIdea, KeywordCluster, KeywordSet, BestAlternateResult } from "@/types"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { ChevronRight, ChevronDown } from "lucide-react"
import { KeywordGenerationProgress } from "@/components/keyword-generation-progress"

interface Props {
  client: Client
  skipAutoLoad?: boolean
}

export function KeywordExplorerView({ client, skipAutoLoad = false }: Props) {
  const [config, setConfig] = useState({
    max_num_kws_per_seed: 600,
    sv_min: 200,
    kd_max: 20,
    sim_threshold: 0.7,
    intent_min: 1,
    intent_max: 2,
  })

  // Data state
  const [ideas, setIdeas] = useState<KeywordIdea[]>([])
  const [clusters, setClusters] = useState<KeywordCluster[]>([])
  const [sets, setSets] = useState<KeywordSet[]>([])
  const [bestAlternates, setBestAlternates] = useState<Map<number, BestAlternateResult>>(new Map())

  // Selection state
  const [selectedKeywordIds, setSelectedKeywordIds] = useState<Set<number>>(new Set())
  const [selectedBestAlternateIds, setSelectedBestAlternateIds] = useState<Set<number>>(new Set())

  // Loading state
  const [loadingIdeas, setLoadingIdeas] = useState(false)
  const [loadingClusters, setLoadingClusters] = useState(false)
  const [loadingSets, setLoadingSets] = useState(false)
  const [loadingBestAlternates, setLoadingBestAlternates] = useState(false)

  // Streaming progress state
  const [generatingIdeas, setGeneratingIdeas] = useState(false)
  const [generationProgress, setGenerationProgress] = useState({ message: "", step: 0 })

  const refreshIdeas = async () => {
    const data = await api.getKeywordIdeas(client.id)
    setIdeas(data || [])
  }

  const refreshClusters = async () => {
    const data = await api.getClusters(client.id)
    setClusters(data || [])
  }

  const refreshSets = async () => {
    const data = await api.getSets(client.id)
    setSets(data || [])
  }

  const refreshBestAlternates = async () => {
    try {
      const data = await api.getBestAlternates(client.id)
      // Convert array to Map keyed by original_keyword_id
      const alternatesMap = new Map<number, BestAlternateResult>()
      data.forEach((alt) => {
        alternatesMap.set(alt.original_keyword_id, alt)
      })
      setBestAlternates(alternatesMap)
    } catch (error) {
      console.error("Failed to fetch best alternates:", error)
    }
  }

  // Initial load
  useEffect(() => {
    // Clear state when client changes
    setBestAlternates(new Map())
    setSelectedKeywordIds(new Set())
    setSelectedBestAlternateIds(new Set())
    // Skip auto-load if skipAutoLoad is true (e.g., after reset)
    if (skipAutoLoad) {
      return
    }
    // Refresh data for new client
    refreshIdeas()
    refreshClusters()
    refreshSets()
    refreshBestAlternates()
  }, [client.id, skipAutoLoad])

  const handleToggleKeywordSelection = (keywordId: number) => {
    setSelectedKeywordIds((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(keywordId)) {
        newSet.delete(keywordId)
      } else {
        newSet.add(keywordId)
      }
      return newSet
    })
  }

  const handleFindBestAlternates = async () => {
    if (selectedKeywordIds.size === 0) return

    setLoadingBestAlternates(true)
    try {
      const results = new Map<number, BestAlternateResult>()

      // Call API for each selected keyword in parallel
      const promises = Array.from(selectedKeywordIds).map(async (keywordId) => {
        try {
          const result = await api.bestAlternate(client.id, keywordId, {
            sim_threshold: config.sim_threshold,
            limit_per_seed: config.max_num_kws_per_seed,
          })
          results.set(keywordId, result)
        } catch (error) {
          console.error(`Failed to find best alternate for keyword ${keywordId}:`, error)
        }
      })

      await Promise.all(promises)
      setBestAlternates(results)
      // Refresh the list to get persisted results
      await refreshBestAlternates()
    } catch (error) {
      console.error("Failed to find best alternates:", error)
    } finally {
      setLoadingBestAlternates(false)
    }
  }

  const handleGenerateIdeas = async () => {
    setGeneratingIdeas(true)
    setGenerationProgress({ message: "Starting keyword generation...", step: 0 })

    await api.generateKeywordIdeasStream(
      client.id,
      { min_sv: config.sv_min, max_kd: config.kd_max },
      (message, step) => {
        // Use flushSync to ensure immediate UI updates for progress events
        flushSync(() => {
          setGenerationProgress({ message, step })
        })
      },
      async (data) => {
        // Complete - refresh data and close progress
        await refreshIdeas()
        setGeneratingIdeas(false)
        setGenerationProgress({ message: "", step: 0 })
      },
      (error) => {
        console.error("Keyword generation error:", error)
        setGeneratingIdeas(false)
        setGenerationProgress({ message: "", step: 0 })
      },
    )
  }

  const handleDevelopClusters = async () => {
    setLoadingClusters(true)
    try {
      await api.developClusters(client.id, config)
      await refreshClusters()
    } finally {
      setLoadingClusters(false)
    }
  }

  const handleToggleBestAlternateSelection = (keywordId: number) => {
    setSelectedBestAlternateIds((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(keywordId)) {
        newSet.delete(keywordId)
      } else {
        newSet.add(keywordId)
      }
      return newSet
    })
  }

  const handleDevelopSets = async () => {
    if (selectedBestAlternateIds.size === 0) return

    setLoadingSets(true)
    try {
      await api.developSets(client.id, {
        keyword_ids: Array.from(selectedBestAlternateIds),
        min_sv: config.sv_min,
      })
      await refreshSets()
    } finally {
      setLoadingSets(false)
    }
  }

  return (
    <div className="h-full flex flex-col gap-4">
      {generatingIdeas && (
        <div className="mb-2">
          <KeywordGenerationProgress message={generationProgress.message} step={generationProgress.step} />
        </div>
      )}

      <div className="bg-background border rounded-lg p-4 shadow-sm">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="grid grid-cols-6 gap-2 flex-1">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Max KWs/Seed</label>
              <Input
                type="number"
                value={config.max_num_kws_per_seed}
                onChange={(e) => setConfig({ ...config, max_num_kws_per_seed: +e.target.value })}
                className="h-8"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Min Volume</label>
              <Input
                type="number"
                value={config.sv_min}
                onChange={(e) => setConfig({ ...config, sv_min: +e.target.value })}
                className="h-8"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Max KD</label>
              <Input
                type="number"
                value={config.kd_max}
                onChange={(e) => setConfig({ ...config, kd_max: +e.target.value })}
                className="h-8"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Similarity</label>
              <Input
                type="number"
                step="0.01"
                value={config.sim_threshold}
                onChange={(e) => setConfig({ ...config, sim_threshold: +e.target.value })}
                className="h-8"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Min Intent</label>
              <Input
                type="number"
                value={config.intent_min}
                onChange={(e) => setConfig({ ...config, intent_min: +e.target.value })}
                className="h-8"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Max Intent</label>
              <Input
                type="number"
                value={config.intent_max}
                onChange={(e) => setConfig({ ...config, intent_max: +e.target.value })}
                className="h-8"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-3 gap-4 min-h-0">
        {/* Column 1: Ideas */}
        <Card className="flex flex-col h-full">
          <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Ideas ({ideas.length})</CardTitle>
            <Button size="sm" onClick={handleGenerateIdeas} disabled={generatingIdeas || loadingIdeas}>
              {(generatingIdeas || loadingIdeas) && <Spinner className="mr-2" />}
              {generatingIdeas ? "Generating..." : "Generate"}
            </Button>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-0">
            <div className="border-t">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground bg-muted/50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 w-12">
                      <input
                        type="checkbox"
                        checked={selectedKeywordIds.size === ideas.length && ideas.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedKeywordIds(new Set(ideas.map((idea) => idea.id)))
                          } else {
                            setSelectedKeywordIds(new Set())
                          }
                        }}
                        className="cursor-pointer"
                      />
                    </th>
                    <th className="px-4 py-2">Keyword</th>
                    <th className="px-4 py-2">Source</th>
                    <th className="px-4 py-2 text-right">Volume</th>
                    <th className="px-4 py-2 text-right">KD</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {ideas.map((idea) => (
                    <tr key={idea.id} className={selectedKeywordIds.has(idea.id) ? "bg-muted/30" : ""}>
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          checked={selectedKeywordIds.has(idea.id)}
                          onChange={() => handleToggleKeywordSelection(idea.id)}
                          className="cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-2">{idea.keyword}</td>
                      <td className="px-4 py-2 text-muted-foreground text-xs">{idea.source}</td>
                      <td className="px-4 py-2 text-right text-muted-foreground">
                        {idea.search_volume !== null && idea.search_volume !== undefined
                          ? idea.search_volume.toLocaleString()
                          : "-"}
                      </td>
                      <td className="px-4 py-2 text-right text-muted-foreground">
                        {idea.keyword_difficulty !== null && idea.keyword_difficulty !== undefined
                          ? idea.keyword_difficulty
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Column 2: Best Alternate */}
        <Card className="flex flex-col h-full">
          <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Best Alternate</CardTitle>
            <Button
              size="sm"
              onClick={handleFindBestAlternates}
              disabled={loadingBestAlternates || selectedKeywordIds.size === 0}
            >
              {loadingBestAlternates && <Spinner className="mr-2" />}
              Find({selectedKeywordIds.size})
            </Button>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-4 space-y-3">
            {bestAlternates.size === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                Select keywords from the Ideas column and click Find to get best alternates
              </div>
            ) : (
              Array.from(bestAlternates.entries()).map(([keywordId, result]) => {
                const originalIdea = ideas.find((idea) => idea.id === keywordId)
                const isSelected = selectedBestAlternateIds.has(keywordId)
                return (
                  <div
                    key={keywordId}
                    className={`border rounded-md p-3 space-y-2 cursor-pointer transition-colors ${
                      isSelected ? "bg-muted/30 border-primary" : "hover:bg-muted/10"
                    }`}
                    onClick={() => handleToggleBestAlternateSelection(keywordId)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleBestAlternateSelection(keywordId)}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-0.5 cursor-pointer"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-sm">{result.keyword}</div>
                          {originalIdea && originalIdea.keyword !== result.keyword && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Original: {originalIdea.keyword}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground text-right">
                        <div>
                          Vol:{" "}
                          {result.search_volume !== null && result.search_volume !== undefined
                            ? result.search_volume.toLocaleString()
                            : "-"}
                        </div>
                        <div>
                          KD:{" "}
                          {result.keyword_difficulty !== null && result.keyword_difficulty !== undefined
                            ? result.keyword_difficulty
                            : "-"}
                        </div>
                        {result.is_original && (
                          <div className="text-xs text-blue-500 mt-1">(Original)</div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        {/* Column 3: Sets */}
        <Card className="flex flex-col h-full">
          <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Sets ({sets.length})</CardTitle>
            <Button
              size="sm"
              onClick={handleDevelopSets}
              disabled={loadingSets || selectedBestAlternateIds.size === 0}
            >
              {loadingSets && <Spinner className="mr-2" />}
              Develop({selectedBestAlternateIds.size})
            </Button>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-4 space-y-4">
            {sets.map((set, i) => (
              <div key={i} className="border rounded-md p-3 space-y-2">
                <div className="font-medium text-sm flex justify-between">
                  <span>{set.primary_keyword}</span>
                  <span className="text-xs text-muted-foreground">
                    Vol: {set.primary_search_volume} KD: {set.primary_keyword_difficulty}
                  </span>
                </div>
                <div className="pl-2 border-l-2 border-muted">
                  {set.secondaries && set.secondaries.length > 0 ? (
                    set.secondaries.map((sec, j) => (
                      <div key={j} className="text-xs text-muted-foreground py-0.5 flex justify-between">
                        <span>{sec.keyword}</span>
                        <span>{sec.search_volume}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-muted-foreground py-0.5 italic">No secondaries</div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ClusterItem({ cluster }: { cluster: KeywordCluster }) {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <div className="border rounded-md overflow-hidden">
      <div
        className="bg-muted/30 p-2 flex items-center justify-between cursor-pointer hover:bg-muted/50"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="font-medium text-sm">{cluster.label}</span>
        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </div>
      {isOpen && (
        <div className="p-2 bg-background text-xs border-t">
          <table className="w-full">
            <thead>
              <tr className="text-muted-foreground text-left">
                <th className="pb-1 font-normal">Kw</th>
                <th className="pb-1 font-normal">Vol</th>
                <th className="pb-1 font-normal">KD</th>
              </tr>
            </thead>
            <tbody>
              {cluster.keywords.map((kw, k) => (
                <tr key={k}>
                  <td className="py-0.5">{kw.keyword}</td>
                  <td className="py-0.5">{kw.search_volume}</td>
                  <td className="py-0.5">{kw.keyword_difficulty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
