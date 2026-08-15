// TEMPORARY visual-QA harness — renders the real Dashboard.jsx with seeded
// react-query cache data instead of a live Base44 backend, since this sandbox
// has no .env.local / backend credentials to run the app against real data.
// Not part of the product; delete before merging.
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import "./index.css";

const today = new Date();
const todayStr = today.toISOString().split("T")[0];
function dayGroup(d) {
  const day = d.getDay();
  if (day === 5) return "friday";
  if (day === 6) return "saturday";
  return "weekday";
}
const group = dayGroup(today);

const facilities = [
  { id: "f1", name: "Kiryat Ramla", code: "KR", status: "active" },
  { id: "f2", name: "Transtra Lod", code: "TL", status: "active" },
];

const guardNames = ["דוד כהן","משה לוי","יוסי מזרחי","אבי בן דוד","רון שמעוני","עידן פרץ","נועם אזולאי","גיא רוזן","טל שרון","איתי בר","עומר חן","ליאור נחום","דניאל אשכנזי","יובל גבאי","ניר סבג"];
const staff = guardNames.map((name, i) => ({
  id: `g${i}`, full_name: name, employee_id: String(100 + i), role: "guard",
  qualification: i < 3 ? "shift_supervisor" : "none",
  primary_facility: i % 2 === 0 ? "f1" : "f2", status: "active", email: "", phone: "",
}));
["מולה אדמסו","שירה גל","קרן לוין"].forEach((name, i) => {
  staff.push({
    id: `d${i}`, full_name: name, employee_id: String(200 + i), role: "dispatcher",
    qualification: i === 0 ? "lead_dispatcher" : "none",
    primary_facility: "f1", status: "active", email: "", phone: "",
  });
});

const posts = [
  { id: "p1", name: "שער ראשי", code: "P1", type: "static", facility: "f1", required_role: "guard", status: "active" },
  { id: "p2", name: "היקף צפוני", code: "P2", type: "static", facility: "f1", required_role: "guard", status: "active" },
  { id: "p3", name: "חדר מוקד", code: "P3", type: "control_room", facility: "f1", required_role: "dispatcher", status: "active" },
  { id: "p4", name: "שער כניסה", code: "P4", type: "static", facility: "f2", required_role: "guard", status: "active" },
  { id: "p5", name: "חדר מוקד", code: "P5", type: "control_room", facility: "f2", required_role: "dispatcher", status: "active" },
];

function isoAt(hour, min = 0) {
  const d = new Date(today);
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
}

// Deliberately no morning (05:00-12:00) coverage today, so the staffing-gap
// alert triggers for both facilities, same as in the reference screenshot.
const todayAssignments = [
  { id: "a1", staff_id: "g3", staff_name: "אבי בן דוד", shift_template_id: "t1", shift_code: "A1", post_id: "p1", post_name: "שער ראשי", facility_id: "f1", date: todayStr, actual_start: isoAt(14), actual_end: isoAt(22), status: "in_progress", is_emergency_override: false },
  { id: "a2", staff_id: "g4", staff_name: "רון שמעוני", shift_template_id: "t1", shift_code: "A1", post_id: "p2", post_name: "היקף צפוני", facility_id: "f1", date: todayStr, actual_start: isoAt(14), actual_end: isoAt(22), status: "scheduled", is_emergency_override: false },
  { id: "a3", staff_id: "d0", staff_name: "מולה אדמסו", shift_template_id: "t2", shift_code: "N1", post_id: "p3", post_name: "חדר מוקד", facility_id: "f1", date: todayStr, actual_start: isoAt(22), actual_end: isoAt(6), status: "scheduled", is_emergency_override: true },
  { id: "a4", staff_id: "g7", staff_name: "נועם אזולאי", shift_template_id: "t1", shift_code: "A1", post_id: "p4", post_name: "שער כניסה", facility_id: "f2", date: todayStr, actual_start: isoAt(14), actual_end: isoAt(22), status: "completed", is_emergency_override: false },
  { id: "a5", staff_id: "g9", staff_name: "טל שרון", shift_template_id: "t1", shift_code: "A1", post_id: "p1", post_name: "שער ראשי", facility_id: "f1", date: todayStr, actual_start: isoAt(14), actual_end: isoAt(22), status: "no_show", is_emergency_override: false },
  { id: "a6", staff_id: "g11", staff_name: "ליאור נחום", shift_template_id: "t1", shift_code: "A1", post_id: "p4", post_name: "שער כניסה", facility_id: "f2", date: todayStr, actual_start: isoAt(14), actual_end: isoAt(22), status: "cancelled", is_emergency_override: false },
];

const configs = [{ id: "c1", key: "emergency_mode", value: "false", category: "emergency" }];

const staffingRequirements = [
  { id: "r1", facility_code: "KR", day_group: group, category: "morning", supervisor: 1, guard: 5, dispatcher: 1 },
  { id: "r2", facility_code: "TL", day_group: group, category: "morning", supervisor: 1, guard: 1, dispatcher: 0 },
];

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnMount: false, refetchOnWindowFocus: false, refetchOnReconnect: false, staleTime: Infinity } },
});
queryClient.setQueryData(["staff"], staff);
queryClient.setQueryData(["facilities"], facilities);
queryClient.setQueryData(["posts"], posts);
queryClient.setQueryData(["assignments-today", todayStr], todayAssignments);
queryClient.setQueryData(["configs"], configs);
queryClient.setQueryData(["staffing-requirements"], staffingRequirements);

ReactDOM.createRoot(document.getElementById("root")).render(
  <div dir="rtl" className="bg-background text-foreground font-inter min-h-screen">
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>
  </div>
);
