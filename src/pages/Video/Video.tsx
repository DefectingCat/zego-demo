import { ZegoExpressEngine } from 'zego-express-engine-webrtc';
import cn from 'classnames';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ReactComponent as MicroPhone } from 'assets/video/microphone.svg';
import { ReactComponent as Camera } from 'assets/video/camera.svg';
import { Button, Popover } from '@nextui-org/react';
import { useImmer } from 'use-immer';
import {
  ZegoDeviceInfo,
  ZegoLocalStreamConfig,
  ZegoWebPlayOption,
} from 'zego-express-engine-webrtc/sdk/code/zh/ZegoExpressEntity.web';
import Draggable from 'react-draggable';

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
  // 流 ID
  const [publishInfoStreamID, setPublishInfoStreamID] = useState('');
  useEffect(() => {
    setPublishInfoStreamID(`${roomState.roomId}-${roomState.userId}`);
  }, [roomState]);
  const publishInfoStreamIDValid = useMemo(
    () => ({
      PUBLISHING: (streamID: string) => setPublishInfoStreamID(streamID),
      NO_PUBLISH: () => setPublishInfoStreamID(''),
      PUBLISH_REQUESTING: () => setPublishInfoStreamID(''),
      NO_PLAY: () => setPublishInfoStreamID(''),
      PLAYING: (streamID: string) => setPublishInfoStreamID(streamID),
      PLAY_REQUESTING: () => setPublishInfoStreamID(''),
    }),
    []
  );

  // 对方是否在线
  const [isOnline, setIsOnline] = useState(false);
  // Init engine event
  zg.current.on('roomStateUpdate', (roomID, state) => {
    connectStatusValid[state]();
  });
  // 监听对方进入房间
  zg.current.on('roomUserUpdate', (roomID, updateType, userList) => {
    console.error(roomID, updateType, userList);
    if (updateType === 'ADD') {
      setIsOnline(true);
    }
  });
  zg.current.on('publisherStateUpdate', ({ state, streamID }) =>
    publishInfoStreamIDValid[state](streamID)
  );
  zg.current.on('playerStateUpdate', ({ state, streamID }) => {
    publishInfoStreamIDValid[state](streamID);
  });
  zg.current.on('roomStreamUpdate', (roomID, updateType, steamList) => {
    console.error('roomStreamUpdate', roomID, updateType, steamList);
    if (updateType === 'ADD') {
      if (systemRequireStatus)
        playStream(steamList[0].streamID, {
          video: deviceStatus.camera,
          audio: deviceStatus.microphone,
        });
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

  // 推流信息
  const localStream = useRef<MediaStream | null>(null);
  // 本机摄像头 video ref
  const publishVideoRef = useRef<HTMLVideoElement>(null);

  // 流
  // Step 5: play stream
  // 拉流信息
  const remoteStream = useRef<MediaStream | null>(null);
  // 远端摄像头 video ref
  const playVideoRef = useRef<HTMLVideoElement>(null);
  async function playStream(streamID: string, options: ZegoWebPlayOption = {}) {
    try {
      const stream = await zg.current.startPlayingStream(streamID, options);
      remoteStream.current = stream;
      if (!playVideoRef.current) throw new Error('playVideoRef is null');
      playVideoRef.current.srcObject = remoteStream.current;
      return true;
    } catch (e) {
      return false;
    }
  }

  // 设备权限状态
  const [systemRequireStatus, setSystemRequireStatus] = useState(false);
  const handleVideo = async () => {
    setSystemRequireStatus(await checkSystemRequirements());
  };
  useEffect(() => {
    if (systemRequireStatus) {
      publishStream(publishInfoStreamID, {
        camera: {
          audioInput: device.microphoneDevicesVal,
          videoInput: device.cameraDevicesVal,
          video: deviceStatus.camera,
          audio: deviceStatus.microphone,
        },
      });
    }

    async function publishStream(
      streamID: string,
      config: ZegoLocalStreamConfig
    ) {
      try {
        const stream = await zg.current.createStream(config);
        localStream.current = stream;

        zg.current.startPublishingStream(
          streamID,
          localStream.current ?? stream,
          {
            videoCodec,
          }
        );

        if (!publishVideoRef.current)
          throw new Error('publishVideoRef is null');
        publishVideoRef.current.srcObject = localStream.current;

        return true;
      } catch (e) {
        return false;
      }
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [systemRequireStatus]);

  return (
    <>
      <div
        className={cn(
          'fixed top-1/2 left-1/2 rounded-lg shadow-lg',
          'transform -translate-x-1/2 -translate-y-1/2',
          'p-4 w-[800px]'
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
            <Popover.Content>
              <div className="p-4">
                {Object.keys(deviceStatus).map((k) => (
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
                ))}
              </div>
            </Popover.Content>
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

      {/* 推流 */}
      <Draggable>
        <div className="fixed z-10 cursor-move">
          <video
            className="rounded-lg w-[640px] h-[480px]"
            ref={publishVideoRef}
            autoPlay
          ></video>
        </div>
      </Draggable>

      {/* 拉流 */}
      <Draggable>
        <div className="fixed z-10 cursor-move">
          <video
            className="rounded-lg w-[640px] h-[480px]"
            ref={playVideoRef}
            autoPlay
          ></video>
        </div>
      </Draggable>
    </>
  );
};

export default Server;
