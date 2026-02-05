import { io } from 'socket.io-client';

const SOCKET_URL ="https://cab-booking-be-j9w5.onrender.com";

class SocketService {
  constructor() {
    this.socket = null;
    this.eventListeners = new Map(); // Track active listeners
  }

  // Initialize connection
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

    // Connection events
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

  // Disconnect socket
  disconnect() {
    if (this.socket) {
      console.log('❗ Disconnecting socket...');
      this.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
      this.eventListeners.clear();
    }
  }

  // Generic emit
  emitEvent(event, data) {
    if (this.socket) {
      console.log(`📤 Emitting Event: ${event}`, data);
      this.socket.emit(event, data);
    } else {
      console.error('❌ Socket not initialized!');
    }
  }

  // Generic on with duplicate prevention
  onEvent(event, callback) {
    if (!this.socket) {
      console.error('❌ Socket not initialized!');
      return;
    }

    // Remove existing listener for this event first
    if (this.eventListeners.has(event)) {
      console.log(`🔄 Removing existing listener for: ${event}`);
      this.offEvent(event);
    }

    console.log(`👂 Listening for Event: ${event}`);
    this.socket.on(event, callback);
    this.eventListeners.set(event, callback);
  }

  // Remove Event listener
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
    console.log("📤 Sending Ticket Msg:", { ticketId, senderId, senderType, content });
    this.emitEvent('ticketMessage', { ticketId, senderId, senderType, content });
  }

  onNewTicketMessage(callback) {
    this.onEvent('newTicketMessage', callback);
  }

  deleteTicketMessage({ ticketId, messageIds }) {
  console.log("🗑️ Deleting ticket message:", { ticketId, messageIds });
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
    this.emitEvent('driverLiveLocation', {rideId, rideBookingId, bookingId, driverId, lat, lng, heading, speed });
  }

//   onUpdateDriverLocation(callback) {
//     this.onEvent('updateDriverLocation', callback);
//   }

  joinRideRoom(rideId, driverId) {
    this.emitEvent('joinRideRoom', { rideId, driverId });
  }

  leaveRideRoom(rideId) {
    this.emitEvent('leaveRideRoom', { rideId });
  }

  // =========================
  // NEW: TRACKING HELPERS FOR RIDE-BASED CAB TRACKING
  // =========================
  joinRideTrackingRoom(rideId) {
    if (!rideId) return console.warn("⚠️ rideId is required to join ride tracking room");
    this.emitEvent("joinRideRoom", rideId);
  }

  leaveRideTrackingRoom(rideId, rideBookingId,) {
    if (!rideId || rideBookingId) return;
    this.emitEvent("leaveRideRoom", rideId,);
  }

  onRideLocationUpdate(callback) {
    this.onEvent("updateDriverLocation", callback);
  }
}

export default new SocketService();