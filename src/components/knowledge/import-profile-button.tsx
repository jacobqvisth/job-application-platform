'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DownloadIcon } from 'lucide-react'
import { importProfileDataAction } from '@/app/(protected)/dashboard/knowledge/actions'

export function ImportProfileButton() {
  const [loading, setLoading] = useState(false)

  async function handleImport() {
    setLoading(true)
    try {
      const result = await importProfileDataAction()
      toast.success(`Imported ${result.importedCount} items from your profile`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Import failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      className="gap-2"
      onClick={handleImport}
      disabled={loading}
    >
      <DownloadIcon className="h-4 w-4" />
      {loading ? 'Importing...' : 'Import Profile Data'}
    </Button>
  )
}
