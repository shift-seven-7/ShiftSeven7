import { FileText, HeartPulse, Plane, Shield, ShieldCheck, Stethoscope, type LucideIcon } from 'lucide-react';
import type { Shift7EmployeeRequestStatus, Shift7EmployeeRequestType } from '@/types/database.types';

/** Ported from the standalone Shift7 app's lib/employeeRequests.ts. */

export interface RequestTypeMeta {
  label: string;
  icon: LucideIcon;
  color: string;
  dates: 'required' | 'none';
  reason: boolean;
}

export const REQUEST_TYPES: Record<Shift7EmployeeRequestType, RequestTypeMeta> = {
  vacation: { label: 'חופשה', icon: Plane, color: 'bg-blue-50 text-blue-600 border-blue-200', dates: 'required', reason: true },
  sick_leave: { label: 'מחלה', icon: HeartPulse, color: 'bg-red-50 text-red-600 border-red-200', dates: 'required', reason: false },
  reserve_duty: { label: 'מילואים', icon: Shield, color: 'bg-green-50 text-green-600 border-green-200', dates: 'required', reason: false },
  weapon_license: { label: 'רישיון נשק', icon: ShieldCheck, color: 'bg-amber-50 text-amber-600 border-amber-200', dates: 'none', reason: false },
  health: { label: 'בעיות בריאות', icon: Stethoscope, color: 'bg-purple-50 text-purple-600 border-purple-200', dates: 'none', reason: false },
  other: { label: 'אחר', icon: FileText, color: 'bg-slate-50 text-slate-600 border-slate-200', dates: 'none', reason: true },
};

export const STATUS_META: Record<Shift7EmployeeRequestStatus, { label: string; color: string }> = {
  pending: { label: 'ממתינה', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  approved: { label: 'אושרה', color: 'bg-green-100 text-green-700 border-green-200' },
  rejected: { label: 'נדחתה', color: 'bg-red-100 text-red-700 border-red-200' },
};

export function dateRangeText(req: { start_date?: string | null; end_date?: string | null }): string {
  if (!req.start_date) return '';
  if (req.end_date && req.end_date !== req.start_date) return `${req.start_date} – ${req.end_date}`;
  return req.start_date;
}
