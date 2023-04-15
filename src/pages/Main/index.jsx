import React, { useEffect, useState, useRef } from "react";
import socket from "../../socket";
import ACTIONS from "../../socket/actions";
import { useNavigate } from "react-router";
import { v4 } from "uuid";

const Main = () => {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const rootNode = useRef();

  useEffect(() => {
    socket.on(ACTIONS.SHARE_ROOMS, ({ rooms }) => {
      if (rootNode.current) {
        setRooms(rooms);
      }
    });
  }, []);
  console.log(socket);

  return (
    <div ref={rootNode}>
      <button onClick={() => navigate(`/room/${v4()}`)}>Create new room</button>
      <h1>Available Rooms</h1>
      <ul>
        {rooms.map((roomId) => (
          <li key={roomId}>
            {roomId}
            <button onClick={() => navigate(`/room/${roomId}`)}>JOIN</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Main;
