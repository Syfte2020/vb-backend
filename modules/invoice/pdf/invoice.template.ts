// import { formatPrice } from "../lib/currency_format"; // adjust path as needed

export function invoiceTemplate(data: any) {
  const safeUrl = (process.env.FILE_URL || "").replace(/\/$/, "");
  const logoUrl = data?.logo ? `${safeUrl}/${data.logo}` : null;

  const bookingType =
    data?.booking_type === "booked" ? "Proforma" : "Reserve";

  // Non-addon charges
  const mainCharges: any[] = (data?.charges || []).filter(
    (c: any) => c.charge_type !== "addon"
  );

  // Addon charges
  const addons: any[] = (data?.charges || []).filter(
    (c: any) => c.charge_type === "addon"
  );

  const addonTotal = addons.reduce(
    (sum: number, c: any) => sum + Number(c.total_price || 0),
    0
  );

  const total = (data?.charges || []).reduce(
    (sum: number, c: any) => sum + Number(c.total_price || 0),
    0
  );

  const paxItems: any[] = data?.pax_item_snapshot || [];

  // Build main charges rows
  const mainRows = mainCharges
    .map(
      (charge: any, i: number) => `
      <tr>
        <td class="p">${i + 1}</td>
        <td class="p center">${charge.title || ""}</td>
        <td class="p right">${charge.total_price}</td>
      </tr>`
    )
    .join("");

  // Addon summary row (single line in main table)
  const addonSummaryRow =
    addonTotal > 0
      ? `
      <tr>
        <td class="p">${mainCharges.length + 1}</td>
        <td class="p center">Addons</td>
        <td class="p right">${(addonTotal)}</td>
      </tr>`
      : "";

  // Tax rows
  const taxRows = (data?.taxes || [])
    .map(
      (t: any) => `
      <div class="row">
        <span>${t.tax_name} (${t.tax_percent}%)</span>
        <span>${(t.tax_amount)}</span>
      </div>`
    )
    .join("");

  // Addon detail table
  const addonTable =
    addons.length > 0
      ? `
      <h3 style="margin:24px 0 8px;font-size:13px;color:#555;">Addon Breakdown</h3>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Addon</th>
            <th class="center">Unit Price</th>
            <th class="center">Qty</th>
            <th class="right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${addons
            .map(
              (c: any, i: number) => `
            <tr>
              <td class="p">${i + 1}</td>
              <td class="p">${c.title || ""}</td>
              <td class="p center">${(c.unit_price)}</td>
              <td class="p center">${c.quantity}</td>
              <td class="p right">${(c.total_price)}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>`
      : "";

  // Pax snapshot table
  const paxTable =
    paxItems.length > 0
      ? `
      <h3 style="margin:24px 0 8px;font-size:13px;color:#555;">Pax Items</h3>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Item</th>
            <th class="right">Price</th>
          </tr>
        </thead>
        <tbody>
          ${paxItems
            .map(
              (item: any, i: number) => `
            <tr>
              <td class="p">${i + 1}</td>
              <td class="p">${item.item_name || ""}</td>
              <td class="p right">-</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>`
      : "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: Arial, sans-serif;
    background: #f5f3ff;
    padding: 24px;
    color: #333;
  }

  .card {
    max-width: 800px;
    margin: 0 auto;
    background: rgba(255,255,255,0.92);
    border-radius: 16px;
    padding: 28px;
    border: 1px solid rgba(255,255,255,0.5);
  }

  /* ── Header ── */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .header-left { display: flex; gap: 12px; align-items: center; }
  .header-left img { height: 48px; object-fit: contain; }
  .invoice-title { font-size: 22px; font-weight: 700; color: #1f1f2e; }
  .invoice-sub   { font-size: 12px; color: #888; margin-top: 2px; }
  .header-right  { text-align: right; font-size: 12px; color: #555; line-height: 1.8; }
  .header-right b { color: #333; }

  hr { margin: 20px 0; border: none; border-top: 1px solid #e5e7eb; }

  /* ── Billing ── */
  .billing { display: flex; gap: 40px; }
  .billing-block h2   { font-size: 13px; font-weight: 700; color: #444; margin-bottom: 6px; }
  .billing-block p    { font-size: 12px; color: #666; line-height: 1.8; }

  /* ── Event box ── */
  .event-box {
    margin-top: 20px;
    padding: 14px 16px;
    border-radius: 10px;
    background: rgba(255,255,255,0.6);
    border: 1px solid #e5e7eb;
    font-size: 12px;
    color: #555;
    line-height: 1.9;
  }
  .event-box b { color: #333; }

  /* ── Table ── */
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 16px;
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid #e5e7eb;
    font-size: 12px;
  }
  thead tr { background: #ede9fe; }
  th {
    padding: 10px 12px;
    text-align: left;
    font-size: 12px;
    color: #4b5563;
    font-weight: 600;
  }
  .p        { padding: 10px 12px; color: #444; }
  .center   { text-align: center; }
  .right    { text-align: right; }
  tr + tr   { border-top: 1px solid #f0f0f0; }

  /* ── Summary ── */
  .summary-wrap { display: flex; justify-content: flex-end; margin-top: 20px; }
  .summary {
    width: 300px;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 16px;
    font-size: 13px;
  }
  .row { display: flex; justify-content: space-between; margin-bottom: 8px; }
  .row.grand { font-weight: 700; font-size: 15px; margin-bottom: 0; }
  .summary hr { margin: 12px 0; }
</style>
</head>
<body>
<div class="card">

  <!-- HEADER -->
  <div class="header">
    <div class="header-left">
      ${logoUrl ? `<img src="${logoUrl}" alt="Logo" />` : ""}
      <div>
        <div class="invoice-title">${bookingType} Invoice</div>
        <div class="invoice-sub">Booking Invoice Details</div>
      </div>
    </div>
    <div class="header-right">
      <div>Invoice No: <b>${data?.invoice_number || "-"}</b></div>
      <div>Booking ID: <b>${data?.refNo || "-"}</b></div>
      <div>Date: <b>${data?.orderDate || "-"}</b></div>
    </div>
  </div>

  <hr />

  <!-- BILLING -->
  <div class="billing">
    <div class="billing-block">
      <h2>Bill From</h2>
      <p>
        ${data?.venue_name || ""}<br/>
        ${data?.venue_address || ""}<br/>
        ${data?.venue_city || ""}<br/>
        ${data?.email || ""} ${data?.phone || ""}
      </p>
    </div>
    <div class="billing-block">
      <h2>Bill To</h2>
      <p>
        ${data?.customer?.name || ""}<br/>
        ${data?.customer?.phone || ""}<br/>
        ${data?.customer?.email || ""}
      </p>
    </div>
  </div>

  <!-- EVENT -->
  <div class="event-box">
    <b>Event:</b> ${data?.eventType || "-"}<br/>
    <b>Date:</b> ${data?.fromDate || "-"}<br/>
    <b>Shift:</b> ${data?.shift || "-"}<br/>
    <b>Time:</b> 12:00 PM - 6:00 PM
  </div>

  <!-- MAIN CHARGES TABLE -->
  <table>
    <thead>
      <tr>
        <th style="width:60px;">Serial no.</th>
        <th class="center">Particular</th>
        <th class="right" style="width:120px;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${mainRows}
      ${addonSummaryRow}
    </tbody>
  </table>

  <!-- SUMMARY -->
  <div class="summary-wrap">
    <div class="summary">
      <div class="row"><span>Total</span><span>${(total)}</span></div>
      ${taxRows}
      <hr />
      <div class="row grand">
        <span>Grand Total</span>
        <span>${(Number(data?.amount || 0))}</span>
      </div>
    </div>
  </div>

  <!-- ADDON BREAKDOWN TABLE -->
  ${addonTable}

  <!-- PAX SNAPSHOT TABLE -->
  ${paxTable}

</div>
</body>
</html>`;
}