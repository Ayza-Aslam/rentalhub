"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { socket } from "@/lib/socket";
import { startConversation } from "@/lib/api";
import styles from "./listing.module.css";

type Message = {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
};

export default function ChatBox({ listingId, hostId }: { listingId: string; hostId: string }) {
  const { data: session } = useSession();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const isOwnListing = session?.user?.id === hostId;

  useEffect(() => {
    if (!session || isOwnListing) return;

    startConversation(listingId, session.user.apiToken).then((data) => {
      setConversationId(data.conversation.id);
      setMessages(data.messages);
      socket.emit("join-conversation", data.conversation.id);
    });
  }, [session, listingId, isOwnListing]);

  useEffect(() => {
    function handleNewMessage(message: Message) {
      setMessages((prev) => [...prev, message]);
    }

    socket.on("new-message", handleNewMessage);
    return () => {
      socket.off("new-message", handleNewMessage);
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    if (!text.trim() || !conversationId) return;
    socket.emit("send-message", { conversationId, content: text });
    setText("");
  }

  if (!session) return null;
  if (isOwnListing) return null;

  return (
    <div className={styles.chatBox}>
      <h3 className={styles.chatHeading}>Message the host</h3>
      <div className={styles.chatMessages}>
        {messages.map((m) => (
          <div
            key={m.id}
            className={
              m.senderId === session.user.id ? styles.chatMessageMine : styles.chatMessageTheirs
            }
          >
            {m.content}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className={styles.chatInputRow}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type a message..."
          className={styles.chatInput}
        />
        <button onClick={handleSend} className={styles.chatSendButton}>
          Send
        </button>
      </div>
    </div>
  );
}