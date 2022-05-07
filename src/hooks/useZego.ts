import { useCallback, useEffect, useMemo, useState } from 'react';
import { useImmer } from 'use-immer';
import { ZegoExpressEngine } from 'zego-express-engine-webrtc';
import { ZegoBroadcastMessageInfo } from 'zego-express-engine-webrtm/sdk/code/zh/ZegoExpressEntity';
import useDevices from './useDevices';
import useStream from './useStream';

export type RoomState = {
  roomId: string;
  userId: string;
  userName: string;
  token: string;
};

export const isMobile: boolean =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

const resolution = {
  width: isMobile ? 360 : 640,
  height: isMobile ? 640 : 480,
};

// Zg engine
export let zg: ZegoExpressEngine | null = null;

const useZego = (appID: number, server: string, roomState: RoomState) => {
  if (zg == null) zg = new ZegoExpressEngine(appID, server);

  // 连接状态
  const [connectStatus, setConnectStatus] = useState('DISCONNECTED');
  const connectStatusValid = useMemo(
    () => ({
      DISCONNECTED: () => setConnectStatus('DISCONNECTED'),
      CONNECTING: () => setConnectStatus('CONNECTING'),
      CONNECTED: () => setConnectStatus('CONNECTED'),
    }),
    []
  );

  // 推流 ID
  const [publishInfoStreamID, setPublishInfoStreamID] = useState('');
  useEffect(() => {
    setPublishInfoStreamID(roomState.userId);
  }, [roomState]);
  // 拉流 ID
  const [playInfoStreamID, setPlayInfoStreamID] = useState<string | null>(null);

  // 推流状态
  const [publishStatus, setPublishStatus] = useState<
    'PUBLISHING' | 'NO_PUBLISH' | 'PUBLISH_REQUESTING'
  >('NO_PUBLISH');
  // 是否已经开始推流
  const isPublishing = useMemo(
    () => publishStatus === 'PUBLISHING',
    [publishStatus]
  );
  // 拉流状态
  const [playStatus, setPlayStatus] = useState<
    'NO_PLAY' | 'PLAY_REQUESTING' | 'PLAYING'
  >('NO_PLAY');

  /**
   * 登录到房间方法
   */
  const loginRoom = useCallback(
    async (roomId: string, userId: string, userName: string, token: string) => {
      try {
        await zg?.loginRoom(
          roomId,
          token,
          {
            userID: userId,
            userName,
          },
          { userUpdate: true }
        );
        console.log('>>> Login success');
      } catch (e) {
        console.error(e);
      }
    },
    []
  );

  // 检测设备
  const { device, deviceStatus, checkSystemRequirements } = useDevices(zg);

  // 创建流
  const {
    publishVideoRef,
    isPublishingStream,
    publishStream,
    setIsPublishingStream,
    playVideoRef,
    isPlayingStream,
    playStream,
    setIsPlayingStream,
    destroySteam,
  } = useStream(zg);

  // 设备权限状态
  const [systemRequireStatus, setSystemRequireStatus] = useState(false);
  // 是否显示 video 标签
  const [showVideo, setShowVideo] = useState(false);
  // 设备权限检测时加载状态
  const [loading, setLoading] = useState(false);
  // 对方是否在线
  const [isOnline, setIsOnline] = useState(false);

  /**
   * 开始视频通话按钮
   * 判断是否支持视频通话，如果支持，则开始推流，同时开始拉流
   */
  const handleVideo = useCallback(async () => {
    if (!isOnline) return;

    setLoading(true);
    setShowVideo(true);

    const result = await checkSystemRequirements();
    setSystemRequireStatus(result);
    setLoading(false);

    // 开始推流
    setIsPublishingStream(result);
    // 开始拉流
    setIsPlayingStream(result);
  }, [
    checkSystemRequirements,
    isOnline,
    setIsPlayingStream,
    setIsPublishingStream,
  ]);

  /**
   * 检查设备权限和枚举设备时需要设置状态
   * 所有此处需要监听是否开始推/拉流
   */
  useEffect(() => {
    if (!systemRequireStatus) return;
    if (isPublishingStream) {
      publishStream(publishInfoStreamID, {
        camera: {
          audioInput: device.microphoneDevicesVal,
          videoInput: device.cameraDevicesVal,
          video: deviceStatus.camera,
          audio: deviceStatus.microphone,
          ...resolution,
        },
      });
      setIsPublishingStream(false);
    }
    if (isPlayingStream && playInfoStreamID) {
      playStream(playInfoStreamID, {
        video: deviceStatus.camera,
        audio: deviceStatus.microphone,
      });
      setIsPlayingStream(false);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    systemRequireStatus,
    isPublishingStream,
    isPlayingStream,
    playInfoStreamID,
  ]);

  // 收到的消息
  const [receivedMsg, setReceivedMsg] = useImmer<ZegoBroadcastMessageInfo[]>(
    []
  );
  const sendBroadcastMessage = async (msg: string) => {
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
  };

  /**
   * 挂断视频
   * 并结束推/拉流，销毁 Zego 引擎
   */
  const hangUp = useCallback(() => {
    destroySteam();

    zg?.stopPublishingStream(publishInfoStreamID);
    zg?.stopPlayingStream(playInfoStreamID ?? '');

    setPlayInfoStreamID('');
    setShowVideo(false);
  }, [destroySteam, playInfoStreamID, publishInfoStreamID]);

  // 创建实例并登录
  useEffect(() => {
    if (roomState.roomId === '') return;

    loginRoom(
      roomState.roomId,
      roomState.userId,
      roomState.userName,
      roomState.token
    );
  }, [
    loginRoom,
    roomState.roomId,
    roomState.token,
    roomState.userId,
    roomState.userName,
  ]);

  useEffect(() => {
    zg?.on('IMRecvBroadcastMessage', () => {});

    // Init engine event
    zg?.on('roomOnlineUserCountUpdate', (roomID, count) => {
      // console.debug(count);
    });
    zg?.on('roomStateUpdate', (roomID, state) => {
      connectStatusValid[state]();
    });
    // // 监听对方进入房间
    zg?.on('roomUserUpdate', (roomID, updateType, userList) => {
      if (userList.length > 0) {
        setIsOnline(true);
      }
    });
    zg?.on('publisherStateUpdate', ({ state, streamID }) => {
      setPublishStatus(state);
    });
    zg?.on('playerStateUpdate', ({ state, streamID }) => {
      setPlayStatus(state);
    });
    zg?.on('roomStreamUpdate', (roomID, updateType, steamList) => {
      if (updateType === 'ADD') {
        setPlayInfoStreamID(steamList[0].streamID);
      }
      if (updateType === 'DELETE') {
        hangUp();
      }
    });

    // 房间实时消息
    zg?.on('IMRecvBroadcastMessage', (roomID, chatData) => {
      setReceivedMsg((d) => {
        chatData.forEach((msg) => {
          const duplicateMsg = d.find((m) => m.messageID === msg.messageID);
          if (duplicateMsg) return;
          d.push(msg);
        });
      });
    });
  }, [connectStatusValid, hangUp, setReceivedMsg]);

  return {
    handleVideo,
    showVideo,
    isPublishing,
    playVideoRef,
    publishVideoRef,
    loading,
    deviceStatus,
    hangUp,
    isOnline,

    sendBroadcastMessage,
    receivedMsg,

    connectStatus,
    playStatus,
  };
};

export default useZego;
