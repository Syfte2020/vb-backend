import { Injectable,BadRequestException,
  ConflictException, } from '@nestjs/common';
import { DataSource, Repository, Not, IsNull, LessThan } from 'typeorm';
import { StorageService } from 'src/common/storage/storage.service';
import { FastifyRequest } from 'fastify';

import { v4 as uuidv4 } from "uuid";

import { SocketService } from '../../socket/socket.service';

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
    private socketService: SocketService,
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
      m.role,
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
      role: msg.role,
      time: msg.sender_type === "system" ? "" : formatTime(msg.created_at),
    };
  });
}

async send_messages(body: any, id: any) {
  const [conversation] = await this.dataSource.query(
    `
    SELECT
      customer_id,
      vendor_id
    FROM conversations
    WHERE id = ?
    `,
    [body.conversationId],
  );

  // Logged-in user = me, other user = them
  const role =
    Number(conversation.customer_id) === Number(id)
      ? 'me'
      : 'them';

  await this.dataSource.query(
    `
    INSERT INTO messages
      (conversation_id, sender_type, sender_id, message, role, sent_at)
    VALUES
      (?, 'user', ?, ?, ?, NOW())
    `,
    [
      body.conversationId,
      id,
      body.message,
      role,
    ],
  );

  const receiverId =
    Number(conversation.customer_id) === Number(id)
      ? conversation.vendor_id
      : conversation.customer_id;

  this.socketService.realtime(
    receiverId.toString(),
    'Message',
    body.message,
  );
}

