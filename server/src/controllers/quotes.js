import * as quotesService from '../services/quotes.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function context(req) {
  return { user: req.user, ip: req.ip };
}

export const listQuotes = asyncHandler(async (req, res) => {
  const { data, total } = await quotesService.listQuotes(req.query, context(req));

  res.json({
    data,
    meta: {
      page: req.query.page ?? 1,
      limit: req.query.limit ?? 20,
      total,
    },
  });
});

export const getQuote = asyncHandler(async (req, res) => {
  const quote = await quotesService.getQuote(req.params.id, context(req));

  res.json({ data: quote });
});

export const createQuote = asyncHandler(async (req, res) => {
  const quote = await quotesService.createQuote(req.body, context(req));

  res.status(201).json({ data: quote });
});

export const updateQuote = asyncHandler(async (req, res) => {
  const quote = await quotesService.updateQuote(req.params.id, req.body, context(req));

  res.status(200).json({ data: quote });
});

export const deleteQuote = asyncHandler(async (req, res) => {
  await quotesService.deleteQuote(req.params.id, context(req));

  res.status(204).end();
});

export const markQuoteAsSent = asyncHandler(async (req, res) => {
  const quote = await quotesService.markQuoteAsSent(req.params.id, context(req));

  res.status(200).json({ data: quote });
});

export const changeQuoteStatus = asyncHandler(async (req, res) => {
  const quote = await quotesService.changeQuoteStatus(req.params.id, req.body, context(req));

  res.status(200).json({ data: quote });
});

export const getQuotePdf = asyncHandler(async (req, res) => {
  const { quote, doc } = await quotesService.getQuotePdf(req.params.id, context(req));
  const filename = `${quote.number ?? 'devis-brouillon'}.pdf`;

  doc.on('error', () => res.destroy());
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  doc.pipe(res);
  doc.end();
});
