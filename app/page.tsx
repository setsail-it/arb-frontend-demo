"use client"

import { useState } from "react"
import type { Client } from "@/types"
import { ClientSelector } from "@/components/client-selector"
import { ClientContextView } from "@/components/views/client-context-view"
import { KeywordExplorerView } from "@/components/views/keyword-explorer-view"
import { BlogIdeasView } from "@/components/views/blog-ideas-view"
import { BloggerAutomationView } from "@/components/views/blogger-automation-view"
import { Button } from "@/components/ui/button"
import { RotateCcw } from "lucide-react"
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

export default function ABSControlPanel() {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [activeTab, setActiveTab] = useState("context")
  const [resetKey, setResetKey] = useState(0)
  // Track which clients have been reset - if a client is in this set, skip auto-load
  const [resetClients, setResetClients] = useState<Set<string>>(new Set())

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Left Sidebar */}
      <div className="w-64 border-r bg-muted/10 flex flex-col p-4 space-y-6">
        <div className="font-bold text-xl tracking-tight">ABS Control Panel</div>

        <ClientSelector
          selectedClient={selectedClient}
          onSelectClient={(client) => {
            setSelectedClient(client)
            // Clear reset flag when switching to a different client
            setResetClients((prev) => {
              const newSet = new Set(prev)
              newSet.delete(client.id)
              return newSet
            })
          }}
          onClientDeleted={() => {
            setSelectedClient(null)
            setResetClients(new Set())
          }}
        />

        {selectedClient && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="w-full">
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset Client Data
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset Client Data</AlertDialogTitle>
                <AlertDialogDescription>
                  This will clear all loaded data for {selectedClient.name}. You will need to press buttons again to load
                  content (Fetch from Site, Generate Ideas, etc.). This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (selectedClient) {
                      // Mark this client as reset
                      setResetClients((prev) => new Set(prev).add(selectedClient.id))
                      // Force remount of all views
                      setResetKey((prev) => prev + 1)
                    }
                  }}
                >
                  Reset
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        <div className="space-y-1">
          <NavButton label="Client Context" active={activeTab === "context"} onClick={() => setActiveTab("context")} />
          <NavButton
            label="Keyword Explorer"
            active={activeTab === "keywords"}
            onClick={() => setActiveTab("keywords")}
          />
          <NavButton label="Past & Future Ideas" active={activeTab === "ideas"} onClick={() => setActiveTab("ideas")} />
          <NavButton
            label="Blogger Automation"
            active={activeTab === "automation"}
            onClick={() => setActiveTab("automation")}
          />
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {!selectedClient ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Select a client from the sidebar to get started.
          </div>
        ) : (
          <div className="flex-1 p-6 overflow-y-auto">
            {activeTab === "context" && (
              <ClientContextView
                key={`context-${resetKey}`}
                client={selectedClient}
                skipAutoLoad={resetClients.has(selectedClient.id)}
              />
            )}
            {activeTab === "keywords" && (
              <KeywordExplorerView
                key={`keywords-${resetKey}`}
                client={selectedClient}
                skipAutoLoad={resetClients.has(selectedClient.id)}
              />
            )}
            {activeTab === "ideas" && (
              <BlogIdeasView
                key={`ideas-${resetKey}`}
                client={selectedClient}
                skipAutoLoad={resetClients.has(selectedClient.id)}
              />
            )}
            {activeTab === "automation" && (
              <BloggerAutomationView
                key={`automation-${resetKey}`}
                client={selectedClient}
                skipAutoLoad={resetClients.has(selectedClient.id)}
              />
            )}
          </div>
        )}
      </main>
    </div>
  )
}

function NavButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors
        ${active ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground hover:text-foreground"}
      `}
    >
      {label}
    </button>
  )
}
