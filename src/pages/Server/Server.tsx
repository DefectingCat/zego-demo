import { ZegoExpressEngine } from 'zego-express-engine-webrtc';
import cn from 'classnames';
import { useMemo, useState } from 'react';
import { ReactComponent as MicroPhone } from 'assets/video/microphone.svg';
import { ReactComponent as Camera } from 'assets/video/camera.svg';
import { Button } from '@nextui-org/react';

const appID = 1237665297;
const server = 'wss://webliveroom1237665297-api.imzego.com/ws';

const Server = () => {
  // 连接状态
  const [connectStatus, setConnectStatus] = useState('');
  const connectStatusValid = useMemo(
    () => ({
      DISCONNECTED: setConnectStatus('DISCONNECTED'),
      CONNECTING: setConnectStatus('CONNECTING'),
      CONNECTED: setConnectStatus('CONNECTED'),
    }),
    []
  );

  // 流 ID
  const [publishInfoStreamID, setPublishInfoStreamID] = useState('');
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

  // 设备权限状态
  const [deviceStatus, setDeviceStatus] = useState({
    camera: false,
    microphone: false,
  });

  // Step 1: Create engine
  const zg = new ZegoExpressEngine(appID, server);

  // Init engine event
  zg.on('roomStateUpdate', (roomID, state) => connectStatusValid[state]);
  zg.on('publisherStateUpdate', ({ state, streamID }) =>
    publishInfoStreamIDValid[state](streamID)
  );
  zg.on('playerStateUpdate', ({ state, streamID }) =>
    publishInfoStreamIDValid[state](streamID)
  );

  // Step 2: Check system requirements
  async function checkSystemRequirements() {
    console.log('sdk version is', zg.getVersion());
    try {
      const result = await zg.checkSystemRequirements();

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
      return true;
    } catch (err) {
      console.error('checkSystemRequirements', err);
      return false;
    }
  }

  // Handlers
  const handleVideo = async () => {
    const result = await checkSystemRequirements();
    console.log(result);
  };

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
          <h1 className="text-2xl font-medium">云汇展在线工作人员</h1>
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
          <Camera className="mr-4 cursor-pointer" onClick={handleVideo} />
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
    </>
  );
};

export default Server;
