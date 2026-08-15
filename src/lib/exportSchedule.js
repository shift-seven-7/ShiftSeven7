import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const HEB_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

function isDark(hex) {
  if (!hex || hex.length < 7) return false;
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

function rankOf(staffId, staffData) {
  const s = staffData.find(x => x.id === staffId);
  if (!s) return 99;
  if (s.role === "guard" && s.qualification === "shift_supervisor") return 0;
  if (s.role === "guard") return 1;
  if (s.role === "dispatcher" && s.qualification === "lead_dispatcher") return 2;
  if (s.role === "dispatcher") return 3;
  return 4;
}

/**
 * Export the finalized weekly schedule as a clean PDF document.
 */
export async function exportSchedulePDF({ assignments, templates, facilities, staffData, weekLabel, facilityName }) {
  const active = assignments.filter(a => a.status !== "cancelled");

  // Build staff list from assignments
  const map = {};
  active.forEach(a => {
    const live = staffData.find(x => x.id === a.staff_id);
    map[a.staff_id] = live?.full_name || a.staff_name;
  });
  const entries = Object.entries(map).sort((a, b) =>
    rankOf(a[0], staffData) - rankOf(b[0], staffData) || a[1].localeCompare(b[1], "he")
  );

  const dates = [...new Set(active.map(a => a.date))].sort();
  const cellMap = {};
  active.forEach(a => { cellMap[`${a.staff_id}::${a.date}`] = a; });

  // Build clean off-screen HTML table
  const container = document.createElement("div");
  container.style.cssText = "position:fixed; left:-9999px; top:0; direction:rtl; background:#fff; padding:24px; font-family:Arial,Helvetica,sans-serif;";

  let html = `
    <div style="text-align:center; margin-bottom:16px;">
      <h1 style="font-size:20px; margin:0 0 4px;">סידור עבודה סופי</h1>
      <p style="font-size:13px; color:#666; margin:0;">שבוע: ${weekLabel}${facilityName ? " | מתקן: " + facilityName : " | כלל הצוות"}</p>
    </div>
    <table style="border-collapse:collapse; width:100%; direction:rtl;">
      <thead>
        <tr>
          <th style="background:#1f2937; color:#fff; font-size:11px; padding:6px 8px; border:1px solid #4b5563; text-align:right; min-width:100px;">שם עובד</th>`;

  dates.forEach(date => {
    const d = new Date(date + "T12:00:00");
    html += `<th style="background:#1f2937; color:#fff; font-size:11px; padding:6px 8px; border:1px solid #4b5563; text-align:center; min-width:80px;">${HEB_DAYS[d.getDay()]}<br><span style="font-weight:normal; font-size:9px; opacity:0.8;">${d.getDate()}/${d.getMonth() + 1}</span></th>`;
  });
  html += `</tr></thead><tbody>`;

  entries.forEach(([staffId, staffName], ri) => {
    html += `<tr><td style="background:${ri % 2 === 0 ? "#f3f4f6" : "#e9eaec"}; font-size:11px; font-weight:bold; padding:6px 8px; border:1px solid #9ca3af; text-align:right;">${staffName}</td>`;
    dates.forEach(date => {
      const a = cellMap[`${staffId}::${date}`];
      const tpl = a ? templates.find(t => t.id === a.shift_template_id) : null;
      const color = tpl?.color || (ri % 2 === 0 ? "#ffffff" : "#f9fafb");
      const dark = color ? isDark(color) : false;
      const textColor = dark ? "#fff" : "#111";
      if (a && tpl) {
        html += `<td style="background:${color}; border:1px solid #9ca3af; text-align:center; padding:4px; font-size:10px; color:${textColor};">
          <div style="font-weight:bold; font-size:12px;">${a.shift_code}</div>
          ${tpl.post_number ? `<div style="font-size:9px; opacity:0.8;">ע׳${tpl.post_number}</div>` : ""}
          <div style="font-size:8px; opacity:0.7;">${formatTime(a.actual_start)}</div>
        </td>`;
      } else {
        html += `<td style="background:${color}; border:1px solid #9ca3af;"></td>`;
      }
    });
    html += `</tr>`;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, { scale: 2, backgroundColor: "#ffffff" });
    const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const imgWidth = pageWidth - 2 * margin;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    if (imgHeight <= pageHeight - 2 * margin) {
      const imgData = canvas.toDataURL("image/png");
      pdf.addImage(imgData, "PNG", margin, margin, imgWidth, imgHeight);
    } else {
      // Multi-page: slice canvas into page-height chunks
      const ratio = canvas.width / imgWidth;
      const pageContentHeight = pageHeight - 2 * margin;
      const pageCanvasHeight = Math.floor(pageContentHeight * ratio);
      let y = 0;
      while (y < canvas.height) {
        const sliceHeight = Math.min(pageCanvasHeight, canvas.height - y);
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;
        const ctx = pageCanvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(canvas, 0, y, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
        const pageImgData = pageCanvas.toDataURL("image/png");
        if (y > 0) pdf.addPage();
        pdf.addImage(pageImgData, "PNG", margin, margin, imgWidth, sliceHeight / ratio);
        y += sliceHeight;
      }
    }
    pdf.save("סידור_עבודה.pdf");
  } finally {
    document.body.removeChild(container);
  }
}