async all_messages(body: any, id: number) {
  // 1. Get conversations

  const baseUrl = process.env.PUBLIC_AWS_BUCKET_URL?.replace(/\/$/, '');
  
  const conversations = await this.dataSource.query(
  `
  SELECT
    c.id,
    c.category,
    c.subject,
    c.reference_type,
    c.reference_id,
    c.customer_id,
    c.vendor_id,
    c.venue_id,
    c.is_pinned,
    c.created_by,

    b.booking_code,
    b.booking_type,

    bp.name AS customer_name,
    bp.phone,
    bp.email,

    vp.venue_name,
    vc.child_venue_name,

    -- image
    vg.attachment,

    -- Latest message
    lm.message AS last_message,
    lm.sent_at AS last_message_at

  FROM conversations c

  LEFT JOIN bookings b
    ON b.id = c.reference_id

  LEFT JOIN booking_parties bp
    ON bp.booking_id = b.id
    AND bp.party_type = 'customer'

  LEFT JOIN venue_parent vp
    ON vp.parent_venue_id = c.vendor_id


  LEFT JOIN venue_child vc
    ON vc.child_venue_id = c.venue_id


  LEFT JOIN venue_gallery vg
    ON vc.child_venue_id = vg.child_venue_id
    AND vg.image_type = 1

  -- Get latest message for each conversation
  LEFT JOIN messages lm
    ON lm.id = (
      SELECT m2.id
      FROM messages m2
      WHERE m2.conversation_id = c.id
      ORDER BY m2.sent_at DESC, m2.id DESC
      LIMIT 1
    )

  WHERE c.customer_id = ?
     OR c.vendor_id = ?

  ORDER BY
    c.is_pinned DESC,
    lm.sent_at DESC,
    c.id DESC
  `,
  [id, id],
);
  // 2. Get all messages
  const messages = await this.dataSource.query(
    `
    SELECT
      m.id,
      m.conversation_id,
      m.sender_type,
      m.sender_id,
      m.message,
      m.role as message_type,
      m.is_read,
      m.sent_at,

      c.customer_id,
      c.vendor_id

    FROM messages m

    INNER JOIN conversations c
      ON c.id = m.conversation_id

    ORDER BY m.sent_at ASC
    `,
  );

  // 3. Get online status of users
  const userIds = new Set<number>();

  conversations.forEach((c: any) => {
    if (c.customer_id) userIds.add(Number(c.customer_id));
    if (c.vendor_id) userIds.add(Number(c.vendor_id));
  });

  let onlineUsers: any[] = [];

  if (userIds.size > 0) {
    onlineUsers = await this.dataSource.query(
      `
      SELECT
        id,
        is_online
      FROM users
      WHERE id IN (?)
      `,
      [Array.from(userIds)],
    );
  }

  const onlineMap = new Map(
    onlineUsers.map((u: any) => [
      Number(u.id),
      Boolean(u.is_online),
    ]),
  );

  // 4. Format response
  const response = conversations.map((conversation: any) => {
    const conversationMessages = messages.filter(
      (m: any) =>
        Number(m.conversation_id) === Number(conversation.id),
    );

    // Latest message
    const lastMessage =
      conversationMessages.length > 0
        ? conversationMessages[conversationMessages.length - 1]
        : null;

    // Unread messages
    // Only count messages received by logged-in user
    const unreadCount = conversationMessages.filter(
      (m: any) =>
        Number(m.is_read) === 0 &&
        Number(m.sender_id) !== Number(id),
    ).length;

    // Other person in conversation
    const otherUserId =
      Number(conversation.customer_id) === Number(id)
        ? Number(conversation.vendor_id)
        : Number(conversation.customer_id);

    return {
      id: String(conversation.id),

      category: conversation.category,

      customerId: conversation.customer_id,

      vendorId: conversation.vendor_id,
      attachment: `${baseUrl}/${conversation.attachment}`,
      // attach_logo: `${baseUrl}/${conversation.logo}`,

      contact: {
        name: conversation.customer_name,

        initials: conversation.customer_name
          ? conversation.customer_name
              .split(' ')
              .map((x: string) => x[0])
              .join('')
              .toUpperCase()
          : '--',

        color: 'from-violet-500 to-purple-500',

        // Other user online status
        isOnline: onlineMap.get(otherUserId) || false,

        phone: conversation.phone,
        email: conversation.email,
      },

      venue: conversation.child_venue_name,

      booking_type: conversation.booking_type,

      subject: `Booking #${conversation.booking_code}`,

      booking_code: conversation.booking_code,

      // Latest message from messages table
      lastMessage: lastMessage?.message || '',

      // Latest message time
      time: lastMessage?.sent_at || null,

      // Unread messages from messages table
      unread: unreadCount,

      pinned: Boolean(conversation.is_pinned),

      messages: conversationMessages.map((m: any) => ({
        id: String(m.id),

        senderId: m.sender_id,

        senderType: m.sender_type,

        receiverId:
          Number(m.sender_id) === Number(conversation.customer_id)
            ? conversation.vendor_id
            : conversation.customer_id,

        receiverType:
          Number(m.sender_id) === Number(conversation.customer_id)
            ? 'vendor'
            : 'customer',

        role:
          m.sender_type === 'system'
            ? 'system'
            : m.message_type,
            // Number(m.sender_id) === Number(id)
            //   ? 'me'
            //   : 'them',

        text: m.message,

        isRead: Boolean(m.is_read),

        time: new Date(m.sent_at).toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
        }),

        date: new Date(m.sent_at).toLocaleDateString('en-IN'),
      })),
    };
  });

  return {
    success: true,
    data: response,
  };
}

async message_read(conversationId: number, userId: number) {
  try {
    // Verify that the user belongs to this conversation
    const [conversation] = await this.dataSource.query(
      `
        SELECT id, customer_id, vendor_id
        FROM conversations
        WHERE id = ?
        LIMIT 1
      `,
      [conversationId],
    );

    if (!conversation) {
      return {
        success: false,
        message: 'Conversation not found',
      };
    }

    if (
      Number(conversation.customer_id) !== Number(userId) &&
      Number(conversation.vendor_id) !== Number(userId)
    ) {
      return {
        success: false,
        message: 'Unauthorized access to conversation',
      };
    }

    // Mark unread messages as read
    const result = await this.dataSource.query(
      `
        UPDATE messages
        SET is_read = 1,
            read_at = NOW()
        WHERE conversation_id = ?
          AND sender_id != ?
          AND is_read = 0
      `,
      [conversationId, userId],
    );

    return {
      success: true,
      message: 'Messages marked as read',
      affected: result.affectedRows ?? 0,
    };
  } catch (error) {
    console.error('message_read error:', error);

    return {
      success: false,
      message: 'Failed to mark messages as read',
    };
  }
}


// ${booking.refNo}
}