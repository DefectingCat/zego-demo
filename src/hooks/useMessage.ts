import { useImmer } from 'use-immer';
import { ZegoExpressEngine } from 'zego-express-engine-webrtc';
import { ZegoBroadcastMessageInfo } from 'zego-express-engine-webrtm/sdk/code/zh/ZegoExpressEntity';
import { RoomState } from './useZego';
import { useCallback } from 'react';

const useMessage = (zg: ZegoExpressEngine | null, roomState: RoomState) => {
  // 收到的消息
  const [receivedMsg, setReceivedMsg] = useImmer<ZegoBroadcastMessageInfo[]>(
    []
  );
  const sendBroadcastMessage = useCallback(
    async (msg: string) => {
      try {
        const isSent = await zg?.sendBroadcastMessage(roomState.roomId, msg);
        const sendedMsg: ZegoBroadcastMessageInfo = {
          fromUser: {
            userID: roomState.userId,
            userName: roomState.userName,
          },
          message: msg,
          sendTime: new Date().getTime(),
          messageID: new Date().getTime(),
        };
        setReceivedMsg((d) => {
          d.push(sendedMsg);
        });
        console.log('>>> sendMsg success, ', isSent);
      } catch (error) {
        console.log('>>> sendMsg, error: ', error);
      }
    },
    [roomState.roomId, roomState.userId, roomState.userName, setReceivedMsg, zg]
  );

  return {
    receivedMsg,
    setReceivedMsg,
    sendBroadcastMessage,
  };
};

export default useMessage;
