import axios from 'axios'
import { Document, SLAData, DeptWorkload, SessionCalendar, LegislativeOutput, RoutingHistory } from '../lib/schemas'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'

export const mockApi = {
  getDocuments: async (): Promise<Document[]> => {
    const res = await axios.get(`${API_BASE}/documents`)
    return res.data
  },
  getPendingSignatures: async (): Promise<Document[]> => {
    const res = await axios.get(`${API_BASE}/pendingSignatures`)
    return res.data
  },
  getSLAData: async (): Promise<SLAData[]> => {
    const res = await axios.get(`${API_BASE}/slaData`)
    return res.data
  },
  getDeptWorkload: async (): Promise<DeptWorkload[]> => {
    const res = await axios.get(`${API_BASE}/deptWorkload`)
    return res.data
  },
  getSessionCalendar: async (): Promise<SessionCalendar[]> => {
    const res = await axios.get(`${API_BASE}/sessionCalendar`)
    return res.data
  },
  getLegislativeOutput: async (): Promise<LegislativeOutput[]> => {
    const res = await axios.get(`${API_BASE}/legislativeOutput`)
    return res.data
  },
  getLegislativeQueue: async (): Promise<Document[]> => {
    const res = await axios.get(`${API_BASE}/legislativeQueue`)
    return res.data
  },
  getRoutingHistory: async (): Promise<RoutingHistory[]> => {
    const res = await axios.get(`${API_BASE}/routingHistory`)
    return res.data
  },
  addDocument: async (doc: Partial<Document>): Promise<Document> => {
    const res = await axios.post(`${API_BASE}/documents`, doc)
    return res.data
  },
  getPublicOrdinances: async (): Promise<Document[]> => {
    const res = await axios.get(`${API_BASE}/publicOrdinances`)
    return res.data
  },
  removePendingSignature: async (id: string): Promise<void> => {
    await axios.delete(`${API_BASE}/pendingSignatures/${id}`)
  },
  addSession: async (session: any): Promise<any> => {
    const res = await axios.post(`${API_BASE}/sessionCalendar`, session)
    return res.data
  },
  addLegislativeQueue: async (item: any): Promise<any> => {
    const res = await axios.post(`${API_BASE}/legislativeQueue`, item)
    return res.data
  },
  updateLegislativeQueue: async (item: any): Promise<any> => {
    const res = await axios.put(`${API_BASE}/legislativeQueue/${item.id}`, item)
    return res.data
  },
  updatePendingSignature: async (item: any): Promise<any> => {
    const res = await axios.put(`${API_BASE}/pendingSignatures/${item.id}`, item)
    return res.data
  },
  updateDocument: async (item: any): Promise<any> => {
    const res = await axios.patch(`${API_BASE}/documents/${item.id}`, item)
    return res.data
  }
}
