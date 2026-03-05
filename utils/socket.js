import { io } from 'socket.io-client';

const SOCKET_URL = "https://cab-booking-be-j9w5.onrender.com";

class SocketService {
  constructor() {
    this.socket = null;
    this.eventListeners = new Map();
  }

  initializeConnection(socketPayload) {
    if (this.socket?.connected) {
      console.warn('⚠️ Socket already connected!');
      return;
    }

    console.log('🔗 Initializing socket with payload:', socketPayload);

    this.socket = io(SOCKET_URL, {
      transports: ['websocket'],
      query: socketPayload,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    this.socket.on('connect', () => {
      console.log('✅ Connected to Socket.IO server with ID:', this.socket.id);
    });

    this.socket.on('connect_error', (error) => {
      console.error('❗ Connection Error:', error);
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('⚡ Disconnected:', reason);
    });
  }

  disconnect() {
    if (this.socket) {
      console.log('❗ Disconnecting socket...');
      this.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
      this.eventListeners.clear();
    }
  }

  emitEvent(event, data) {
    if (this.socket) {
      console.log(`📤 Emitting Event: ${event}`, data);
      this.socket.emit(event, data);
    } else {
      console.error('❌ Socket not initialized!');
    }
  }

  onEvent(event, callback) {
    if (!this.socket) {
      console.error('❌ Socket not initialized!');
      return;
    }
    if (this.eventListeners.has(event)) {
      console.log(`🔄 Removing existing listener for: ${event}`);
      this.offEvent(event);
    }
    console.log(`👂 Listening for Event: ${event}`);
    this.socket.on(event, callback);
    this.eventListeners.set(event, callback);
  }

  offEvent(event) {
    if (this.socket && this.eventListeners.has(event)) {
      console.log(`❌ Removing Listener for Event: ${event}`);
      const callback = this.eventListeners.get(event);
      this.socket.off(event, callback);
      this.eventListeners.delete(event);
    }
  }

  removeAllListeners() {
    if (this.socket) {
      console.log('🧹 Removing all listeners');
      this.eventListeners.forEach((callback, event) => {
        this.socket.off(event, callback);
      });
      this.eventListeners.clear();
    }
  }

  // =========================
  // TICKET CHAT HELPERS
  // =========================
  joinTicketRoom(ticketId, userId) {
    this.emitEvent('joinTicketRoom', { ticketId, userId });
  }

  sendTicketMessage({ ticketId, senderId, senderType, content }) {
    this.emitEvent('ticketMessage', { ticketId, senderId, senderType, content });
  }

  onNewTicketMessage(callback) {
    this.onEvent('newTicketMessage', callback);
  }

  deleteTicketMessage({ ticketId, messageIds }) {
    this.emitEvent("deleteTicketMessage", { ticketId, messageIds });
  }

  onTicketMessageDeleted(callback) {
    this.onEvent("messageDeleted", callback);
  }

  // =========================
  // DRIVER-USER CHAT HELPERS
  // =========================
  joinDriverUserChatRoom(id, userId) {
    this.emitEvent('joinDriverUserChatRoom', { id, userId });
  }

  sendDriverUserChat({ id, senderId, receiverId, receiverType, content }) {
    this.emitEvent('driverUserChat', { id, senderId, receiverId, receiverType, content });
  }

  onReceiveDriverUserChat(callback) {
    this.onEvent('receiveDriverUserChat', callback);
  }

  markDriverUserChatAsRead(id, readerId) {
    this.emitEvent('markDriverUserChatAsRead', { id, readerId });
  }

  // =========================
  // DRIVER LIVE LOCATION HELPERS
  // =========================
  sendDriverLiveLocation({ rideId, rideBookingId, bookingId, driverId, lat, lng, heading, speed }) {
    this.emitEvent('driverLiveLocation', { rideId, rideBookingId, bookingId, driverId, lat, lng, heading, speed });
  }

  joinRideRoom(rideId, driverId) {
    this.emitEvent('joinRideRoom', { rideId, driverId });
  }

  leaveRideRoom(rideId) {
    this.emitEvent('leaveRideRoom', { rideId });
  }

  // =========================
  // TRACKING HELPERS (ShareableMap use karta hai)
  // =========================

  // ✅ FIX 1: Object format mein bhejo, driverId = "public" for tracking page
  joinRideTrackingRoom(rideId) {
    if (!rideId) {
      return console.warn("⚠️ rideId is required to join ride tracking room");
    }
    // Backend needs { rideId, driverId } — tracking page ke liye "public" pass karo
    this.emitEvent("joinRideRoom", { rideId, driverId: "public" });
    console.log(`🚗 Joined ride tracking room: ${rideId}`);
  }

  // ✅ FIX 2: Condition fix kiya — sirf rideId check karo
  leaveRideTrackingRoom(rideId) {
    if (!rideId) return;
    this.emitEvent("leaveRideRoom", { rideId });
    console.log(`🚪 Left ride tracking room: ${rideId}`);
  }

  onRideLocationUpdate(callback) {
    this.onEvent("updateDriverLocation", callback);
  }
}

export default new SocketService();