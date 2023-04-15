import { io } from "socket.io-client";

const options = {
  "force new connection": true,
  reconnectinAttempts: "Infinity",
  timeout: 10000,
  transports: ["websocket"],
};

const socket = io("/", options);

export default socket;
