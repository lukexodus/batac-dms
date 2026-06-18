import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { mockApi } from '../api/mock'
import { Document } from '../lib/schemas'

export function useDocuments() {
  return useQuery({
    queryKey: ['documents'],
    queryFn: mockApi.getDocuments
  })
}

export function usePendingSignatures() {
  return useQuery({
    queryKey: ['pendingSignatures'],
    queryFn: mockApi.getPendingSignatures
  })
}

export function useSLAData() {
  return useQuery({
    queryKey: ['slaData'],
    queryFn: mockApi.getSLAData
  })
}

export function useDeptWorkload() {
  return useQuery({
    queryKey: ['deptWorkload'],
    queryFn: mockApi.getDeptWorkload
  })
}

export function useSessionCalendar() {
  return useQuery({
    queryKey: ['sessionCalendar'],
    queryFn: mockApi.getSessionCalendar
  })
}

export function useLegislativeOutput() {
  return useQuery({
    queryKey: ['legislativeOutput'],
    queryFn: mockApi.getLegislativeOutput
  })
}

export function useLegislativeQueue() {
  return useQuery({
    queryKey: ['legislativeQueue'],
    queryFn: mockApi.getLegislativeQueue
  })
}

export function useRoutingHistory(docId: string) {
  return useQuery({
    queryKey: ['routingHistory', docId],
    queryFn: mockApi.getRoutingHistory,
    enabled: !!docId
  })
}

export function useAddDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (newDoc: Partial<Document>) => mockApi.addDocument(newDoc),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    }
  })
}

export function usePublicOrdinances() {
  return useQuery({
    queryKey: ['publicOrdinances'],
    queryFn: mockApi.getPublicOrdinances
  })
}

export function useRemovePendingSignature() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => mockApi.removePendingSignature(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingSignatures'] })
    }
  })
}

export function useAddSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (session: any) => mockApi.addSession(session),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessionCalendar'] })
    }
  })
}

export function useAddLegislativeQueue() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (item: any) => mockApi.addLegislativeQueue(item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legislativeQueue'] })
    }
  })
}

export function useUpdateLegislativeQueue() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (item: any) => mockApi.updateLegislativeQueue(item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legislativeQueue'] })
    }
  })
}

export function useUpdatePendingSignature() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (item: any) => mockApi.updatePendingSignature(item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingSignatures'] })
    }
  })
}
