import { useEffect, useMemo, useRef, useState } from 'react';
import { useImmer } from 'use-immer';
import { ZegoExpressEngine } from 'zego-express-engine-webrtc';
import {
  ZegoDeviceInfo,
  ZegoLocalStreamConfig,
  ZegoWebPlayOption,
} from 'zego-express-engine-webrtc/sdk/code/zh/ZegoExpressEntity.web';

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

const useZego = (appID: number, server: string, roomState: RoomState) => {
  // Zg engine
  const zg = useRef<ZegoExpressEngine>();

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

  const createZegoExpressEngineOption = async () => {
    zg.current = new ZegoExpressEngine(appID, server);

    // Init engine event
    zg.current.on('roomOnlineUserCountUpdate', (roomID, count) => {
      // console.debug(count);
    });
    zg.current.on('roomStateUpdate', (roomID, state) => {
      connectStatusValid[state]();
    });
    // // 监听对方进入房间
    // zg.current.on('roomUserUpdate', (roomID, updateType, userList) => {
    //   if (userList.length > 0) {
    //     setIsOnline(true);
    //   }
    // });
    zg.current.on('publisherStateUpdate', ({ state, streamID }) => {
      setPublishStatus(state);
    });
    zg.current.on('playerStateUpdate', ({ state, streamID }) => {
      setPlayStatus(state);
    });
    zg.current.on('roomStreamUpdate', (roomID, updateType, steamList) => {
      if (updateType === 'ADD') {
        setPlayInfoStreamID(steamList[0].streamID);
      }
      if (updateType === 'DELETE') {
        hangUp();
      }
    });

    await loginRoom(
      roomState.roomId,
      roomState.userId,
      roomState.userName,
      roomState.token
    );
  };

  // Step 2: Check system requirements
  // 设备权限状态
  const [deviceStatus, setDeviceStatus] = useState<{
    [key: string]: boolean;
    camera: boolean;
    microphone: boolean;
  }>({
    camera: false,
    microphone: false,
  });
  async function checkSystemRequirements() {
    console.warn('sdk version is', zg.current?.getVersion());
    try {
      const result = await zg.current?.checkSystemRequirements();

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
  }

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
  // 枚举设备
  async function enumerateDevices() {
    const deviceInfo = await zg.current?.enumDevices();
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
  }

  // Step 3: login to room
  async function loginRoom(
    roomId: string,
    userId: string,
    userName: string,
    token: string
  ) {
    try {
      await zg.current?.loginRoom(
        roomId,
        token,
        {
          userID: userId,
          userName,
        },
        { userUpdate: true }
      );
    } catch (e) {
      console.error(e);
    }
  }

  // Step 4: publish stream
  // 流编码
  const videoCodec =
    localStorage.getItem('VideoCodec') === 'H.264' ? 'H264' : 'VP8';

  // 本机摄像头 video ref
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const publishVideoRef = useRef<HTMLVideoElement>(null);
  // 是否开始推流
  const [isPublishingStream, setIsPublishingStream] = useState(false);
  async function publishStream(
    streamID: string,
    config: ZegoLocalStreamConfig
  ) {
    try {
      const stream = await zg.current?.createStream(config);
      localStream = stream;

      if (!localStream) throw new Error('Create stream failed');

      zg.current?.startPublishingStream(streamID, localStream, {
        videoCodec,
      });

      if (!publishVideoRef.current) throw new Error('publishVideoRef is null');
      publishVideoRef.current.srcObject = localStream;

      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  // 拉流
  // Step 5: play stream
  // 是否开始拉流
  const [isPlayingStream, setIsPlayingStream] = useState(false);
  // 远端摄像头 video ref
  const playVideoRef = useRef<HTMLVideoElement>(null);
  async function playStream(streamID: string, options: ZegoWebPlayOption = {}) {
    try {
      remoteStream = await zg.current?.startPlayingStream(streamID, options);
      if (!playVideoRef.current) throw new Error('playVideoRef is null');
      if (!remoteStream) throw new Error('Create stream failed');
      playVideoRef.current.srcObject = remoteStream;
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  // 设备权限状态
  const [systemRequireStatus, setSystemRequireStatus] = useState(false);
  // 是否显示 video 标签
  const [showVideo, setShowVideo] = useState(false);
  // 设备权限检测时加载状态
  const [loading, setLoading] = useState(false);

  // 开始视频通话按钮
  const handleVideo = async () => {
    setLoading(true);
    setShowVideo(true);

    await createZegoExpressEngineOption();
    const result = await checkSystemRequirements();
    setSystemRequireStatus(result);
    setLoading(false);

    // 开始推流
    setIsPublishingStream(true);
    // 开始拉流
    setIsPlayingStream(true);
  };

  // 执行推流
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
    }
    if (isPlayingStream && playInfoStreamID) {
      playStream(playInfoStreamID, {
        video: deviceStatus.camera,
        audio: deviceStatus.microphone,
      });
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    systemRequireStatus,
    isPublishingStream,
    isPlayingStream,
    playInfoStreamID,
  ]);

  const hangUp = () => {
    localStream && zg.current?.destroyStream(localStream);
    localStream = null;
    zg.current?.stopPublishingStream(publishInfoStreamID);
    setIsPublishingStream(false);

    if (publishVideoRef.current) publishVideoRef.current.srcObject = null;
    remoteStream && zg.current?.destroyStream(remoteStream);
    remoteStream = null;
    zg.current?.stopPlayingStream(playInfoStreamID ?? '');
    setPlayInfoStreamID('');
    setIsPlayingStream(false);

    if (playVideoRef.current) playVideoRef.current.srcObject = null;
    setShowVideo(false);

    zg.current = undefined;
  };

  return {
    zg: zg.current,
    handleVideo,
    showVideo,
    isPublishing,
    playVideoRef,
    publishVideoRef,
    loading,
    deviceStatus,
    hangUp,
  };
};

export default useZego;