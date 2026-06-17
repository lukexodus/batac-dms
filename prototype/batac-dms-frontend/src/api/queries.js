import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

export const usePendingSignatures = () => {
  return useQuery({
    queryKey: ['pendingSignatures'],
    queryFn: async () => {
      const { data } = await apiClient.get('/pendingSignatures');
      return data;
    },
  });
};

export const useSLAData = () => {
  return useQuery({
    queryKey: ['slaData'],
    queryFn: async () => {
      const { data } = await apiClient.get('/slaData');
      return data;
    },
  });
};

export const useDeptWorkload = () => {
  return useQuery({
    queryKey: ['deptWorkload'],
    queryFn: async () => {
      const { data } = await apiClient.get('/deptWorkload');
      return data;
    },
  });
};

export const useLegislativeQueue = () => {
  return useQuery({
    queryKey: ['legislativeQueue'],
    queryFn: async () => {
      const { data } = await apiClient.get('/legislativeQueue');
      return data;
    },
  });
};

export const useSessionCalendar = () => {
  return useQuery({
    queryKey: ['sessionCalendar'],
    queryFn: async () => {
      const { data } = await apiClient.get('/sessionCalendar');
      return data;
    },
  });
};

export const useLegislativeOutput = () => {
  return useQuery({
    queryKey: ['legislativeOutput'],
    queryFn: async () => {
      const { data } = await apiClient.get('/legislativeOutput');
      return data;
    },
  });
};

export const useRoutingHistory = () => {
  return useQuery({
    queryKey: ['routingHistory'],
    queryFn: async () => {
      const { data } = await apiClient.get('/routingHistory');
      return data;
    },
  });
};

export const useDocuments = () => {
  return useQuery({
    queryKey: ['documents'],
    queryFn: async () => {
      const { data } = await apiClient.get('/documents');
      return data;
    },
  });
};

export const usePublicOrdinances = () => {
  return useQuery({
    queryKey: ['publicOrdinances'],
    queryFn: async () => {
      const { data } = await apiClient.get('/publicOrdinances');
      return data;
    },
  });
};

export const useAddDocument = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (newDoc) => {
      const { data } = await apiClient.post('/documents', newDoc);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
};

export const useRemovePendingSignature = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { data } = await apiClient.delete(`/pendingSignatures/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingSignatures'] });
    },
  });
};

export const useAddSession = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (session) => {
      const { data } = await apiClient.post('/sessionCalendar', session);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessionCalendar'] });
    },
  });
};

export const useAddLegislativeQueue = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (item) => {
      const { data } = await apiClient.post('/legislativeQueue', item);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legislativeQueue'] });
    },
  });
};
