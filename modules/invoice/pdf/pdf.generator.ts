import puppeteer from 'puppeteer';
import { invoiceTemplate } from './invoice.template';

export async function generatePdfBuffer(data: any): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true, // FIXED
  });

  const page = await browser.newPage();

  const html = invoiceTemplate(data);

  await page.setContent(html, {
    waitUntil: 'domcontentloaded', // FIXED
  });

  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
  });

  await browser.close();

  return Buffer.from(pdf);
}