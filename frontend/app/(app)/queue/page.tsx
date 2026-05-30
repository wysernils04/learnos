'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, RefreshCw } from 'lucide-react'
import { ReviewCard } from '@/components/ReviewCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { queueApi, topicsApi } from '@/lib/api'

export default function QueuePage() {
  const queryClient = useQueryClient()
  const [reviewedCount, setReviewedCount] = useState(0)
  const [currentIndex, setCurrentIndex] = useState(0)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['queue'],
    queryFn: queueApi.list,
    staleTime: 30_000,
  })

  const reviewMutation = useMutation({
    mutationFn: ({ id, quality }: { id: string; quality: number }) =>
      topicsApi.review(id, quality),
    onSuccess: () => {
      setReviewedCount(c => c + 1)
      setCurrentIndex(i => i + 1)
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <RefreshCw className="w-6 h-6 text-primary-400 animate-spin" aria-label="Loading…" />
      </div>
    )
  }

  if (isError || !data?.data) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            Could not load your review queue. Make sure the backend is running.
          </p>
        </CardContent>
      </Card>
    )
  }

  const { items, total_due, cognitive_load_today } = data.data
  const remaining = items.slice(currentIndex)
  const allDone = remaining.length === 0

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary-900">Review queue</h1>
          <p className="text-muted-foreground mt-1">
            {total_due} topic{total_due !== 1 ? 's' : ''} due ·{' '}
            {cognitive_load_today} / 300 load pts today
          </p>
        </div>
        {reviewedCount > 0 && (
          <p className="text-sm text-primary-600 font-medium">
            {reviewedCount} reviewed this session
          </p>
        )}
      </div>

      {/* Progress bar */}
      {items.length > 0 && (
        <div className="w-full h-1.5 bg-primary-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-600 transition-all duration-300"
            style={{ width: `${(currentIndex / items.length) * 100}%` }}
          />
        </div>
      )}

      {/* Content */}
      {allDone ? (
        <Card className="max-w-2xl mx-auto">
          <CardContent className="pt-10 pb-10 flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary-100 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-primary-600" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">All done for today!</h2>
              <p className="text-muted-foreground text-sm mt-1">
                {reviewedCount > 0
                  ? `You reviewed ${reviewedCount} topic${reviewedCount !== 1 ? 's' : ''} this session.`
                  : 'No topics are due today. Check back tomorrow.'}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setCurrentIndex(0)
                setReviewedCount(0)
                queryClient.invalidateQueries({ queryKey: ['queue'] })
              }}
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              Refresh queue
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ReviewCard
          item={remaining[0]}
          queuePosition={currentIndex + 1}
          queueTotal={items.length}
          onReviewed={(id, quality) => reviewMutation.mutate({ id, quality })}
          isPending={reviewMutation.isPending}
        />
      )}
    </div>
  )
}
