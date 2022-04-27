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
            '03AAAAAGJqMZcAEGQwbnBzcnVpNXMwZjJhaDQAoNQlcGaA6GvqwLQgXcXgAknbw1OF6TulvinIFtBPwwy8O7wGnY+pgtwJV8klk/kEpisQzwmebfjQ51jWzSp83h2NEpNMyDkOFP4tset8aO2qXHSZqrZ8lBFOZ9fiXAi2/Ggrp0kzZJpllX5v65/TaQYUmvX5UX+JC3IzXGBAJz+dFCLxg5pHLaIaQ/dEbDGvoiP5zjVw1k+4oOstL18W9MY=';
        }),
      client: () =>
        setRoomState((d) => {
          d.userId = 'dfy';
          d.roomId = '1';
          d.userName = 'dfy';
          d.token =
            '03AAAAAGJqWF4AEGtwajVkZm5pdHRuYXY0aHMAoLhy/CdoodmPqX65t8+X4LAP181vTilQYngT4iTPNIkdnLA2fSQG7vpCzE5x6UtaAX+ctp7tVtMRSFps9wZ7aDcB+oC2Fa/6i12sVw86sL/NFjliP4uBywBt9oewVDx6gGEsSOrU8IBUud9XclizphdKMdGN2WYB5LW6hV+9KNR0EYh7DR/ksU+n5Uc9l9nIyw8Wt0qlSzziL0FqryxUNVQ=';
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

  // Init engine event
  zg.current.on('roomStateUpdate', (roomID, state) => {
    connectStatusValid[state]();
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

  // 是否登录
  const [isLogin, setIsLogin] = useState(false);
  // Step 3: login to room
  async function loginRoom(
    roomId: string,
    userId: string,
    userName: string,
    token: string
  ) {
    try {
      await zg.current.loginRoom(roomId, token, {
        userID: userId,
        userName,
      });
      setIsLogin(true);
    } catch (e) {
      setIsLogin(false);
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
        <div className="py-4 flex justify-between">
          <div className="flex items-center">
            <span className="text-2xl font-medium mr-2">
              云汇展在线工作人员
            </span>
            <span
              className={cn(
                'w-4 h-4 rounded-full',
                isLogin ? 'bg-green-600' : 'bg-red-600'
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
        <div className="p-4 flex items-center">
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
                        <div className="w-3 h-3 rounded-full bg-green-600 mr-1"></div>
                        <div>权限正常</div>
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-red-600 mr-1"></div>
                        <div>无法读取{deviceValid[k]}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Popover.Content>
          </Popover>

          <MicroPhone className=" cursor-pointer" />
        </div>

        {/* 聊天内容输入框 */}
        <div className="h-[120px] p-2">
          <textarea
            name=""
            id=""
            className="resize-none w-full h-full"
          ></textarea>
        </div>
        <div className="flex justify-end">
          <Button>发送</Button>
        </div>
      </div>

      {/* 推流 */}
      <Draggable>
        <div className="cursor-move fixed z-10">
          <video
            className="rounded-lg w-[640px] h-[480px]"
            ref={publishVideoRef}
            autoPlay
          ></video>
        </div>
      </Draggable>

      {/* 拉流 */}
      <Draggable>
        <div className="cursor-move fixed z-10">
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
