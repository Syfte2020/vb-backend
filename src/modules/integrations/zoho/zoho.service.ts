import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class ZohoService {

  // In-memory token cache. Zoho access tokens are valid for ~3600s — without
  // this, every single method below (createBooking, findCustomerByEmail,
  // getItemById, recordPayment, createInvoice, ...) independently called
  // getAccessToken(), which re-hits Zoho's /oauth/v2/token refresh endpoint
  // on every call. completeBookingZoho alone fires 8+ of these back-to-back,
  // which trips Zoho's rate limiter ("You have made too many requests
  // continuously"). Caching the token — and refreshing only once it's
  // actually close to expiring — fixes that everywhere, not just here.
  private cachedToken: string | null = null;
  private cachedTokenExpiresAt = 0; // epoch ms
private tokenExpiry = 0;

  //==========================================
  // GET ACCESS TOKEN (OAuth code exchange)
  //==========================================

  async generateToken(code: string) {

    const response = await axios.post(
      `${process.env.ZOHO_ACCOUNTS_URL}/oauth/v2/token`,
      null,
      {
        params: {
          grant_type: 'authorization_code',
          client_id: process.env.ZOHO_CLIENT_ID,
          client_secret: process.env.ZOHO_CLIENT_SECRET,
          redirect_uri: process.env.ZOHO_REDIRECT_URI,
          code,
        },
      },
    );

    return response.data;
  }

  //==========================================
  // GET ACCESS TOKEN (refresh, cached)
  // Reuses the cached token until it's within 60s of expiring, instead of
  // hitting Zoho's OAuth server on every single call.
  //==========================================


async getAccessToken(): Promise<string> {
  const now = Date.now();

  if (this.cachedToken && now < this.tokenExpiry) {
    return this.cachedToken!;
  }

  const response = await axios.post(
    'https://accounts.zoho.in/oauth/v2/token',
    null,
    {
      params: {
        refresh_token: process.env.ZOHO_REFRESH_TOKEN,
        client_id: process.env.ZOHO_CLIENT_ID,
        client_secret: process.env.ZOHO_CLIENT_SECRET,
        grant_type: 'refresh_token',
      },
    },
  );

  this.cachedToken = response.data.access_token;
  this.tokenExpiry =
    now + (response.data.expires_in - 60) * 1000;

  return this.cachedToken!;
}

  //==========================================
  // CREATE CUSTOMER
  //==========================================

  async createCustomer(body: any, token?: string) {

    const accessToken = token ?? await this.getAccessToken();

    const response = await axios.post(
      `${process.env.ZOHO_API_URL}/books/v3/contacts`,
      {
        contact_name: body.customerName,
        company_name: body.companyName,
        contact_type: "customer",
        email: body.email,
        phone: body.phone,
        mobile: body.mobile,
      },
      {
        params: {
          organization_id: process.env.ZOHO_BOOKS_ORGANIZATION_ID,
        },
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    return response.data;
  }

  //==========================================
  // GET CUSTOMERS (list all)
  //==========================================

  async getCustomers(token?: string) {

    const accessToken = token ?? await this.getAccessToken();

    const response = await axios.get(
      `${process.env.ZOHO_API_URL}/books/v3/contacts`,
      {
        params: {
          organization_id: process.env.ZOHO_BOOKS_ORGANIZATION_ID,
        },
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
        },
      },
    );

    return response.data;
  }

  //==========================================
  // FIND CUSTOMER BY EMAIL
  //==========================================

  async findCustomerByEmail(email: string, token?: string) {

    const accessToken = token ?? await this.getAccessToken();

    const response = await axios.get(
      `${process.env.ZOHO_API_URL}/books/v3/contacts`,
      {
        params: {
          organization_id: process.env.ZOHO_BOOKS_ORGANIZATION_ID,
          email,
        },
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
        },
      },
    );

    const contacts = response.data?.contacts || [];
    return contacts.length > 0 ? contacts[0] : null;
  }

  //==========================================
  // CREATE ITEM
  //==========================================

  async createItem(body: any, token?: string) {

    const accessToken = token ?? await this.getAccessToken();

    const response = await axios.post(

      `${process.env.ZOHO_API_URL}/books/v3/items`,

      {
        name: body.name,
        rate: body.rate,
        description: body.description,
        product_type: "service"
      },

      {

        params: {
          organization_id: process.env.ZOHO_BOOKS_ORGANIZATION_ID
        },

        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
          "Content-Type": "application/json"
        }

      }

    );

    return response.data;

  }

  //==========================================
  // GET ITEMS (list all)
  //==========================================

  async getItems(token?: string) {

    const accessToken = token ?? await this.getAccessToken();

    const response = await axios.get(

      `${process.env.ZOHO_API_URL}/books/v3/items`,

      {

        params: {
          organization_id: process.env.ZOHO_BOOKS_ORGANIZATION_ID
        },

        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`
        }

      }

    );

    return response.data;

  }

  //==========================================
  // GET ITEM BY ID
  //==========================================

  async getItemById(itemId: string, token?: string) {

    const accessToken = token ?? await this.getAccessToken();

    try {
      const response = await axios.get(
        `${process.env.ZOHO_API_URL}/books/v3/items/${itemId}`,
        {
          params: {
            organization_id: process.env.ZOHO_BOOKS_ORGANIZATION_ID,
          },
          headers: {
            Authorization: `Zoho-oauthtoken ${accessToken}`,
          },
        },
      );

      return response.data?.item || null;
    } catch (err) {
      //if (err.response?.status === 404) return null;
      throw err;
    }
  }

  //==========================================
  // CREATE BOOKING (SALES ORDER)
  // Supports either:
  //   - body.items: [{ itemId, quantity, rate }, ...]  (multi-item)
  //   - body.itemId/body.quantity/body.rate             (single-item, legacy)
  //==========================================

  async createBooking(body: any, token?: string) {

    const accessToken = token ?? await this.getAccessToken();

    const lineItems = Array.isArray(body.items) && body.items.length > 0
      ? body.items.map((item: any) => ({
          item_id: item.itemId,
          quantity: item.quantity,
          rate: item.rate,
        }))
      : [
          {
            item_id: body.itemId,
            quantity: body.quantity,
            rate: body.rate,
          },
        ];

    const response = await axios.post(

      `${process.env.ZOHO_API_URL}/books/v3/salesorders`,

      {
        customer_id: body.customerId,

        date: body.bookingDate,

        reference_number: body.bookingNo,

        notes: body.notes,

        line_items: lineItems,
      },

      {
        params: {
          organization_id: process.env.ZOHO_BOOKS_ORGANIZATION_ID,
        },
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    return response.data;
  }

  //==========================================
  // GET BOOKINGS (SALES ORDERS)
  //==========================================

  async getBookings(token?: string) {

    const accessToken = token ?? await this.getAccessToken();

    const response = await axios.get(

      `${process.env.ZOHO_API_URL}/books/v3/salesorders`,

      {
        params: {
          organization_id: process.env.ZOHO_BOOKS_ORGANIZATION_ID,
        },
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
        },
      },
    );

    return response.data;
  }

  //==========================================
  // GET BOOKING BY ID
  //==========================================

  async getBooking(id: string, token?: string) {

    const accessToken = token ?? await this.getAccessToken();

    const response = await axios.get(

      `${process.env.ZOHO_API_URL}/books/v3/salesorders/${id}`,

      {
        params: {
          organization_id: process.env.ZOHO_BOOKS_ORGANIZATION_ID,
        },
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
        },
      },
    );

    return response.data;
  }

  //==========================================
  // UPDATE BOOKING STATUS
  //==========================================

  async updateBookingStatus(salesorderId: string, status: string, token?: string) {

    const accessToken = token ?? await this.getAccessToken();

    const response = await axios.post(

      `${process.env.ZOHO_API_URL}/books/v3/salesorders/${salesorderId}/status/${status.toLowerCase()}`,

      null,

      {
        params: {
          organization_id: process.env.ZOHO_BOOKS_ORGANIZATION_ID,
        },
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
        },
      },
    );

    return response.data;
  }

  //==========================================
  // CREATE INVOICE
  // Supports either:
  //   - body.lineItems: [{ itemId, quantity, rate }, ...]  (multi-item)
  //   - body.itemId/body.quantity/body.rate                (single-item, legacy)
  //==========================================

  async createInvoice(body: any, token?: string) {

    const accessToken = token ?? await this.getAccessToken();

    const lineItems = Array.isArray(body.lineItems) && body.lineItems.length > 0
      ? body.lineItems.map((item: any) => ({
          item_id: item.itemId,
          quantity: item.quantity,
          rate: item.rate,
        }))
      : [
          {
            item_id: body.itemId,
            quantity: body.quantity,
            rate: body.rate,
          },
        ];

    const response = await axios.post(

      `${process.env.ZOHO_API_URL}/books/v3/invoices`,

      {
        customer_id: body.customerId,

        reference_number: body.invoiceNumber || body.bookingNo,

        line_items: lineItems,

        notes: body.notes,
      },

      {
        params: {
          organization_id: process.env.ZOHO_BOOKS_ORGANIZATION_ID,
        },
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    return response.data;
  }

  //==========================================
  // GET INVOICES
  //==========================================

  async getInvoices(token?: string) {

    const accessToken = token ?? await this.getAccessToken();

    const response = await axios.get(

      `${process.env.ZOHO_API_URL}/books/v3/invoices`,

      {
        params: {
          organization_id: process.env.ZOHO_BOOKS_ORGANIZATION_ID,
        },
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
        },
      },
    );

    return response.data;
  }

  //==========================================
  // CLOSE / FINALIZE INVOICE
  //==========================================

  async closeInvoice(invoiceId: string, token?: string) {

    const accessToken = token ?? await this.getAccessToken();

    const response = await axios.post(

      `${process.env.ZOHO_API_URL}/books/v3/invoices/${invoiceId}/status/sent`,

      null,

      {
        params: {
          organization_id: process.env.ZOHO_BOOKS_ORGANIZATION_ID,
        },
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
        },
      },
    );

    return response.data;
  }

  //==========================================
  // SEND INVOICE EMAIL
  //==========================================

  async sendInvoiceEmail(body: { email: string; invoiceId: string }, token?: string) {

    const accessToken = token ?? await this.getAccessToken();

    const response = await axios.post(

      `${process.env.ZOHO_API_URL}/books/v3/invoices/${body.invoiceId}/email`,

      {
        to_mail_ids: [body.email],
      },

      {
        params: {
          organization_id: process.env.ZOHO_BOOKS_ORGANIZATION_ID,
        },
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    return response.data;
  }

  //==========================================
  // RECORD PAYMENT
  //==========================================

  // async recordPayment(body: any, token?: string) {

  //   const accessToken = token ?? await this.getAccessToken();

  //   const response = await axios.post(

  //     `${process.env.ZOHO_API_URL}/books/v3/customerpayments`,

  //     {
  //       customer_id: body.customerId,

  //       payment_mode: body.paymentMode,

  //       amount: body.amount,

  //       date: body.paymentDate,

  //       reference_number: body.referenceNo || body.reference,

  //       invoices: body.invoiceId
  //         ? [
  //             {
  //               invoice_id: body.invoiceId,
  //               amount_applied: body.amount,
  //             },
  //           ]
  //         : undefined,
  //     },

  //     {
  //       params: {
  //         organization_id: process.env.ZOHO_BOOKS_ORGANIZATION_ID,
  //       },
  //       headers: {
  //         Authorization: `Zoho-oauthtoken ${accessToken}`,
  //       },
  //     },
  //   );

  //   return response.data;
  // }
  //==========================================
// RECORD PAYMENT
//==========================================

async recordPayment(body: any, token?: string) {

  const accessToken = token ?? await this.getAccessToken();

  const paymentData: any = {
    customer_id: body.customerId,

    payment_mode: body.paymentMode,

    amount: body.amount,

    date: body.paymentDate,

    reference_number:
      body.referenceNo || body.reference,

    description:
      body.description ||
      'Razorpay Subscription Payment',
  };

  // Apply payment directly to invoice
  if (body.invoiceId) {
    paymentData.invoices = [
      {
        invoice_id: body.invoiceId,
        amount_applied: body.amount,
      },
    ];
  }

  const response = await axios.post(

    `${process.env.ZOHO_API_URL}/books/v3/customerpayments`,

    paymentData,

    {
      params: {
        organization_id:
          process.env.ZOHO_BOOKS_ORGANIZATION_ID,
      },

      headers: {
        Authorization:
          `Zoho-oauthtoken ${accessToken}`,

        "Content-Type":
          "application/json",
      },
    },
  );

  return response.data;
}

  //==========================================
  // GET PAYMENTS
  //==========================================

  async getPayments(token?: string) {

    const accessToken = token ?? await this.getAccessToken();

    const response = await axios.get(

      `${process.env.ZOHO_API_URL}/books/v3/customerpayments`,

      {
        params: {
          organization_id: process.env.ZOHO_BOOKS_ORGANIZATION_ID,
        },
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
        },
      },
    );

    return response.data;
  }

  


  //==========================================
  // ALL-IN-ONE: complete a booking end-to-end
  //
  // Fetches the access token ONCE up front and passes it explicitly into
  // every downstream call — this is the actual fix for the Zoho rate-limit
  // error, since previously every single step (findCustomerByEmail,
  // getItemById x N, createBooking, updateBookingStatus, recordPayment,
  // createInvoice, closeInvoice, sendInvoiceEmail) independently called
  // getAccessToken() and hit Zoho's OAuth refresh endpoint 8+ times back
  // to back. Combined with the token cache in getAccessToken() above, this
  // also means later calls to completeBookingZoho (or any other method)
  // reuse the same cached token until it's actually close to expiring.
  //==========================================

  // async completeBookingZoho(data: any) {

  //   const token = await this.getAccessToken();

  //   const {
  //     customer,
  //     items,
  //     booking,
  //     payment
  //   } = data;


  //   // 1. Check Customer
  //   const existingCustomer = await this.findCustomerByEmail(customer.email, token);
  //   let customerId = existingCustomer?.contact_id;


  //   // 2. Create Customer if not exists
  //   if (!customerId) {

  //     const newCustomer = await this.createCustomer({
  //       customerName: customer.name,
  //       email: customer.email,
  //       phone: customer.phone
  //     }, token);

  //     customerId = newCustomer.contact?.contact_id;
  //   }



  //   // 3. Prepare Items
  //   const lineItems: { itemId: string; quantity: number; rate: number }[] = [];

  //   for (const item of items) {

  //     const zohoItem = await this.getItemById(item.itemId, token);

  //     if (!zohoItem) {
  //       throw new Error(
  //         `Item not found ${item.itemId}`
  //       );
  //     }


  //     lineItems.push({
  //       itemId: item.itemId,
  //       quantity: item.quantity,
  //       rate: item.rate
  //     });

  //   }



  //   // 4. Create Booking
  //   const bookingResult =
  //     await this.createBooking({
  //       customerId,
  //       bookingNo: booking.bookingNo,
  //       bookingDate: booking.bookingDate,
  //       notes: booking.notes,
  //       items: lineItems
  //     }, token);



  //   const bookingId =
  //     bookingResult.salesorder?.salesorder_id;



  //   // 5. Update Booking Status

  //   await this.updateBookingStatus(
  //     bookingId,
  //     "confirmed",
  //     token
  //   );



  //   // 6. Record Payment

  //   const paymentResult =
  //     await this.recordPayment({

  //       customerId,

  //       amount: payment.amount,

  //       paymentMode:
  //         payment.mode,

  //       paymentDate:
  //         payment.date,

  //       referenceNo:
  //         bookingId
  //     }, token);



  //   // 7. Generate Invoice

  //   const invoice =
  //     await this.createInvoice({

  //       customerId,

  //       invoiceNumber:
  //         `INV-${booking.bookingNo}`,

  //       lineItems

  //     }, token);



  //   const invoiceId =
  //     invoice.invoice?.invoice_id;



  //   // 8. Close Invoice

  //   await this.closeInvoice(
  //     invoiceId,
  //     token
  //   );



  //   // 9. Send Email

  //   await this.sendInvoiceEmail({

  //     email: customer.email,

  //     invoiceId

  //   }, token);



  //   return {

  //     status: true,

  //     customerId,

  //     bookingId,

  //     invoiceId,

  //     paymentId:
  //       paymentResult.payment?.payment_id

  //   };

  // }

  //==========================================
// ALL-IN-ONE: complete a booking end-to-end
//==========================================

async completeBookingZoho(data: any) {

  const token = await this.getAccessToken();

  const {
    customer,
    items,
    booking,
    payment
  } = data;


  // ==========================================
  // 1. CHECK CUSTOMER
  // ==========================================

  const existingCustomer =
    await this.findCustomerByEmail(
      customer.email,
      token
    );

  let customerId =
    existingCustomer?.contact_id;


  // ==========================================
  // 2. CREATE CUSTOMER IF NOT EXISTS
  // ==========================================

  if (!customerId) {

    const newCustomer =
      await this.createCustomer(
        {
          customerName: customer.name,
          email: customer.email,
          phone: customer.phone
        },
        token
      );

    customerId =
      newCustomer?.contact?.contact_id;

    if (!customerId) {
      throw new Error(
        `Customer creation failed: ${JSON.stringify(
          newCustomer
        )}`
      );
    }
  }


  // ==========================================
  // 3. PREPARE ITEMS
  // ==========================================

  const lineItems:
    {
      itemId: string;
      quantity: number;
      rate: number;
    }[] = [];


  for (const item of items) {

    const zohoItem =
      await this.getItemById(
        item.itemId,
        token
      );

    if (!zohoItem) {
      throw new Error(
        `Item not found ${item.itemId}`
      );
    }

    lineItems.push({
      itemId: item.itemId,
      quantity: item.quantity,
      rate: item.rate
    });
  }


  // ==========================================
  // 4. CREATE BOOKING / SALES ORDER
  // ==========================================

  const bookingResult =
    await this.createBooking(
      {
        customerId,

        bookingNo:
          booking.bookingNo,

        bookingDate:
          booking.bookingDate,

        notes:
          booking.notes,

        items:
          lineItems
      },
      token
    );


  const bookingId =
    bookingResult?.salesorder?.salesorder_id;


  if (!bookingId) {
    throw new Error(
      `Sales Order creation failed: ${JSON.stringify(
        bookingResult
      )}`
    );
  }


  // ==========================================
  // 5. UPDATE BOOKING STATUS
  // ==========================================

  await this.updateBookingStatus(
    bookingId,
    "confirmed",
    token
  );


  // ==========================================
  // 6. CREATE INVOICE FIRST
  // ==========================================

  const invoice =
    await this.createInvoice(
      {
        customerId,

        invoiceNumber:
          `INV-${booking.bookingNo}`,

        lineItems
      },
      token
    );


  const invoiceId =
    invoice?.invoice?.invoice_id;


  if (!invoiceId) {
    throw new Error(
      `Invoice creation failed: ${JSON.stringify(
        invoice
      )}`
    );
  }


  // ==========================================
  // 7. RECORD PAYMENT AGAINST INVOICE
  // ==========================================

  const paymentResult =
    await this.recordPayment(
      {
        customerId,

        amount:
          payment.amount,

        paymentMode:
          payment.mode,

        paymentDate:
          payment.date,

        referenceNo:
          bookingId,

        // IMPORTANT
        invoiceId,

        description:
          'Razorpay Subscription Payment'
      },
      token
    );


  // ==========================================
  // 8. CLOSE / MARK INVOICE AS SENT
  // ==========================================

  await this.closeInvoice(
    invoiceId,
    token
  );


  // ==========================================
  // 9. SEND INVOICE EMAIL
  // ==========================================

  // await this.sendInvoiceEmail(
  //   {
  //     email:
  //       customer.email,

  //     invoiceId
  //   },
  //   token
  // );


  // ==========================================
  // 10. RETURN
  // ==========================================

  return {

    status: true,

    customerId,

    bookingId,

    invoiceId,

    paymentId:
      paymentResult
        ?.payment
        ?.payment_id

  };

}
}
