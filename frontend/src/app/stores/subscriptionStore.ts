/**
 * AETHER — Subscription store (frontend mirror of backend entitlements, §50/§62).
 *
 * The backend remains authoritative: these values gate PRESENTATION only.
 * Every premium API is re-checked server-side.
 */

import { create } from 'zustand';
import { apiService } from '../services/api';

export interface PlanLimits {
  resumeVersions: number | null;
  aiCreditsPerMonth: number | null;
  aiInterviewsPerMonth: number | null;
  jdTopConcepts: number | null;
  aptitudeAttemptsPerMonth: number | null;
}

export interface UsageMeter { used: number; quota: number | null }

export interface SubscriptionState {
  planId: 'free' | 'pro' | 'campus';
  status: string;
  entitlements: string[];
  limits: PlanLimits | null;
  usage: Record<string, UsageMeter> | null;
  billingInterval: string | null;
  currentPeriodEnd: string | null;
  accessEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  planConfig: any | null;
  loading: boolean;
  loaded: boolean;
  fetch: () => Promise<void>;
  fetchPlanConfig: () => Promise<void>;
  has: (feature: string) => boolean;
  isPro: () => boolean;
  remaining: (feature: string) => number | null;
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  planId: 'free',
  status: 'ACTIVE',
  entitlements: [],
  limits: null,
  usage: null,
  billingInterval: null,
  currentPeriodEnd: null,
  accessEndsAt: null,
  cancelAtPeriodEnd: false,
  planConfig: null,
  loading: false,
  loaded: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const res = await apiService.get<any>('/subscription/me');
      if (res.success && res.data) {
        set({
          planId: res.data.planId,
          status: res.data.status,
          entitlements: res.data.entitlements || [],
          limits: res.data.limits,
          usage: res.data.usage,
          billingInterval: res.data.billingInterval,
          currentPeriodEnd: res.data.currentPeriodEnd,
          accessEndsAt: res.data.accessEndsAt,
          cancelAtPeriodEnd: !!res.data.cancelAtPeriodEnd,
          loaded: true,
        });
      }
    } catch { /* keep prior state; backend re-checks everything anyway */ }
    finally { set({ loading: false }); }
  },

  fetchPlanConfig: async () => {
    if (get().planConfig) return;
    try {
      const res = await apiService.get<any>('/subscription/plans-config');
      if (res.success && res.data) set({ planConfig: res.data });
    } catch { /* pricing page falls back to static copy */ }
  },

  has: (feature: string) => get().entitlements.includes(feature),
  isPro: () => get().planId !== 'free',
  remaining: (feature: string) => {
    const u = get().usage?.[feature];
    if (!u) return null;
    if (u.quota === null || u.quota === undefined) return null;
    return Math.max(0, u.quota - u.used);
  },
}));
