import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useImmer } from 'use-immer';
import { ZegoExpressEngine } from 'zego-express-engine-webrtc';
import {
  ZegoDeviceInfo,
  ZegoLocalStreamConfig,
  ZegoWebPlayOption,
} from 'zego-express-engine-webrtc/sdk/code/zh/ZegoExpressEntity.web';
import { ZegoBroadcastMessageInfo } from 'zego-express-engine-webrtm/sdk/code/zh/ZegoExpressEntity';

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

let localStream: MediaStream | null | undefined = null;
let remoteStream: MediaStream | null | undefined = null;
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

  /**
   * 挂断视频
   * 并结束推/拉流，销毁 Zego 引擎
   */
  const hangUp = useCallback(() => {
    localStream && zg?.destroyStream(localStream);
    localStream = null;
    zg?.stopPublishingStream(publishInfoStreamID);

    if (publishVideoRef.current) publishVideoRef.current.srcObject = null;
    remoteStream && zg?.destroyStream(remoteStream);
    remoteStream = null;
    zg?.stopPlayingStream(playInfoStreamID ?? '');
    setPlayInfoStreamID('');

    if (playVideoRef.current) playVideoRef.current.srcObject = null;
    setShowVideo(false);
  }, [playInfoStreamID, publishInfoStreamID]);

  // 对方是否在线
  const [isOnline, setIsOnline] = useState(false);
  /**
   * 监听房间事件 - 登录到房间
   */
  const createZegoExpressEngineOption = useCallback(
    async (appID: number, server: string) => {
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

      await loginRoom(
        roomState.roomId,
        roomState.userId,
        roomState.userName,
        roomState.token
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      connectStatusValid,
      hangUp,
      loginRoom,
      roomState.roomId,
      roomState.token,
      roomState.userId,
      roomState.userName,
    ]
  );

  // 设备列表
  const [device, setDevice] = useImmer<{
    audioDeviceList: ZegoDeviceInfo[];
    videoDeviceList: ZegoDeviceInfo[];
    microphoneDevicesVal: string;
    cameraDevicesVal: string;
  }>({
    audioDeviceList: [],
    videoDeviceList: [],
    microphoneDevicesVal: '',
    cameraDevicesVal: '',
  });
  /**
   * 枚举音/视频设备
   */
  const enumerateDevices = useCallback(async () => {
    const deviceInfo = await zg?.enumDevices();
    const audioDeviceList =
      deviceInfo &&
      deviceInfo.microphones.map((item, index) => {
        if (!item.deviceName) {
          item.deviceName = 'microphone' + index;
        }
        console.log('microphone: ' + item.deviceName);
        return item;
      });
    audioDeviceList?.push({ deviceID: '0', deviceName: '禁止' });
    const videoDeviceList =
      deviceInfo &&
      deviceInfo.cameras.map((item, index) => {
        if (!item.deviceName) {
          item.deviceName = 'camera' + index;
        }
        console.log('camera: ' + item.deviceName);
        return item;
      });
    videoDeviceList?.push({ deviceID: '0', deviceName: '禁止' });
    setDevice((d) => {
      d.audioDeviceList = audioDeviceList ?? [];
      d.videoDeviceList = videoDeviceList ?? [];
      d.microphoneDevicesVal = audioDeviceList?.[0].deviceID ?? '';
      d.cameraDevicesVal = videoDeviceList?.[0].deviceID ?? '';
    });
  }, [setDevice]);

  // 设备权限状态
  const [deviceStatus, setDeviceStatus] = useState<{
    [key: string]: boolean;
    camera: boolean;
    microphone: boolean;
  }>({
    camera: false,
    microphone: false,
  });
  /**
   * 检查当前设备权限状态并枚举设备
   */
  const checkSystemRequirements = useCallback(async () => {
    console.warn('sdk version is', zg?.getVersion());
    try {
      const result = await zg?.checkSystemRequirements();

      console.warn('checkSystemRequirements ', result);

      if (!result?.webRTC) {
        console.error('browser is not support webrtc!!');
        return false;
      } else if (!result.videoCodec?.H264 && !result.videoCodec?.VP8) {
        console.error('browser is not support H264 and VP8');
        return false;
      } else if (!result.camera && !result.microphone) {
        console.error('camera and microphones not allowed to use');
        setDeviceStatus({
          camera: false,
          microphone: false,
        });
        return false;
      } else if (result.videoCodec.VP8) {
        if (!result.screenSharing)
          console.warn('browser is not support screenSharing');
      } else {
        console.log('不支持VP8，请前往混流转码测试');
      }
      setDeviceStatus({
        camera: true,
        microphone: true,
      });
      await enumerateDevices();
      return true;
    } catch (err) {
      console.error('checkSystemRequirements', err);
      return false;
    }
  }, [enumerateDevices]);

  // 流编码
  const videoCodec =
    localStorage.getItem('VideoCodec') === 'H.264' ? 'H264' : 'VP8';

  // 本机摄像头 video ref
  const publishVideoRef = useRef<HTMLVideoElement>(null);
  // 是否开始推流
  const [isPublishingStream, setIsPublishingStream] = useState(false);
  /**
   * 开始推流方法
   * 将本地摄像头的视频流推送到服务器，同时输出到 video 标签
   */
  const publishStream = useCallback(
    async (streamID: string, config: ZegoLocalStreamConfig) => {
      try {
        const stream = await zg?.createStream(config);
        localStream = stream;

        if (!localStream) throw new Error('Create stream failed');
        zg?.startPublishingStream(streamID, localStream, {
          videoCodec,
        });

        if (!publishVideoRef.current)
          throw new Error('publishVideoRef is null');
        publishVideoRef.current.srcObject = localStream;

        return true;
      } catch (e) {
        console.error(e);
        return false;
      }
    },
    [videoCodec]
  );

  // 是否开始拉流
  const [isPlayingStream, setIsPlayingStream] = useState(false);
  // 远端摄像头 video ref
  const playVideoRef = useRef<HTMLVideoElement>(null);
  /**
   * 开始拉流方法
   * 将远程流拉取到本地，同时设置到 video 标签
   */
  const playStream = useCallback(
    async (streamID: string, options: ZegoWebPlayOption = {}) => {
      try {
        remoteStream = await zg?.startPlayingStream(streamID, options);
        if (!playVideoRef.current) throw new Error('playVideoRef is null');
        if (!remoteStream) throw new Error('Create stream failed');
        playVideoRef.current.srcObject = remoteStream;
        return true;
      } catch (e) {
        console.error(e);
        return false;
      }
    },
    []
  );

  // 设备权限状态
  const [systemRequireStatus, setSystemRequireStatus] = useState(false);
  // 是否显示 video 标签
  const [showVideo, setShowVideo] = useState(false);
  // 设备权限检测时加载状态
  const [loading, setLoading] = useState(false);

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
  }, [checkSystemRequirements, isOnline]);

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

  // 创建实例并登录
  useEffect(() => {
    if (roomState.roomId === '') return;
    createZegoExpressEngineOption(appID, server);
  }, [appID, createZegoExpressEngineOption, roomState, server]);

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
