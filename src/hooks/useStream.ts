import { useCallback, useRef, useState } from 'react';
import { ZegoExpressEngine } from 'zego-express-engine-webrtc';
import {
  ZegoLocalStreamConfig,
  ZegoWebPlayOption,
} from 'zego-express-engine-webrtc/sdk/code/zh/ZegoExpressEntity.web';

export let localStream: MediaStream | null | undefined = null;
export let remoteStream: MediaStream | null | undefined = null;

const useStream = (zg: ZegoExpressEngine | null) => {
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
    [videoCodec, zg]
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
    [zg]
  );

  const destroySteam = useCallback(() => {
    if (playVideoRef.current) playVideoRef.current.srcObject = null;
    localStream && zg?.destroyStream(localStream);
    localStream = null;

    if (publishVideoRef.current) publishVideoRef.current.srcObject = null;
    remoteStream && zg?.destroyStream(remoteStream);
    remoteStream = null;
  }, [zg]);

  return {
    publishVideoRef,
    isPublishingStream,
    publishStream,
    setIsPublishingStream,
    playVideoRef,
    isPlayingStream,
    playStream,
    setIsPlayingStream,
    destroySteam,
  };
};

export default useStream;
