import { Injectable,BadRequestException,
  ConflictException, } from '@nestjs/common';
import { DataSource, Repository, Not, IsNull, LessThan } from 'typeorm';
import { StorageService } from 'src/common/storage/storage.service';

import { v4 as uuidv4 } from "uuid";

type UploadFile = {
  id: string;
  buffer: Buffer;
  mimetype: string;
};

@Injectable()


export class ChatService {
  constructor(
    private dataSource: DataSource,
    private storageService: StorageService,
  ) {}

  async startConversations(userId: any, id: any, country: any,body:any) {
   
  }

async startConversation(
  userId: number,
  id: number,
  country: any,
  bookingId: number,
  customerId: number,
) {
  // 1. Check existing conversation
  const existing = await this.dataSource.query(
    `
    SELECT id
    FROM conversations
    WHERE reference_id = ?
      AND category = 'bookings'
      AND created_by = ?
    LIMIT 1
    `,
    [bookingId, customerId],
  );

  if (existing.length) {
    return {
      conversation_id: existing[0].id,
    };
  }

  // Welcome message
  const message = `Welcome to Event Support. Your booking reference is #${bookingId}. Feel free to ask any questions regarding your event.`;

  // 2. Create conversation
  const result: any = await this.dataSource.query(
    `
    INSERT INTO conversations
    (
      category,
      reference_type,
      reference_id,
      created_by,
      last_message,
      last_message_at,
      unread_count
    )
    VALUES
    (
      ?,
      ?,
      ?,
      ?,
      ?,
      NOW(),
      0
    )
    `,
    [
      "bookings",
      "booking",
      bookingId,
      customerId,
      message,
    ],
  );

  const conversationId = result.insertId;

  // 3. Insert system welcome message
  await this.dataSource.query(
    `
    INSERT INTO messages
    (
      conversation_id,
      sender_type,
      sender_id,
      message,
      message_type,
      role,
      is_read,
      sent_at
    )
    VALUES
    (
      ?,
      'system',
      ?,
      ?,
      'text',
      'them',
      1,
      NOW()
    )
    `,
    [
      conversationId,
      userId,
      message,
    ],
  );

  return {
    success: true,
    conversation_id: conversationId,
  };
}



async getConversationMessages(conversationId: number, myUserId: number) {
  const messages = await this.dataSource.query(
    `
    SELECT 
      m.id,
      m.conversation_id,
      m.sender_id,
      m.sender_type,
      m.message,
      m.created_at
    FROM messages m
    LEFT JOIN users u ON u.id = m.sender_id
    WHERE m.conversation_id = ?
    ORDER BY m.created_at ASC
    `,
    [conversationId],
  );

  const formatTime = (date: any) => {
    return date
      ? new Date(date).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";
  };

  return messages.map((msg: any) => {
    let from = "customer";

    // system messages
    if (msg.sender_type === "system") {
      from = "system";
    }

    // my own messages
    else if (msg.sender_id === myUserId) {
      from = "me";
    }

    // vendor/customer detection (optional upgrade)
    else if (msg.role_type === 2) {
      from = "me";
    } else {
      from = "customer";
    }

    return {
      from,
      text: msg.message,
      time: msg.sender_type === "system" ? "" : formatTime(msg.created_at),
    };
  });
}

async send_messages(body:any , id:any) {
await this.dataSource.query(
    `
    INSERT INTO messages
      (conversation_id, sender_type, sender_id, message,role,sent_at)
    VALUES
      (?, 'user', ?, ? ,? , NOW() )
    `,
    [body.conservation_id, id, body.text,'me'],
  );
}

async all_messages(body: any, id: number) {
  // 1. Get conversations
  const conversations = await this.dataSource.query(
    `
    SELECT
    c.id,
    c.category,
    c.subject,
    c.reference_id,
    c.is_pinned,
    c.last_message,
    c.last_message_at,
    c.unread_count,
    c.created_by,

    bp.name AS customer_name,
    bp.phone,
    bp.email

FROM conversations c

LEFT JOIN bookings b
    ON b.id = c.reference_id

LEFT JOIN booking_parties bp
    ON bp.booking_id = b.id
    AND bp.party_type = 'customer'



ORDER BY
    c.is_pinned DESC,
    c.last_message_at DESC;
    `,
  //  [id],
  );
//WHERE c.created_by = ?
  // 2. Get messages
  const messages = await this.dataSource.query(
    `
    SELECT
      id,
      conversation_id,
      sender_type,
      sender_id,
      message,
      role,
      sent_at
    FROM messages
    ORDER BY sent_at ASC
    `,
  );

  // 3. Format response
  const response = conversations.map((conversation: any) => ({
    id: String(conversation.id),
    category: conversation.category,

    contact: {
      name: conversation.customer_name,
      initials: conversation.customer_name
        ? conversation.customer_name
            .split(" ")
            .map((x: string) => x[0])
            .join("")
            .toUpperCase()
        : "--",
      color: "from-violet-500 to-purple-500",
      isOnline: false,
      phone: conversation.phone,
      email: conversation.email,
    },

    venue: conversation.venue_name,

    subject:
      conversation.subject ||
      `Booking #${conversation.reference_id}`,

    lastMessage: conversation.last_message || "",

    time: conversation.last_message_at,

    unread: Number(conversation.unread_count || 0),

    pinned: Boolean(conversation.is_pinned),

    messages: messages
      .filter(
        (m: any) => Number(m.conversation_id) === Number(conversation.id),
      )
      .map((m: any) => ({
        id: String(m.id),
        role: m.role,
        senderType: m.sender_type,
        senderId: m.sender_id,
        text: m.message,
        time: new Date(m.sent_at).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        date: new Date(m.sent_at).toLocaleDateString("en-IN"),
      })),
  }));

  return {
    success: true,
    data: response,
  };
}


// ${booking.refNo}
}