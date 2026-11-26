import PDFDocument from 'pdfkit';

const PAGE = { margin: 48, width: 595.28, height: 841.89 };
const CONTENT_WIDTH = PAGE.width - PAGE.margin * 2;
const NBSP = '\u00a0';
const COLORS = {
  navy: '#0f2a4a',
  muted: '#5b6b7c',
  line: '#d8dee6',
  accent: '#2563eb',
  light: '#f4f6f8',
};
const EXEMPTION_LABELS = {
  legal: 'Exonération légale',
  export: 'Exportation',
  special_regime: 'Régime particulier',
  other: 'Autre',
};
const COLUMNS = [
  { key: 'description', width: 170, align: 'left' },
  { key: 'quantity', width: 40, align: 'right' },
  { key: 'unitPrice', width: 80, align: 'right' },
  { key: 'discount', width: 50, align: 'right' },
  { key: 'tax', width: 75, align: 'right' },
  { key: 'total', width: 84, align: 'right' },
];

function text(value) {
  if (value === null || value === undefined || value === '') return '—';

  return String(value);
}

function formatMoney(value) {
  const formatted = new Intl.NumberFormat('fr-FR').format(Number(value) || 0);

  return `${formatted.replace(/\s/g, NBSP)}${NBSP}FCFA`;
}

function formatQuantity(value) {
  const formatted = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(
    Number(value) || 0,
  );

  return formatted.replace(/\s/g, NBSP);
}

function formatRate(value) {
  const formatted = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(
    Number(value) || 0,
  );

  return `${formatted.replace(/\s/g, NBSP)}${NBSP}%`;
}

function formatDate(value) {
  if (!value) return '—';

  const [year, month, day] = String(value).slice(0, 10).split('-');

  return year && month && day ? `${day}/${month}/${year}` : '—';
}

function taxLabel(item) {
  if (Number(item.taxRate) !== 0) return formatRate(item.taxRate);

  const label = EXEMPTION_LABELS[item.taxExemptionCode] ?? 'Exonéré';

  return item.taxExemptionCode === 'other' && item.taxExemptionReason
    ? `${label} — ${item.taxExemptionReason}`
    : label;
}

function columnX() {
  const positions = [];
  let x = PAGE.margin;

  for (const column of COLUMNS) {
    positions.push(x);
    x += column.width;
  }

  return positions;
}

