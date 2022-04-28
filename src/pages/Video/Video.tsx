import { ZegoExpressEngine } from 'zego-express-engine-webrtc';
import cn from 'classnames';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ReactComponent as MicroPhone } from 'assets/video/microphone.svg';
import { ReactComponent as Camera } from 'assets/video/camera.svg';
import { ReactComponent as HangUp } from 'assets/video/hangup.svg';
import { Button, Popover } from '@nextui-org/react';
import { useImmer } from 'use-immer';
import {
  ZegoDeviceInfo,
  ZegoLocalStreamConfig,
  ZegoWebPlayOption,
} from 'zego-express-engine-webrtc/sdk/code/zh/ZegoExpressEntity.web';
import Draggable from 'react-draggable';

export const isMobile: boolean =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

const appID = 1237665297;
const server = 'wss://webliveroom1237665297-api.imzego.com/ws';

const deviceValid: {
  [key: string]: string;
} = {
  camera: '摄像机',
  microphone: '麦克风',
};

type Props = {
  type?: 'server' | 'client';
};

let localStream: MediaStream | null = null;
let remoteStream: MediaStream | null = null;
const resolution = {
  width: isMobile ? 360 : 640,
  height: isMobile ? 640 : 480,
};

const Server = ({ type = 'server' }: Props) => {
  // 房间信息
  const [roomState, setRoomState] = useImmer({
    roomId: '',
    userId: '',
    userName: '',
    token: '',
  });
  const validType = useMemo(
    () => ({
      server: () =>
        setRoomState((d) => {
          d.userId = 'xfy';
          d.roomId = '1';
          d.userName = 'xfy';
          d.token =
            '03AAAAAGJrO6wAEHljZHgxeXJ3d3lrYmZjd3gAoJjRaV0PaIoV2+npM7KYH9N7y7ylSvza6HqgUIwJi8QrrLcYHrY0K2tluKO7r+scGMo08Iewy8Y6cTLd1tkn0w3Gyt4gZFx/VGLJXMzuZFrsWvbGdOb2xF6GbZ+HRbmxkBX4At+TftRBq8GduzF8wKz4zck/lyC1AbQlYjLOICWkgF9ef5P0rf4SLSunA6sewYBAFRDJ/ufdfjXy+nsCDFE=';
        }),
      client: () =>
        setRoomState((d) => {
          d.userId = 'dfy';
          d.roomId = '1';
          d.userName = 'dfy';
          d.token =
            '03AAAAAGJrO7kAEDNrYWYzMWtvZmVncnFueXMAoJ/9+IEWf2b1tTql/14fF2IIVZbGaf7rXsvkyKqcGklexKZcFpckAljXQjn9BLDcHu1oDEP18hOwExMW7pU2UNhhnmOZQ3ec7elDvjmX7NyMOIjFTRTV1bhzZtKXrYNw4DMrqARAmMLIB1L1H3N/dHLBPTeNeVou1jk7LEDvtwgiU4j2MHjPKWuwgx5gn3gRdNzxblKFro1PgGgYUK2FXj0=';
        }),
    }),
    [setRoomState]
  );
  // 模拟销售人员
  useEffect(() => {
    validType[type]();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setRoomState]);
  // 登录到房间
  useEffect(() => {
    if (roomState.roomId !== '')
      loginRoom(
        roomState.roomId,
        roomState.userId,
        roomState.userName,
        roomState.token
      );
  }, [roomState]);

  // Step 1: Create engine
  const zg = useRef(new ZegoExpressEngine(appID, server));

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

  // 对方是否在线
  const [isOnline, setIsOnline] = useState(false);
  // Init engine event
  zg.current.on('roomOnlineUserCountUpdate', (roomID, count) => {
    // console.debug(count);
  });
  zg.current.on('roomStateUpdate', (roomID, state) => {
    connectStatusValid[state]();
  });
  // 监听对方进入房间
  zg.current.on('roomUserUpdate', (roomID, updateType, userList) => {
    if (userList.length > 0) {
      setIsOnline(true);
    }
  });
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
    console.log('sdk version is', zg.current.getVersion());
    try {
      const result = await zg.current.checkSystemRequirements();

      console.warn('checkSystemRequirements ', result);

      if (!result.webRTC) {
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
    const deviceInfo = await zg.current.enumDevices();
    const audioDeviceList =
      deviceInfo &&
      deviceInfo.microphones.map((item, index) => {
        if (!item.deviceName) {
          item.deviceName = 'microphone' + index;
        }
        console.log('microphone: ' + item.deviceName);
        return item;
      });
    audioDeviceList.push({ deviceID: '0', deviceName: '禁止' });
    const videoDeviceList =
      deviceInfo &&
      deviceInfo.cameras.map((item, index) => {
        if (!item.deviceName) {
          item.deviceName = 'camera' + index;
        }
        console.log('camera: ' + item.deviceName);
        return item;
      });
    videoDeviceList.push({ deviceID: '0', deviceName: '禁止' });
    setDevice((d) => {
      d.audioDeviceList = audioDeviceList;
      d.videoDeviceList = videoDeviceList;
      d.microphoneDevicesVal = audioDeviceList[0].deviceID;
      d.cameraDevicesVal = videoDeviceList[0].deviceID;
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
      await zg.current.loginRoom(
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
  const publishVideoRef = useRef<HTMLVideoElement>(null);
  // 是否开始推流
  const [isPublishingStream, setIsPublishingStream] = useState(false);
  async function publishStream(
    streamID: string,
    config: ZegoLocalStreamConfig
  ) {
    try {
      const stream = await zg.current.createStream(config);
      localStream = stream;

      zg.current.startPublishingStream(streamID, localStream ?? stream, {
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
      remoteStream = await zg.current.startPlayingStream(streamID, options);
      if (!playVideoRef.current) throw new Error('playVideoRef is null');
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
    if (!isOnline) return;
    setLoading(true);
    setShowVideo(true);
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
    localStream && zg.current.destroyStream(localStream);
    localStream = null;
    zg.current.stopPublishingStream(publishInfoStreamID);
    setIsPublishingStream(false);
    if (publishVideoRef.current) publishVideoRef.current.srcObject = null;
    remoteStream && zg.current.destroyStream(remoteStream);
    remoteStream = null;
    zg.current.stopPlayingStream(playInfoStreamID ?? '');
    setPlayInfoStreamID('');
    setIsPlayingStream(false);
    if (playVideoRef.current) playVideoRef.current.srcObject = null;
    setShowVideo(false);
  };

  return (
    <>
      <div
        className={cn(
          'top-0 left-0 w-full h-full',
          'fixed md:top-1/2 md:left-1/2 rounded-md shadow-md',
          'md:transform md:-translate-x-1/2 md:-translate-y-1/2',
          'p-4 md:w-[800px] md:h-[unset]'
        )}
      >
        {/* 标头 */}
        <div className="flex justify-between py-4">
          <div className="flex items-center">
            <span className="mr-2 text-2xl font-medium">
              云汇展在线工作人员
            </span>
            <span
              className={cn(
                'w-4 h-4 rounded-full',
                isOnline ? 'bg-green-600' : 'bg-red-600'
              )}
            ></span>
          </div>
          <div
            className={cn(
              'rounded bg-red-500 font-bold w-[32px]',
              'text-white text-2xl',
              'flex justify-center items-center',
              'cursor-pointer'
            )}
          >
            X
          </div>
        </div>
        <div className="h-[1px] bg-gray-300"></div>

        {/* 聊天内容框 */}
        <div className="h-[400px]"></div>

        <div className="h-[1px] bg-gray-300"></div>
        {/* 聊天工具栏 */}
        <div className="flex items-center p-4">
          <Popover placement="top">
            <Popover.Trigger>
              <Camera className="mr-4 cursor-pointer" onClick={handleVideo} />
            </Popover.Trigger>
            {isOnline ? (
              <></>
            ) : (
              <Popover.Content>
                <div className="p-4">对方不在线</div>
              </Popover.Content>
            )}
          </Popover>

          <MicroPhone className="cursor-pointer " />
        </div>

        {/* 聊天内容输入框 */}
        <div className="h-[120px] p-2">
          <textarea
            name=""
            id=""
            className="w-full h-full resize-none"
          ></textarea>
        </div>
        <div className="flex justify-end">
          <Button>发送</Button>
        </div>
      </div>

      {showVideo && (
        <Draggable>
          <div
            className={cn(
              'fixed z-10 cursor-move ',
              'flex justify-center items-center',
              'bg-white rounded-lg shadow-lg',
              'group overflow-hidden',
              'w-full h-full',
              'md:w-[640px] md:h-[480px]'
            )}
          >
            {/* 拉流 对方的视频流 */}
            <video
              className={cn(
                'rounded-lg ',
                isPublishing || 'hidden',
                'w-full h-full',
                'md:w-[640px] md:h-[480px]'
              )}
              ref={playVideoRef}
              autoPlay
            ></video>
            {/* 推流 本机的视频流 */}
            <video
              className={cn(
                'rounded-lg w-[240px] h-[180px]',
                isPublishing || 'hidden',
                'absolute right-4 bottom-4'
              )}
              ref={publishVideoRef}
              autoPlay
            ></video>

            <div className={cn(isPublishing && 'hidden')}>
              {loading ? (
                <div>检测设备中</div>
              ) : (
                Object.keys(deviceStatus).map((k) => (
                  <div key={k} className="flex">
                    {deviceValid[k]}：
                    {deviceStatus[k] ? (
                      <div className="flex items-center">
                        <div className="w-3 h-3 mr-1 bg-green-600 rounded-full"></div>
                        <div>权限正常</div>
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <div className="w-3 h-3 mr-1 bg-red-600 rounded-full"></div>
                        <div>无法读取{deviceValid[k]}</div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* 视频控制栏 */}
            <div
              className={cn(
                'absolute hidden',
                'group-hover:flex',
                'transition-all',
                'h-[100px] w-full',
                'items-center justify-evenly',
                'bottom-0',
                'bg-opacity-50 bg-gray-300'
              )}
            >
              <div className="cursor-pointer" onClick={hangUp}>
                <HangUp className="w-12 h-12" />
              </div>
            </div>
          </div>
        </Draggable>
      )}
    </>
  );
};

export default Server;
