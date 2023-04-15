import { useRef, useEffect, useCallback } from "react";
import { useStateWithCallback } from "./useStateWithCallback";
import socket from "../socket";
import ACTIONS from "../socket/actions";
import freeIce from "freeice";

export const LOCAL_VIDEO = "LOCAL_VIDEO";

export function useWebRTC(roomId) {
  const [clients, setClients] = useStateWithCallback([]);
  const peerConnections = useRef({});
  const localMediaStream = useRef(null);
  const peerMediaElements = useRef({
    [LOCAL_VIDEO]: null,
  });

  const addNewClient = useCallback(
    (newClient, cb) => {
      if (!clients.includes(newClient)) {
        setClients((list) => [...list, newClient], cb);
      }
    },
    [clients, setClients]
  );

  useEffect(() => {
    async function handleNewPeer({ peerId, createOffer }) {
      if (peerId in peerConnections.current) {
        return console.log("Already connected to peer ", peerId);
      }

      peerConnections.current[peerId] = new RTCPeerConnection({
        iceServers: freeIce(),
      });

      peerConnections.current[peerId].onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit(ACTIONS.RELAY_ICE, {
            peerId,
            iceCandidate: event.candidate,
          });
        }
      };

      let tracksNumber = 0;
      peerConnections.current[peerId].ontrack = ({
        streams: [remoteStream],
      }) => {
        tracksNumber++;

        if (tracksNumber === 2) {
          //video $ audio tracks received
          addNewClient(peerId, () => {
            peerMediaElements.current[peerId].srcObject = remoteStream;
          });
        }
      };

      localMediaStream.current?.getTracks().forEach((track) => {
        peerConnections.current[peerId].addTrack(
          track,
          localMediaStream.current
        );
      });

      if (createOffer) {
        const offer = await peerConnections.current[peerId].createOffer();

        await peerConnections.current[peerId].setLocalDescription(offer);

        socket.emit(ACTIONS.RELAY_SDP, {
          peerId,
          sessionDescription: offer,
        });
      }
    }

    socket.on(ACTIONS.ADD_PEER, handleNewPeer);
  }, []);

  useEffect(() => {
    async function setRemoteMedia({
      peerId,
      sessionDescription: remoteDescription,
    }) {
      peerConnections.current[peerId].setRemoteDescription(
        new RTCSessionDescription(remoteDescription)
      );

      if (remoteDescription.type === "offer") {
        const answer = await peerConnections.current[peerId].createAnswer();
        await peerConnections.current[peerId].setLocalDescription(answer);

        socket.emit(ACTIONS.RELAY_SDP, {
          peerId,
          sessionDescription: answer,
        });
      }
    }
    socket.on(ACTIONS.SESSION_DESCRIPTION, setRemoteMedia);
  }, []);

  useEffect(() => {
    socket.on(ACTIONS.ICE_CANDIDATE, ({ peerId, iceCandidate }) => {
      peerConnections.current[peerId].addIceCandidate(
        new RTCIceCandidate(iceCandidate)
      );
    });
  }, []);

  useEffect(() => {
    function handleRemovePeer({ peerId }) {
      if (peerId in peerConnections.current) {
        peerConnections.current[peerId].close();
      }

      delete peerConnections.current[peerId];
      delete peerMediaElements.current[peerId];

      setClients((list) => list.filter((c) => c !== peerId));
    }
    socket.on(ACTIONS.REMOVE_PEER, handleRemovePeer);
  }, []);

  useEffect(() => {
    async function startCapture() {
      localMediaStream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          width: 1280,
          height: 720,
        },
      });

      addNewClient(LOCAL_VIDEO, () => {
        const localVideoElement = peerMediaElements.current[LOCAL_VIDEO];

        if (localVideoElement) {
          localVideoElement.volume = 0;
          localVideoElement.srcObject = localMediaStream.current;
        }
      });
    }
    startCapture()
      .then(() => socket.emit(ACTIONS.JOIN, { room: roomId }))
      .catch((e) => console.log("Error getting user media"));

    return () => {
      localMediaStream.current?.getTracks().forEach((track) => track.stop());
      socket.emit(ACTIONS.LEAVE);
    };
  }, [roomId]);

  const provideMediaRef = useCallback((id, node) => {
    peerMediaElements.current[id] = node;
  }, []);

  return { clients, provideMediaRef };
}