export function buildQuotePdf({ quote, client, issuer, logo }) {
  const isDraft = quote.status === 'draft';
  const title = isDraft ? 'DEVIS — BROUILLON' : 'DEVIS';
  const doc = new PDFDocument({
    size: 'A4',
    margin: PAGE.margin,
    info: {
      Title: quote.number ?? 'Devis brouillon',
      Author: issuer.name,
      Subject: 'Devis',
    },
  });
  const x = columnX();
  let y = PAGE.margin;

  function drawFooter() {
    const footerY = PAGE.height - 52;
    const rightWidth = 130;

    doc.save();
    doc
      .moveTo(PAGE.margin, footerY - 10)
      .lineTo(PAGE.width - PAGE.margin, footerY - 10)
      .lineWidth(0.5)
      .strokeColor(COLORS.line)
      .stroke();
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted);

    const leftWidth = CONTENT_WIDTH - rightWidth - 12;
    let cursor = footerY;

    if (issuer.documentFooter) {
      doc.text(issuer.documentFooter, PAGE.margin, cursor, { width: leftWidth });
      cursor = doc.y + 2;
    }

    if (issuer.taxExemptionMention) {
      doc.text(issuer.taxExemptionMention, PAGE.margin, cursor, { width: leftWidth });
    }

    doc.text('Document généré par RelancePro', PAGE.width - PAGE.margin - rightWidth, footerY, {
      width: rightWidth,
      align: 'right',
    });
    doc.restore();
  }

  function addPage() {
    doc.addPage();
    y = PAGE.margin;
    drawFooter();
  }

  function ensureSpace(height) {
    if (y + height > PAGE.height - 90) addPage();
  }

  drawFooter();

  let identityX = PAGE.margin;

  if (logo) {
    try {
      doc.image(logo, PAGE.margin, y, { fit: [80, 48] });
      identityX = PAGE.margin + 92;
    } catch {
      identityX = PAGE.margin;
    }
  }

  doc.font('Helvetica-Bold').fontSize(16).fillColor(COLORS.navy).text(issuer.name, identityX, y);
  doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted);
  if (issuer.legalName) doc.text(issuer.legalName, identityX);
  const address = [issuer.address, issuer.city, issuer.country].filter(Boolean).join(', ');
  if (address) doc.text(address, identityX);
  const contact = [issuer.phone, issuer.email].filter(Boolean).join(' · ');
  if (contact) doc.text(contact, identityX);
  const taxIds = [
    issuer.taxId ? `IFU ${issuer.taxId}` : null,
    issuer.tradeRegister ? `RCCM ${issuer.tradeRegister}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  if (taxIds) doc.text(taxIds, identityX);

  doc.font('Helvetica-Bold').fontSize(20).fillColor(COLORS.navy).text(title, PAGE.margin, y, {
    width: CONTENT_WIDTH,
    align: 'right',
  });
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(COLORS.muted)
    .text(quote.number ?? 'Sans numéro', PAGE.margin, doc.y + 2, {
      width: CONTENT_WIDTH,
      align: 'right',
    });
  if (isDraft) {
    doc
      .font('Helvetica-Oblique')
      .fontSize(9)
      .fillColor(COLORS.accent)
      .text('Sans valeur — document non numéroté', PAGE.margin, doc.y + 2, {
        width: CONTENT_WIDTH,
        align: 'right',
      });
  }

  y = Math.max(doc.y, y + 60) + 18;
  doc
    .moveTo(PAGE.margin, y)
    .lineTo(PAGE.width - PAGE.margin, y)
    .lineWidth(1)
    .strokeColor(COLORS.line)
    .stroke();
  y += 14;

  const leftX = PAGE.margin;
  const rightX = PAGE.margin + CONTENT_WIDTH / 2 + 12;
  const columnWidth = CONTENT_WIDTH / 2 - 12;
  const blockTop = y;

  doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.muted).text('CLIENT', leftX, y);
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(COLORS.navy)
    .text(text(client?.name), leftX, doc.y + 2, { width: columnWidth });
  doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted);
  if (client?.contactName)
    doc.text(`Contact : ${client.contactName}`, leftX, doc.y + 1, { width: columnWidth });
  const clientAddress = [client?.address, client?.city].filter(Boolean).join(', ');
  if (clientAddress) doc.text(clientAddress, leftX, doc.y + 1, { width: columnWidth });
  const clientContact = [client?.phone, client?.email].filter(Boolean).join(' · ');
  if (clientContact) doc.text(clientContact, leftX, doc.y + 1, { width: columnWidth });

  let rightY = blockTop;
  const meta = [
    ["Date d'émission", formatDate(quote.issueDate)],
    ["Valable jusqu'au", formatDate(quote.validUntil)],
    ['Référence client', quote.clientReference],
  ];

  for (const [label, value] of meta) {
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(COLORS.muted)
      .text(label.toUpperCase(), rightX, rightY, {
        width: columnWidth,
      });
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(COLORS.navy)
      .text(text(value), rightX, doc.y + 1, {
        width: columnWidth,
      });
    rightY = doc.y + 6;
  }

  y = Math.max(doc.y, rightY) + 16;

  function drawTableHeader() {
    doc.rect(PAGE.margin, y, CONTENT_WIDTH, 22).fill(COLORS.light);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.muted);
    const labels = ['Description', 'Qté', 'Prix unitaire', 'Remise', 'TVA', 'Total'];

    COLUMNS.forEach((column, index) => {
      doc.text(labels[index], x[index] + 4, y + 7, {
        width: column.width - 8,
        align: column.align,
      });
    });

    y += 22;
  }

  drawTableHeader();

  for (const item of quote.items) {
    const values = [
      formatQuantity(item.quantity),
      formatMoney(item.unitPrice),
      Number(item.discountRate) ? formatRate(item.discountRate) : '—',
      taxLabel(item),
      formatMoney(item.lineTotal),
    ];

    doc.font('Helvetica').fontSize(9);
    const descriptionHeight = doc.heightOfString(text(item.description), {
      width: COLUMNS[0].width - 8,
    });
    const cellsHeight = Math.max(
      ...values.map((value, index) =>
        doc.heightOfString(value, { width: COLUMNS[index + 1].width - 8 }),
      ),
    );
    const rowHeight = Math.max(descriptionHeight, cellsHeight, 12) + 12;

    ensureSpace(rowHeight);
    if (y === PAGE.margin) drawTableHeader();

    const rowTop = y;

    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(COLORS.navy)
      .text(text(item.description), x[0] + 4, rowTop + 6, {
        width: COLUMNS[0].width - 8,
      });
    if (item.unit) {
      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor(COLORS.muted)
        .text(text(item.unit), x[0] + 4, doc.y + 1, {
          width: COLUMNS[0].width - 8,
        });
    }

    doc.font('Helvetica').fontSize(9).fillColor(COLORS.navy);

    values.forEach((value, index) => {
      const column = COLUMNS[index + 1];
      doc.text(value, x[index + 1] + 4, rowTop + 6, {
        width: column.width - 8,
        align: column.align,
      });
    });

    y = rowTop + rowHeight;
    doc
      .moveTo(PAGE.margin, y)
      .lineTo(PAGE.width - PAGE.margin, y)
      .lineWidth(0.5)
      .strokeColor(COLORS.line)
      .stroke();
  }

  y += 14;

  const totalsX = PAGE.width - PAGE.margin - 220;
  const totalsWidth = 220;
  const totals = [
    ['Sous-total', formatMoney(quote.subtotal)],
    ['Remises', `-${NBSP}${formatMoney(quote.discountTotal)}`],
    ['TVA', formatMoney(quote.taxTotal)],
  ];

  ensureSpace(90);
  for (const [label, value] of totals) {
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(COLORS.muted)
      .text(label, totalsX, y, {
        width: totalsWidth / 2,
      });
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(COLORS.navy)
      .text(value, totalsX + totalsWidth / 2, y, {
        width: totalsWidth / 2,
        align: 'right',
      });
    y = doc.y + 4;
  }

  doc
    .moveTo(totalsX, y + 2)
    .lineTo(PAGE.width - PAGE.margin, y + 2)
    .lineWidth(0.5)
    .strokeColor(COLORS.line)
    .stroke();
  y += 8;
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor(COLORS.navy)
    .text('Total', totalsX, y, {
      width: totalsWidth / 2,
    });
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor(COLORS.navy)
    .text(formatMoney(quote.total), totalsX + totalsWidth / 2, y, {
      width: totalsWidth / 2,
      align: 'right',
    });
  y = doc.y + 20;

  for (const [label, value] of [
    ['Notes', quote.notes],
    ['Conditions', quote.terms],
  ]) {
    if (!value) continue;

    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.navy);
    const height = doc.heightOfString(value, { width: CONTENT_WIDTH });
    ensureSpace(height + 24);
    doc.text(label, PAGE.margin, y);
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(COLORS.muted)
      .text(value, PAGE.margin, doc.y + 2, {
        width: CONTENT_WIDTH,
      });
    y = doc.y + 14;
  }

  return doc;
}
