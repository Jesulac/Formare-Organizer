import { jsPDF } from 'jspdf';
import { Operation } from '../types/operation';
import {
  calculateFilamentGrams,
  formatDateDisplay,
  formatEuro,
  parseDate,
} from './calculations';

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

function getMonthKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthLabelFromKey(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = parseInt(yearStr, 10);
  const monthIdx = parseInt(monthStr, 10) - 1;
  if (isNaN(year) || isNaN(monthIdx) || monthIdx < 0 || monthIdx > 11) {
    return monthKey;
  }
  return `${MONTH_NAMES[monthIdx]} ${year}`;
}

export function generateMonthlySalesPdf(
  allOperations: Operation[],
  explicitMonthKey?: string
): { monthLabel: string; count: number } {
  const now = new Date();
  let targetMonthKey = explicitMonthKey || getMonthKeyFromDate(now);

  const filterByMonth = (key: string) =>
    allOperations.filter((op) => {
      if (!op || op.tipo === 'cierre') return false;
      const d = parseDate(op.fecha);
      return getMonthKeyFromDate(d) === key;
    });

  let monthOps = filterByMonth(targetMonthKey);

  // If no explicit month was requested and current calendar month has 0 operations,
  // fallback to the latest month with operations so the report is never empty if data exists
  if (!explicitMonthKey && monthOps.length === 0 && allOperations.length > 0) {
    const sorted = [...allOperations].sort(
      (a, b) => parseDate(b.fecha).getTime() - parseDate(a.fecha).getTime()
    );
    const latestKey = getMonthKeyFromDate(parseDate(sorted[0].fecha));
    if (latestKey) {
      targetMonthKey = latestKey;
      monthOps = filterByMonth(targetMonthKey);
    }
  }

  // Sort chronologically ascending inside the month report
  monthOps.sort((a, b) => {
    const diff = parseDate(a.fecha).getTime() - parseDate(b.fecha).getTime();
    if (diff !== 0) return diff;
    return (a.createdAt || 0) - (b.createdAt || 0);
  });

  const monthLabel = getMonthLabelFromKey(targetMonthKey);

  // Compute metrics for the month
  const salesOps = monthOps.filter((op) => op.tipo === 'venta');
  const purchaseOps = monthOps.filter(
    (op) => op.tipo === 'compra' || op.tipo === 'inversion'
  );

  const numVentas = salesOps.length;
  const totalUnidadesVendidas = salesOps.reduce(
    (acc, op) => acc + (op.unidades || 1),
    0
  );
  const ingresosBrutos = salesOps.reduce((acc, op) => acc + (op.precio || 0), 0);
  const costesVentas = salesOps.reduce(
    (acc, op) => acc + Math.abs(op.costes || 0),
    0
  );
  const beneficioVentas = salesOps.reduce(
    (acc, op) => acc + (op.beneficio || 0),
    0
  );
  const gastosCompras = purchaseOps.reduce(
    (acc, op) => acc + Math.abs(op.costes || 0),
    0
  );
  const balanceNetoTotal = ingresosBrutos - costesVentas - gastosCompras;
  const gramosConsumidos = salesOps.reduce(
    (acc, op) => acc + calculateFilamentGrams(Math.abs(op.costes || 0), 15.99),
    0
  );
  const pendienteCobro = salesOps
    .filter(
      (op) =>
        op.estado === 'Pendiente de cobro' ||
        op.estado === 'En producción' ||
        op.estado === 'Enviado'
    )
    .reduce((acc, op) => acc + (op.precio || 0), 0);

  // Breakdown by Platform (for sales)
  const platformMap = new Map<
    string,
    { count: number; ingresos: number; beneficio: number }
  >();
  salesOps.forEach((op) => {
    const key = op.lugarVenta || 'Otro';
    const curr = platformMap.get(key) || { count: 0, ingresos: 0, beneficio: 0 };
    curr.count += 1;
    curr.ingresos += op.precio || 0;
    curr.beneficio += op.beneficio || 0;
    platformMap.set(key, curr);
  });

  // Breakdown by Seller (for sales)
  const sellerMap = new Map<
    string,
    { count: number; ingresos: number; beneficio: number }
  >();
  salesOps.forEach((op) => {
    const key = (op.vendedor || 'Sin asignar').trim();
    const curr = sellerMap.get(key) || { count: 0, ingresos: 0, beneficio: 0 };
    curr.count += 1;
    curr.ingresos += op.precio || 0;
    curr.beneficio += op.beneficio || 0;
    sellerMap.set(key, curr);
  });

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // 1. Top Header Banner
  doc.setFillColor(12, 12, 16);
  doc.rect(0, 0, pageWidth, 34, 'F');
  doc.setFillColor(16, 185, 129);
  doc.rect(0, 33, pageWidth, 1.2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('FORMARE 3D', margin, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(16, 185, 129);
  doc.text('RESUMEN MENSUAL DE VENTAS Y BENEFICIOS', margin, 20.5);

  doc.setTextColor(180, 180, 190);
  doc.setFontSize(8.5);
  doc.text(
    `Periodo: ${monthLabel}   |   Generado el ${formatDateDisplay(now.toISOString().slice(0, 10))}`,
    margin,
    27
  );

  // Right badge in header
  doc.setFillColor(24, 24, 30);
  doc.roundedRect(pageWidth - margin - 52, 9, 52, 18, 3, 3, 'F');
  doc.setFontSize(7.5);
  doc.setTextColor(160, 160, 170);
  doc.text('BENEFICIO EN VENTAS', pageWidth - margin - 26, 14.5, {
    align: 'center',
  });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(16, 185, 129);
  doc.text(
    `${beneficioVentas >= 0 ? '+' : ''}${formatEuro(beneficioVentas)}`,
    pageWidth - margin - 26,
    22,
    { align: 'center' }
  );

  let y = 42;

  // 2. Four KPI Summary Cards
  const cardGap = 3.5;
  const cardWidth = (contentWidth - cardGap * 3) / 4;
  const cardHeight = 22;

  const kpiCards = [
    {
      title: 'INGRESOS VENTAS',
      value: formatEuro(ingresosBrutos),
      sub: `${numVentas} ventas (${totalUnidadesVendidas} uds.)`,
      color: [15, 23, 42] as [number, number, number],
      accent: [30, 41, 59] as [number, number, number],
    },
    {
      title: 'COSTES FILAMENTO',
      value: formatEuro(costesVentas),
      sub: `~${gramosConsumidos} g consumidos`,
      color: [71, 85, 105] as [number, number, number],
      accent: [100, 116, 139] as [number, number, number],
    },
    {
      title: 'BENEFICIO VENTAS',
      value: `${beneficioVentas >= 0 ? '+' : ''}${formatEuro(beneficioVentas)}`,
      sub:
        ingresosBrutos > 0
          ? `Margen: ${Math.round((beneficioVentas / ingresosBrutos) * 100)}%`
          : 'Margen: 0%',
      color: [5, 150, 105] as [number, number, number],
      accent: [16, 185, 129] as [number, number, number],
    },
    {
      title: 'BALANCE NETO MES',
      value: `${balanceNetoTotal >= 0 ? '+' : ''}${formatEuro(balanceNetoTotal)}`,
      sub: `Compras: ${formatEuro(gastosCompras)} (${purchaseOps.length})`,
      color:
        balanceNetoTotal >= 0
          ? ([5, 150, 105] as [number, number, number])
          : ([225, 29, 72] as [number, number, number]),
      accent: [148, 163, 184] as [number, number, number],
    },
  ];

  kpiCards.forEach((card, idx) => {
    const x = margin + idx * (cardWidth + cardGap);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, y, cardWidth, cardHeight, 2.5, 2.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text(card.title, x + 3.5, y + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(card.color[0], card.color[1], card.color[2]);
    doc.text(card.value, x + 3.5, y + 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text(card.sub, x + 3.5, y + 18.8);
  });

  y += cardHeight + 6;

  // 3. Secondary Breakdown Boxes: Por Plataforma & Por Vendedor
  const boxWidth = (contentWidth - 4) / 2;
  const platformsArr = Array.from(platformMap.entries()).sort(
    (a, b) => b[1].beneficio - a[1].beneficio
  );
  const sellersArr = Array.from(sellerMap.entries()).sort(
    (a, b) => b[1].beneficio - a[1].beneficio
  );
  const maxRowsBreakdown = Math.max(platformsArr.length, sellersArr.length, 1);
  const boxHeight = 10 + maxRowsBreakdown * 5.2 + 3;

  // Left box: Plataformas
  doc.setFillColor(252, 252, 253);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, boxWidth, boxHeight, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text('VENTAS POR PLATAFORMA', margin + 3.5, y + 5.8);

  if (platformsArr.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Sin ventas registradas en este mes', margin + 3.5, y + 12);
  } else {
    platformsArr.forEach(([plat, info], idx) => {
      const rowY = y + 11.5 + idx * 5.2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
      doc.text(`${plat} (${info.count})`, margin + 3.5, rowY);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(
        `Bruto: ${formatEuro(info.ingresos)}  |  Beneficio: +${formatEuro(info.beneficio)}`,
        margin + boxWidth - 3.5,
        rowY,
        { align: 'right' }
      );
    });
  }

  // Right box: Vendedores
  const rightBoxX = margin + boxWidth + 4;
  doc.setFillColor(252, 252, 253);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(rightBoxX, y, boxWidth, boxHeight, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text(
    `VENTAS POR VENDEDOR  (Pend. cobro: ${formatEuro(pendienteCobro)})`,
    rightBoxX + 3.5,
    y + 5.8
  );

  if (sellersArr.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Sin ventas registradas en este mes', rightBoxX + 3.5, y + 12);
  } else {
    sellersArr.forEach(([seller, info], idx) => {
      const rowY = y + 11.5 + idx * 5.2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
      doc.text(`${seller} (${info.count})`, rightBoxX + 3.5, rowY);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(
        `Bruto: ${formatEuro(info.ingresos)}  |  Beneficio: +${formatEuro(info.beneficio)}`,
        rightBoxX + boxWidth - 3.5,
        rowY,
        { align: 'right' }
      );
    });
  }

  y += boxHeight + 7;

  // 4. Detailed Operations Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `Detalle de Operaciones de ${monthLabel} (${monthOps.length} registros)`,
    margin,
    y
  );
  y += 3.5;

  const drawTableHeader = (topY: number) => {
    doc.setFillColor(15, 23, 42);
    doc.rect(margin, topY, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(255, 255, 255);

    doc.text('FECHA', margin + 2, topY + 4.7);
    doc.text('TIPO', margin + 19, topY + 4.7);
    doc.text('PRODUCTO', margin + 35, topY + 4.7);
    doc.text('UDS', margin + 96, topY + 4.7, { align: 'center' });
    doc.text('LUGAR', margin + 103, topY + 4.7);
    doc.text('ESTADO', margin + 122, topY + 4.7);
    doc.text('VENDEDOR', margin + 145, topY + 4.7);
    doc.text('PRECIO', margin + 166, topY + 4.7, { align: 'right' });
    doc.text('BENEFICIO', margin + contentWidth - 2, topY + 4.7, {
      align: 'right',
    });
    return topY + 7;
  };

  y = drawTableHeader(y);

  if (monthOps.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'No hay operaciones registradas en este mes.',
      margin + contentWidth / 2,
      y + 10,
      { align: 'center' }
    );
  } else {
    monthOps.forEach((op, index) => {
      const rowHeight = 6.4;
      if (y + rowHeight > pageHeight - 16) {
        doc.addPage();
        y = 16;
        y = drawTableHeader(y);
      }

      if (index % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, contentWidth, rowHeight, 'F');
      }

      doc.setDrawColor(235, 238, 245);
      doc.line(margin, y + rowHeight, margin + contentWidth, y + rowHeight);

      const isCompra = op.tipo === 'compra' || op.tipo === 'inversion';
      const textY = y + 4.4;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(71, 85, 105);
      doc.text(formatDateDisplay(op.fecha), margin + 2, textY);

      doc.setFont('helvetica', 'bold');
      if (isCompra) {
        doc.setTextColor(225, 29, 72);
        doc.text(op.tipo === 'inversion' ? 'Inversión' : 'Compra', margin + 19, textY);
      } else {
        doc.setTextColor(5, 150, 105);
        doc.text('Venta', margin + 19, textY);
      }

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      const prodTrunc =
        op.producto.length > 34
          ? op.producto.slice(0, 33) + '…'
          : op.producto;
      doc.text(prodTrunc, margin + 35, textY);

      doc.setTextColor(51, 65, 85);
      doc.text(String(op.unidades || 1), margin + 96, textY, {
        align: 'center',
      });
      doc.text((op.lugarVenta || '—').slice(0, 11), margin + 103, textY);
      doc.text((op.estado || '—').slice(0, 13), margin + 122, textY);
      doc.text((op.vendedor || '—').slice(0, 11), margin + 145, textY);

      doc.text(
        op.precio !== null ? formatEuro(op.precio) : `-${formatEuro(op.costes)}`,
        margin + 166,
        textY,
        { align: 'right' }
      );

      doc.setFont('helvetica', 'bold');
      if (op.beneficio > 0) {
        doc.setTextColor(5, 150, 105);
      } else if (op.beneficio < 0) {
        doc.setTextColor(225, 29, 72);
      } else {
        doc.setTextColor(100, 116, 139);
      }
      doc.text(
        `${op.beneficio > 0 ? '+' : ''}${formatEuro(op.beneficio)}`,
        margin + contentWidth - 2,
        textY,
        { align: 'right' }
      );

      y += rowHeight;
    });
  }

  // Page Footers
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Formare 3D · Resumen de Ventas y Beneficios (${monthLabel})`,
      margin,
      pageHeight - 7
    );
    doc.text(
      `Página ${p} de ${totalPages}`,
      pageWidth - margin,
      pageHeight - 7,
      { align: 'right' }
    );
  }

  doc.save(`formare-3d-resumen-${targetMonthKey}.pdf`);
  return { monthLabel, count: monthOps.length };
}
